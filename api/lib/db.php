<?php
declare(strict_types=1);

/** PDO connection and schema. SQL is kept portable between MySQL and SQLite. */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $cfg = config()['db'];
    try {
        $pdo = new PDO($cfg['dsn'], $cfg['user'] ?? null, $cfg['password'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException) {
        fail(503, 'The database is not reachable right now. Try again in a minute.');
    }
    if (is_sqlite()) {
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
    return $pdo;
}

function is_sqlite(): bool
{
    return str_starts_with(config()['db']['dsn'], 'sqlite:');
}

function tx(callable $fn): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $fn($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function schema_sql(): array
{
    $text = 'TEXT';
    $money = 'DECIMAL(12,2)';
    $engine = is_sqlite() ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $id = 'VARCHAR(20) NOT NULL PRIMARY KEY';
    $ts = 'VARCHAR(32)';
    return [
        "CREATE TABLE IF NOT EXISTS users (
            id $id, email VARCHAR(190) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
            role VARCHAR(10) NOT NULL, password_hash VARCHAR(255) NOT NULL,
            active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1,
            created_at $ts NOT NULL, updated_at $ts NOT NULL, last_login_at $ts NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS services (
            id $id, name VARCHAR(120) NOT NULL, description $text NOT NULL,
            base_price $money NOT NULL, price_unit VARCHAR(12) NOT NULL, duration_minutes INTEGER NOT NULL,
            active INTEGER NOT NULL, created_at $ts NOT NULL, updated_at $ts NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS contacts (
            id $id, full_name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(190) NULL,
            instagram VARCHAR(120) NULL, location VARCHAR(120) NOT NULL, source VARCHAR(20) NOT NULL,
            service_id VARCHAR(20) NULL, event_type VARCHAR(20) NOT NULL, event_date VARCHAR(10) NULL,
            group_size INTEGER NOT NULL, estimated_value $money NOT NULL, stage VARCHAR(20) NOT NULL,
            stage_updated_at $ts NOT NULL, notes $text NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
            created_at $ts NOT NULL, updated_at $ts NOT NULL, last_contact_at $ts NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS bookings (
            id $id, contact_id VARCHAR(20) NOT NULL, service_id VARCHAR(20) NOT NULL,
            event_type VARCHAR(20) NOT NULL, date VARCHAR(10) NOT NULL, start_time VARCHAR(5) NOT NULL,
            duration_minutes INTEGER NOT NULL, location VARCHAR(200) NOT NULL, group_size INTEGER NOT NULL,
            price $money NOT NULL, deposit $money NOT NULL, balance_paid INTEGER NOT NULL,
            status VARCHAR(12) NOT NULL, notes $text NOT NULL, origin VARCHAR(10) NOT NULL,
            created_at $ts NOT NULL, updated_at $ts NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS interactions (
            id $id, contact_id VARCHAR(20) NOT NULL, type VARCHAR(12) NOT NULL,
            summary $text NOT NULL, occurred_at $ts NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS follow_ups (
            id $id, contact_id VARCHAR(20) NOT NULL, due_date VARCHAR(10) NOT NULL,
            note $text NOT NULL, completed_at $ts NULL, created_at $ts NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS settings (
            id INTEGER NOT NULL PRIMARY KEY, business_name VARCHAR(120) NOT NULL,
            exchange_rate DECIMAL(16,4) NOT NULL, exchange_rate_updated_at $ts NOT NULL,
            currency_display VARCHAR(4) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS login_attempts (
            attempt_key VARCHAR(255) NOT NULL, attempted_at INTEGER NOT NULL
        )$engine",
    ];
}

function create_schema(): void
{
    foreach (schema_sql() as $sql) {
        db()->exec($sql);
    }
    $exists = q('SELECT COUNT(*) AS n FROM settings')->fetch()['n'];
    if ((int) $exists === 0) {
        q(
            'INSERT INTO settings (id, business_name, exchange_rate, exchange_rate_updated_at, currency_display) VALUES (1, ?, ?, ?, ?)',
            ['Zainab Henna', 190, now_iso(), 'both'],
        );
    }
}

function schema_ready(): bool
{
    try {
        q('SELECT 1 FROM users LIMIT 1');
        return true;
    } catch (PDOException) {
        return false;
    }
}
