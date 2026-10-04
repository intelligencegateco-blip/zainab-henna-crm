<?php
declare(strict_types=1);

/**
 * Zainab Henna CRM API (front controller).
 *
 * Endpoints mirror src/services/httpRepository.ts and src/services/authApi.ts.
 * All responses are JSON. Writes require the X-Requested-With: zainab-crm header
 * (with SameSite=Strict session cookies this blocks cross-site requests).
 */

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/entities.php';
require __DIR__ . '/lib/auth.php';

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $path = getenv('ZCRM_CONFIG') ?: __DIR__ . '/config.local.php';
        if (!is_file($path)) {
            fail(503, 'The server is not configured yet (missing config.local.php).');
        }
        $cfg = require $path;
    }
    return $cfg;
}

$ENTITY_ROUTES = [
    'contacts' => 'contacts',
    'bookings' => 'bookings',
    'services' => 'services',
    'interactions' => 'interactions',
    'follow-ups' => 'follow_ups',
];

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    // Everything after the last "/api" segment is the route.
    $pos = strrpos($uri, '/api');
    $path = trim($pos === false ? $uri : substr($uri, $pos + 4), '/');
    $parts = $path === '' ? [] : array_map('rawurldecode', explode('/', $path));

    if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'zainab-crm') {
        fail(403, 'Request blocked.');
    }

    // ---- Unauthenticated routes ----
    if ($parts === ['health'] && $method === 'GET') {
        json_out(['ok' => true, 'ready' => schema_ready()]);
    }

    if ($parts === ['setup'] && $method === 'POST') {
        $token = (string) ($_SERVER['HTTP_X_SETUP_TOKEN'] ?? '');
        $expected = (string) (config()['setup_token'] ?? '');
        if ($expected === '' || str_contains($expected, 'CHANGE_ME') || !hash_equals($expected, $token)) {
            fail(403, 'Invalid setup token.');
        }
        create_schema();
        if ((int) q('SELECT COUNT(*) AS n FROM users')->fetch()['n'] > 0) {
            fail(409, 'Setup has already been completed.');
        }
        $users = body()['users'] ?? [];
        if (!is_array($users) || !$users || ($users[0]['role'] ?? '') !== 'admin') {
            fail(422, 'The first user must be an Admin.');
        }
        $system = ['id' => 'setup', 'role' => 'admin'];
        $created = tx(fn () => array_map(fn ($u) => create_user($system, $u), $users));
        $data = body()['data'] ?? null;
        if (is_array($data)) {
            replace_data($data);
        }
        json_out(['users' => $created], 201);
    }

    start_session();

    if ($parts === ['auth', 'login'] && $method === 'POST') {
        $b = body();
        json_out(['user' => sign_in((string) ($b['email'] ?? ''), (string) ($b['password'] ?? ''))]);
    }
    if ($parts === ['auth', 'logout'] && $method === 'POST') {
        sign_out();
        json_out(null, 204);
    }
    if ($parts === ['auth', 'me'] && $method === 'GET') {
        $u = current_user();
        json_out(['user' => $u ? user_public($u) : null]);
    }
    if ($parts === ['auth', 'password'] && $method === 'POST') {
        $b = body();
        json_out(['user' => change_password(require_user(), (string) ($b['currentPassword'] ?? ''), (string) ($b['newPassword'] ?? ''))]);
    }

    // ---- Users (Admin / Owner) ----
    if (($parts[0] ?? '') === 'users') {
        $actor = require_can('manageUsers');
        $id = $parts[1] ?? null;
        if (!$id && $method === 'GET') {
            json_out(list_users());
        }
        if (!$id && $method === 'POST') {
            json_out(create_user($actor, body()), 201);
        }
        if ($id && ($parts[2] ?? '') === 'reset-password' && $method === 'POST') {
            json_out(reset_user_password($actor, $id));
        }
        if ($id && count($parts) === 2 && $method === 'PATCH') {
            json_out(update_user($actor, $id, body()));
        }
        if ($id && count($parts) === 2 && $method === 'DELETE') {
            delete_user($actor, $id);
            json_out(null, 204);
        }
        fail(404, 'Not found.');
    }

    // ---- CRM data ----
    if ($parts === ['snapshot'] && $method === 'GET') {
        require_can('read');
        json_out(snapshot());
    }
    if ($parts === ['settings'] && $method === 'PATCH') {
        require_can('settings');
        json_out(update_settings(body()));
    }
    if ($parts === ['admin', 'replace-data'] && $method === 'POST') {
        require_can('resetData');
        replace_data(body());
        json_out(null, 204);
    }

    $entity = $ENTITY_ROUTES[$parts[0] ?? ''] ?? null;
    if ($entity) {
        $id = $parts[1] ?? null;
        if (count($parts) > 2) {
            fail(404, 'Not found.');
        }
        if (!$id && $method === 'GET') {
            require_can('read');
            json_out(list_entities($entity));
        }
        require_can('write');
        if (!$id && $method === 'POST') {
            json_out(create_entity($entity, body()), 201);
        }
        if ($id && $method === 'PATCH') {
            json_out(update_entity($entity, $id, body()));
        }
        if ($id && $method === 'DELETE') {
            delete_entity($entity, $id);
            json_out(null, 204);
        }
    }

    fail(404, 'Not found.');
} catch (ApiError $e) {
    $payload = ['message' => $e->getMessage()];
    if ($e->fields) {
        $payload['fields'] = $e->fields;
    }
    json_out($payload, $e->status);
} catch (Throwable $e) {
    error_log('[zainab-crm] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    json_out(['message' => 'Something went wrong on the server. Try again.'], 500);
}
