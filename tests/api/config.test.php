<?php
// Config for local API tests and `npm run api` development (SQLite file in .tmp/, git-ignored).
$sqlite = getenv('ZCRM_SQLITE') ?: dirname(__DIR__, 2) . '/.tmp/api-dev.sqlite';
@mkdir(dirname($sqlite), 0777, true);

return [
    'db' => ['dsn' => 'sqlite:' . $sqlite],
    'setup_token' => 'local-test-setup-token',
    'secure_cookies' => false,
    'idle_timeout' => 43200,
];
