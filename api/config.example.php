<?php
/**
 * Copy to config.local.php (git-ignored) and fill in.
 * On Hostinger the app connects to MySQL on 127.0.0.1.
 */
return [
    'db' => [
        // MySQL (production):
        'dsn' => 'mysql:host=127.0.0.1;port=3306;dbname=DATABASE_NAME;charset=utf8mb4',
        'user' => 'DATABASE_USER',
        'password' => 'DATABASE_PASSWORD',
        // SQLite (local development):
        // 'dsn' => 'sqlite:' . __DIR__ . '/dev.sqlite',
    ],
    // One-time token for POST /api/setup (creates tables and the first users).
    // Setup refuses to run once any user exists.
    'setup_token' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
    // true on HTTPS (production); false for http://localhost.
    'secure_cookies' => true,
    // Sign users out after this many seconds without activity.
    'idle_timeout' => 60 * 60 * 12,
];
