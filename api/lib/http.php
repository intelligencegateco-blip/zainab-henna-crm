<?php
declare(strict_types=1);

/** HTTP helpers: JSON in/out and typed errors. */

final class ApiError extends Exception
{
    public function __construct(public readonly int $status, string $message, public readonly ?array $fields = null)
    {
        parent::__construct($message);
    }
}

function fail(int $status, string $message, ?array $fields = null): never
{
    throw new ApiError($status, $message, $fields);
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if ($status === 204) {
        exit;
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Parsed JSON body; always an array. */
function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail(400, 'The request body must be a JSON object.');
    }
    return $data;
}

function now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function random_password(): string
{
    // Unambiguous characters, grouped for readability: xxxx-xxxx-xxxx-xxxx
    $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $out = '';
    for ($i = 0; $i < 16; $i++) {
        if ($i > 0 && $i % 4 === 0) {
            $out .= '-';
        }
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $out;
}
