<?php
declare(strict_types=1);

/**
 * Sessions, sign-in, roles and user management.
 *
 * Roles (mirrors src/lib/permissions.ts):
 *   admin  - everything, including assigning Admin
 *   owner  - same as admin, but cannot assign Admin or change Admin accounts
 *   editor - read and write CRM data; no users, business settings or data reset
 *   viewer - read only
 */

const ROLES = ['admin', 'owner', 'editor', 'viewer'];
const MAX_FAILED_LOGINS = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function start_session(): void
{
    $cfg = config();
    session_name('zcrm_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (bool) ($cfg['secure_cookies'] ?? true),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function user_public(array $u): array
{
    return [
        'id' => $u['id'],
        'email' => $u['email'],
        'name' => $u['name'],
        'role' => $u['role'],
        'active' => (bool) (int) $u['active'],
        'mustChangePassword' => (bool) (int) $u['must_change_password'],
        'createdAt' => $u['created_at'],
        'lastLoginAt' => $u['last_login_at'],
    ];
}

/** The signed-in user, or null. Enforces idle timeout and disabled accounts. */
function current_user(): ?array
{
    static $cached = false;
    if ($cached !== false) {
        return $cached;
    }
    $cached = null;
    $id = $_SESSION['uid'] ?? null;
    if (!$id) {
        return null;
    }
    $idle = (int) (config()['idle_timeout'] ?? 43200);
    if (time() - (int) ($_SESSION['seen'] ?? 0) > $idle) {
        sign_out();
        return null;
    }
    $u = q('SELECT * FROM users WHERE id = ?', [$id])->fetch();
    if (!$u || !(int) $u['active']) {
        sign_out();
        return null;
    }
    $_SESSION['seen'] = time();
    return $cached = $u;
}

function require_user(): array
{
    return current_user() ?? fail(401, 'Your session has ended. Sign in again.');
}

function can(string $role, string $action): bool
{
    return match ($action) {
        'read' => in_array($role, ROLES, true),
        'write' => in_array($role, ['admin', 'owner', 'editor'], true),
        'settings', 'manageUsers', 'resetData' => in_array($role, ['admin', 'owner'], true),
        default => false,
    };
}

function require_can(string $action): array
{
    $u = require_user();
    if ((int) $u['must_change_password'] && $action !== 'read') {
        fail(403, 'Change your temporary password before making changes.');
    }
    if (!can($u['role'], $action)) {
        $msg = match ($action) {
            'write' => 'Your account is view-only, so it can’t make changes.',
            default => 'Only Admins and Owners can do that.',
        };
        fail(403, $msg);
    }
    return $u;
}

function assignable_roles(string $actorRole): array
{
    return match ($actorRole) {
        'admin' => ROLES,
        'owner' => ['owner', 'editor', 'viewer'],
        default => [],
    };
}

/** Whether $actor may change or remove $target (never themselves). */
function can_manage_user(array $actor, array $target): bool
{
    if ($actor['id'] === $target['id'] || !can($actor['role'], 'manageUsers')) {
        return false;
    }
    return $actor['role'] === 'admin' || $target['role'] !== 'admin';
}

// ---------------- Sign-in ----------------

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function too_many_attempts(string $email): bool
{
    $since = time() - LOGIN_WINDOW_SECONDS;
    q('DELETE FROM login_attempts WHERE attempted_at < ?', [$since]);
    $byPair = (int) q('SELECT COUNT(*) AS n FROM login_attempts WHERE attempt_key = ?', [client_ip() . '|' . $email])->fetch()['n'];
    $byIp = (int) q('SELECT COUNT(*) AS n FROM login_attempts WHERE attempt_key LIKE ?', [client_ip() . '|%'])->fetch()['n'];
    return $byPair >= MAX_FAILED_LOGINS || $byIp >= MAX_FAILED_LOGINS * 4;
}

function sign_in(string $email, string $password): array
{
    $email = strtolower(trim($email));
    if ($email === '' || $password === '') {
        fail(422, 'Enter your email and password.');
    }
    if (too_many_attempts($email)) {
        fail(429, 'Too many failed attempts. Wait 15 minutes and try again.');
    }
    $u = q('SELECT * FROM users WHERE email = ?', [$email])->fetch();
    // Always run a hash check so response time doesn't reveal which emails exist.
    $hash = $u['password_hash'] ?? password_hash(random_password(), PASSWORD_DEFAULT);
    $ok = password_verify($password, $hash) && $u && (int) $u['active'];
    if (!$ok) {
        q('INSERT INTO login_attempts (attempt_key, attempted_at) VALUES (?, ?)', [client_ip() . '|' . $email, time()]);
        fail(401, 'That email and password don’t match. Check both and try again.');
    }
    q('DELETE FROM login_attempts WHERE attempt_key = ?', [client_ip() . '|' . $email]);
    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $u['id']]);
    }
    $ts = now_iso();
    q('UPDATE users SET last_login_at = ? WHERE id = ?', [$ts, $u['id']]);
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    $_SESSION['seen'] = time();
    $u['last_login_at'] = $ts;
    return user_public($u);
}

function sign_out(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function validate_new_password(string $password): void
{
    if (mb_strlen($password) < 10) {
        fail(422, 'Use at least 10 characters.', ['newPassword' => 'Use at least 10 characters.']);
    }
    if (mb_strlen($password) > 200) {
        fail(422, 'That password is too long.', ['newPassword' => 'That password is too long.']);
    }
}

function change_password(array $user, string $current, string $new): array
{
    if (!password_verify($current, $user['password_hash'])) {
        fail(422, 'Your current password is not correct.', ['currentPassword' => 'Your current password is not correct.']);
    }
    validate_new_password($new);
    if ($current === $new) {
        fail(422, 'Choose a password different from the current one.', ['newPassword' => 'Choose a different password.']);
    }
    q('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), now_iso(), $user['id']]);
    session_regenerate_id(true);
    return user_public(q('SELECT * FROM users WHERE id = ?', [$user['id']])->fetch());
}

// ---------------- User management ----------------

function list_users(): array
{
    return array_map('user_public', q('SELECT * FROM users ORDER BY created_at')->fetchAll());
}

function find_user(string $id): array
{
    return q('SELECT * FROM users WHERE id = ?', [$id])->fetch() ?: fail(404, 'That user was not found.');
}

function validate_user_input(array $d, bool $creating): array
{
    $errors = [];
    $out = [];
    if ($creating || array_key_exists('email', $d)) {
        $email = strtolower(trim((string) ($d['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email';
        }
        $out['email'] = $email;
    }
    if ($creating || array_key_exists('name', $d)) {
        $name = trim((string) ($d['name'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120) {
            $errors['name'] = 'Enter a name';
        }
        $out['name'] = $name;
    }
    if ($creating || array_key_exists('role', $d)) {
        if (!in_array($d['role'] ?? null, ROLES, true)) {
            $errors['role'] = 'Choose a role';
        }
        $out['role'] = $d['role'] ?? null;
    }
    if (array_key_exists('active', $d)) {
        $out['active'] = (bool) $d['active'];
    }
    if ($errors) {
        fail(422, reset($errors), $errors);
    }
    return $out;
}

function active_admin_count(): int
{
    return (int) q("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")->fetch()['n'];
}

function create_user(array $actor, array $input, ?string $password = null): array
{
    $d = validate_user_input($input, true);
    if (!in_array($d['role'], assignable_roles($actor['role']), true)) {
        fail(403, 'Owners can’t assign the Admin role.', ['role' => 'You can’t assign this role.']);
    }
    if (q('SELECT id FROM users WHERE email = ?', [$d['email']])->fetch()) {
        fail(409, 'A user with that email already exists.', ['email' => 'Already in use']);
    }
    $password ??= random_password();
    $ts = now_iso();
    $max = 0;
    foreach (q('SELECT id FROM users')->fetchAll() as $r) {
        $max = max($max, (int) substr($r['id'], 2));
    }
    $id = 'U-' . str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    q(
        'INSERT INTO users (id, email, name, role, password_hash, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)',
        [$id, $d['email'], $d['name'], $d['role'], password_hash($password, PASSWORD_DEFAULT), $ts, $ts],
    );
    return ['user' => user_public(find_user($id)), 'temporaryPassword' => $password];
}

function update_user(array $actor, string $id, array $patch): array
{
    $target = find_user($id);
    $d = validate_user_input($patch, false);
    $isSelf = $actor['id'] === $target['id'];
    $changesAccess = isset($d['role']) && $d['role'] !== $target['role'] || (isset($d['active']) && $d['active'] !== (bool) (int) $target['active']);

    if ($isSelf && $changesAccess) {
        fail(403, 'You can’t change your own role or disable your own account.');
    }
    if (!$isSelf && !can_manage_user($actor, $target)) {
        fail(403, 'Only Admins can change Admin accounts.');
    }
    if (isset($d['role']) && $d['role'] !== $target['role'] && !in_array($d['role'], assignable_roles($actor['role']), true)) {
        fail(403, 'Owners can’t assign the Admin role.', ['role' => 'You can’t assign this role.']);
    }
    if ($target['role'] === 'admin' && (int) $target['active'] && active_admin_count() <= 1
        && ((isset($d['role']) && $d['role'] !== 'admin') || (isset($d['active']) && !$d['active']))) {
        fail(409, 'Keep at least one active Admin.');
    }
    if (isset($d['email']) && $d['email'] !== $target['email'] && q('SELECT id FROM users WHERE email = ?', [$d['email']])->fetch()) {
        fail(409, 'A user with that email already exists.', ['email' => 'Already in use']);
    }
    $merged = array_merge([
        'email' => $target['email'], 'name' => $target['name'], 'role' => $target['role'], 'active' => (bool) (int) $target['active'],
    ], $d);
    q(
        'UPDATE users SET email = ?, name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?',
        [$merged['email'], $merged['name'], $merged['role'], $merged['active'] ? 1 : 0, now_iso(), $id],
    );
    return user_public(find_user($id));
}

function reset_user_password(array $actor, string $id): array
{
    $target = find_user($id);
    if (!can_manage_user($actor, $target)) {
        fail(403, $actor['id'] === $id ? 'Use “Change password” for your own account.' : 'Only Admins can change Admin accounts.');
    }
    $password = random_password();
    q('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), now_iso(), $id]);
    return ['temporaryPassword' => $password];
}

function delete_user(array $actor, string $id): void
{
    $target = find_user($id);
    if ($actor['id'] === $id) {
        fail(403, 'You can’t delete your own account.');
    }
    if (!can_manage_user($actor, $target)) {
        fail(403, 'Only Admins can change Admin accounts.');
    }
    if ($target['role'] === 'admin' && (int) $target['active'] && active_admin_count() <= 1) {
        fail(409, 'Keep at least one active Admin.');
    }
    q('DELETE FROM users WHERE id = ?', [$id]);
}
