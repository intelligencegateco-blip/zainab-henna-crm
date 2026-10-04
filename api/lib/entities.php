<?php
declare(strict_types=1);

/**
 * CRM entities: column mapping (camelCase JSON <-> snake_case SQL), validation
 * mirroring src/lib/validation.ts, and generic create/update/delete.
 */

const SOURCES = ['instagram', 'whatsapp', 'website', 'facebook', 'referral', 'walk_in', 'other'];
const EVENT_TYPES = ['wedding', 'bridal', 'birthday', 'party', 'baby_shower', 'graduation', 'photoshoot', 'festival', 'individual', 'other'];
const STAGES = ['new_inquiry', 'contacted', 'consultation', 'quote_sent', 'awaiting_response', 'deposit_pending', 'booking_confirmed', 'completed', 'cancelled', 'lost'];
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const INTERACTION_TYPES = ['whatsapp', 'instagram', 'call', 'email', 'in_person', 'note', 'system'];

/** field => [column, type]. Types: str, ?str, int, money, bool */
const ENTITIES = [
    'contacts' => [
        'label' => 'Customer', 'prefix' => 'C', 'pad' => 4, 'start' => 1001,
        'fields' => [
            'fullName' => ['full_name', 'str'], 'phone' => ['phone', 'str'], 'email' => ['email', '?str'],
            'instagram' => ['instagram', '?str'], 'location' => ['location', 'str'], 'source' => ['source', 'str'],
            'serviceId' => ['service_id', '?str'], 'eventType' => ['event_type', 'str'], 'eventDate' => ['event_date', '?str'],
            'groupSize' => ['group_size', 'int'], 'estimatedValue' => ['estimated_value', 'money'], 'stage' => ['stage', 'str'],
            'stageUpdatedAt' => ['stage_updated_at', 'str'], 'notes' => ['notes', 'str'], 'archived' => ['archived', 'bool'],
            'createdAt' => ['created_at', 'str'], 'updatedAt' => ['updated_at', 'str'], 'lastContactAt' => ['last_contact_at', '?str'],
        ],
    ],
    'bookings' => [
        'label' => 'Booking', 'prefix' => 'B', 'pad' => 4, 'start' => 2001,
        'fields' => [
            'contactId' => ['contact_id', 'str'], 'serviceId' => ['service_id', 'str'], 'eventType' => ['event_type', 'str'],
            'date' => ['date', 'str'], 'startTime' => ['start_time', 'str'], 'durationMinutes' => ['duration_minutes', 'int'],
            'location' => ['location', 'str'], 'groupSize' => ['group_size', 'int'], 'price' => ['price', 'money'],
            'deposit' => ['deposit', 'money'], 'balancePaid' => ['balance_paid', 'bool'], 'status' => ['status', 'str'],
            'notes' => ['notes', 'str'], 'origin' => ['origin', 'str'], 'createdAt' => ['created_at', 'str'], 'updatedAt' => ['updated_at', 'str'],
        ],
    ],
    'services' => [
        'label' => 'Service', 'prefix' => 'S', 'pad' => 2, 'start' => 1,
        'fields' => [
            'name' => ['name', 'str'], 'description' => ['description', 'str'], 'basePrice' => ['base_price', 'money'],
            'priceUnit' => ['price_unit', 'str'], 'durationMinutes' => ['duration_minutes', 'int'], 'active' => ['active', 'bool'],
            'createdAt' => ['created_at', 'str'], 'updatedAt' => ['updated_at', 'str'],
        ],
    ],
    'interactions' => [
        'label' => 'Interaction', 'prefix' => 'I', 'pad' => 4, 'start' => 1,
        'fields' => [
            'contactId' => ['contact_id', 'str'], 'type' => ['type', 'str'], 'summary' => ['summary', 'str'], 'occurredAt' => ['occurred_at', 'str'],
        ],
    ],
    'follow_ups' => [
        'label' => 'Follow-up', 'prefix' => 'F', 'pad' => 4, 'start' => 1,
        'fields' => [
            'contactId' => ['contact_id', 'str'], 'dueDate' => ['due_date', 'str'], 'note' => ['note', 'str'],
            'completedAt' => ['completed_at', '?str'], 'createdAt' => ['created_at', 'str'],
        ],
    ],
];

function row_to_entity(string $entity, array $row): array
{
    $out = ['id' => $row['id']];
    foreach (ENTITIES[$entity]['fields'] as $field => [$col, $type]) {
        $v = $row[$col] ?? null;
        if ($v === null) {
            continue; // optional fields are omitted, like `undefined` in the TypeScript model
        }
        $out[$field] = match ($type) {
            'int' => (int) $v,
            'money' => round((float) $v, 2),
            'bool' => (bool) (int) $v,
            default => (string) $v,
        };
    }
    return $out;
}

function list_entities(string $entity, string $order = 'id'): array
{
    $rows = q('SELECT * FROM ' . $entity . ' ORDER BY ' . $order)->fetchAll();
    return array_map(fn ($r) => row_to_entity($entity, $r), $rows);
}

function find_entity(string $entity, string $id): ?array
{
    $row = q('SELECT * FROM ' . $entity . ' WHERE id = ?', [$id])->fetch();
    return $row ? row_to_entity($entity, $row) : null;
}

function require_entity(string $entity, string $id): array
{
    return find_entity($entity, $id) ?? fail(404, ENTITIES[$entity]['label'] . " $id was not found. It may have been deleted.");
}

function next_id(string $entity): string
{
    $meta = ENTITIES[$entity];
    $max = $meta['start'] - 1;
    foreach (q('SELECT id FROM ' . $entity)->fetchAll() as $r) {
        $n = (int) substr($r['id'], strlen($meta['prefix']) + 1);
        $max = max($max, $n);
    }
    return $meta['prefix'] . '-' . str_pad((string) ($max + 1), $meta['pad'], '0', STR_PAD_LEFT);
}

function write_entity(string $entity, array $data, bool $insert): void
{
    $cols = ['id'];
    $vals = [$data['id']];
    foreach (ENTITIES[$entity]['fields'] as $field => [$col, $type]) {
        $v = $data[$field] ?? null;
        if ($v !== null) {
            $v = match ($type) {
                'int' => (int) $v,
                'money' => round((float) $v, 2),
                'bool' => $v ? 1 : 0,
                default => (string) $v,
            };
        }
        $cols[] = $col;
        $vals[] = $v;
    }
    if ($insert) {
        $sql = 'INSERT INTO ' . $entity . ' (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
        q($sql, $vals);
    } else {
        $sets = implode(',', array_map(fn ($c) => "$c = ?", array_slice($cols, 1)));
        q('UPDATE ' . $entity . " SET $sets WHERE id = ?", [...array_slice($vals, 1), $data['id']]);
    }
}

// ---------------- Validation ----------------

final class V
{
    public array $errors = [];
    public function __construct(public array $d) {}

    public function err(string $f, string $m): void
    {
        $this->errors[$f] ??= $m;
    }
    public function str(string $f, int $min, int $max, string $msg): void
    {
        $v = trim((string) ($this->d[$f] ?? ''));
        $this->d[$f] = $v;
        if (mb_strlen($v) < $min || mb_strlen($v) > $max) {
            $this->err($f, $msg);
        }
    }
    public function optStr(string $f, int $max): void
    {
        $v = isset($this->d[$f]) ? trim((string) $this->d[$f]) : '';
        $this->d[$f] = $v === '' ? null : $v;
        if (mb_strlen($v) > $max) {
            $this->err($f, "Keep this under $max characters");
        }
    }
    public function enum(string $f, array $allowed): void
    {
        if (!in_array($this->d[$f] ?? null, $allowed, true)) {
            $this->err($f, 'Choose one of the listed options');
        }
    }
    public function num(string $f, float $min, float $max, string $msg, bool $int = false): void
    {
        $v = $this->d[$f] ?? null;
        if (!is_numeric($v) || (float) $v < $min || (float) $v > $max || ($int && floor((float) $v) != (float) $v)) {
            $this->err($f, $msg);
            return;
        }
        $this->d[$f] = $int ? (int) $v : (float) $v;
    }
    public function date(string $f, bool $optional = false): void
    {
        $v = $this->d[$f] ?? null;
        if ($optional && ($v === null || $v === '')) {
            $this->d[$f] = null;
            return;
        }
        if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
            $this->err($f, 'Use a valid date');
        }
    }
    public function bool(string $f): void
    {
        $this->d[$f] = (bool) ($this->d[$f] ?? false);
    }
    public function done(): array
    {
        if ($this->errors) {
            fail(422, reset($this->errors), $this->errors);
        }
        return $this->d;
    }
}

function validate_phone(V $v): void
{
    $phone = trim((string) ($v->d['phone'] ?? ''));
    $v->d['phone'] = $phone;
    $digits = strlen(preg_replace('/\D/', '', $phone));
    if ($phone === '') {
        $v->err('phone', 'Phone number is required');
    } elseif (!preg_match('/^[+()\d\s-]+$/', $phone)) {
        $v->err('phone', 'Use digits, spaces, + or -');
    } elseif ($digits < 7 || $digits > 20) {
        $v->err('phone', 'Phone number looks too short or too long');
    }
}

function validate_entity(string $entity, array $d): array
{
    $v = new V($d);
    switch ($entity) {
        case 'contacts':
            $v->str('fullName', 2, 120, 'Enter the full name');
            validate_phone($v);
            $v->optStr('email', 190);
            if ($v->d['email'] !== null && !filter_var($v->d['email'], FILTER_VALIDATE_EMAIL)) {
                $v->err('email', 'Enter a valid email');
            }
            $v->optStr('instagram', 120);
            $v->str('location', 1, 120, 'Choose a location');
            $v->enum('source', SOURCES);
            $v->optStr('serviceId', 20);
            if ($v->d['serviceId'] !== null && !find_entity('services', $v->d['serviceId'])) {
                $v->err('serviceId', 'That service no longer exists');
            }
            $v->enum('eventType', EVENT_TYPES);
            $v->date('eventDate', true);
            $v->num('groupSize', 1, 500, 'At least 1 person', true);
            $v->num('estimatedValue', 0, 1_000_000, 'Amount cannot be negative');
            $v->enum('stage', STAGES);
            $v->d['notes'] = mb_substr((string) ($v->d['notes'] ?? ''), 0, 4000);
            $v->bool('archived');
            $v->optStr('lastContactAt', 32);
            break;
        case 'bookings':
            if (!find_entity('contacts', (string) ($d['contactId'] ?? ''))) {
                $v->err('contactId', 'Choose a customer');
            }
            if (!find_entity('services', (string) ($d['serviceId'] ?? ''))) {
                $v->err('serviceId', 'Choose a service');
            }
            $v->enum('eventType', EVENT_TYPES);
            $v->date('date');
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) ($d['startTime'] ?? ''))) {
                $v->err('startTime', 'Use a time like 14:30');
            }
            $v->num('durationMinutes', 10, 1440, 'At least 10 minutes', true);
            $v->str('location', 1, 200, 'Enter where the appointment happens');
            $v->num('groupSize', 1, 500, 'At least 1 person', true);
            $v->num('price', 0, 1_000_000, 'Amount cannot be negative');
            $v->num('deposit', 0, 1_000_000, 'Amount cannot be negative');
            if (!isset($v->errors['deposit']) && !isset($v->errors['price']) && ($v->d['deposit'] ?? 0) > ($v->d['price'] ?? 0)) {
                $v->err('deposit', 'Deposit cannot exceed the price');
            }
            $v->bool('balancePaid');
            $v->enum('status', BOOKING_STATUSES);
            $v->d['notes'] = mb_substr((string) ($v->d['notes'] ?? ''), 0, 4000);
            $v->enum('origin', ['pipeline', 'manual', 'website']);
            break;
        case 'services':
            $v->str('name', 2, 80, 'Enter a service name');
            $v->d['description'] = mb_substr(trim((string) ($d['description'] ?? '')), 0, 600);
            $v->num('basePrice', 0, 1_000_000, 'Amount cannot be negative');
            $v->enum('priceUnit', ['flat', 'per_person']);
            $v->num('durationMinutes', 5, 1440, 'At least 5 minutes', true);
            $v->bool('active');
            break;
        case 'interactions':
            if (!find_entity('contacts', (string) ($d['contactId'] ?? ''))) {
                $v->err('contactId', 'Customer not found');
            }
            $v->enum('type', INTERACTION_TYPES);
            $v->str('summary', 2, 2000, 'Write a short summary');
            $v->str('occurredAt', 10, 32, 'Enter when it happened');
            break;
        case 'follow_ups':
            if (!find_entity('contacts', (string) ($d['contactId'] ?? ''))) {
                $v->err('contactId', 'Customer not found');
            }
            $v->date('dueDate');
            $v->d['note'] = mb_substr(trim((string) ($d['note'] ?? '')), 0, 500);
            $v->optStr('completedAt', 32);
            break;
    }
    return $v->done();
}

/** Only known fields are taken from client input; ids and timestamps are server-owned. */
function pick_fields(string $entity, array $input): array
{
    $allowed = array_keys(ENTITIES[$entity]['fields']);
    $server = ['createdAt', 'updatedAt', 'stageUpdatedAt'];
    return array_intersect_key($input, array_flip(array_diff($allowed, $server)));
}

function create_entity(string $entity, array $input): array
{
    return tx(function () use ($entity, $input) {
        $ts = now_iso();
        $data = pick_fields($entity, $input);
        if ($entity === 'contacts') {
            $data['archived'] ??= false;
            $data['stageUpdatedAt'] = $ts;
        }
        $data = validate_entity($entity, $data);
        $data['id'] = next_id($entity);
        if (array_key_exists('createdAt', ENTITIES[$entity]['fields'])) {
            $data['createdAt'] = $ts;
        }
        if (array_key_exists('updatedAt', ENTITIES[$entity]['fields'])) {
            $data['updatedAt'] = $ts;
        }
        if ($entity === 'contacts') {
            $data['stageUpdatedAt'] = $ts;
        }
        write_entity($entity, $data, true);
        return require_entity($entity, $data['id']);
    });
}

function update_entity(string $entity, string $id, array $patch): array
{
    return tx(function () use ($entity, $id, $patch) {
        $current = require_entity($entity, $id);
        $ts = now_iso();
        // A null in the patch clears an optional field, like `undefined` in the client.
        $merged = array_merge($current, pick_fields($entity, $patch));
        $data = validate_entity($entity, $merged);
        $data['id'] = $id;
        foreach (['createdAt', 'stageUpdatedAt'] as $keep) {
            if (isset($current[$keep])) {
                $data[$keep] = $current[$keep];
            }
        }
        if ($entity === 'contacts' && $data['stage'] !== $current['stage']) {
            $data['stageUpdatedAt'] = $ts;
        }
        if (array_key_exists('updatedAt', ENTITIES[$entity]['fields'])) {
            $data['updatedAt'] = $ts;
        }
        write_entity($entity, $data, false);
        return require_entity($entity, $id);
    });
}

function delete_entity(string $entity, string $id): void
{
    tx(function () use ($entity, $id) {
        require_entity($entity, $id);
        if ($entity === 'contacts') {
            foreach (['bookings', 'interactions', 'follow_ups'] as $child) {
                q("DELETE FROM $child WHERE contact_id = ?", [$id]);
            }
        }
        if ($entity === 'services') {
            $n = (int) q('SELECT COUNT(*) AS n FROM bookings WHERE service_id = ?', [$id])->fetch()['n'];
            if ($n > 0) {
                fail(409, 'This service has bookings. Mark it inactive instead of deleting it.');
            }
            q('UPDATE contacts SET service_id = NULL WHERE service_id = ?', [$id]);
        }
        q("DELETE FROM $entity WHERE id = ?", [$id]);
    });
}

// ---------------- Settings & snapshot ----------------

function get_settings(): array
{
    $r = q('SELECT * FROM settings WHERE id = 1')->fetch();
    return [
        'businessName' => $r['business_name'],
        'baseCurrency' => 'USD',
        'exchangeRate' => round((float) $r['exchange_rate'], 4),
        'exchangeRateUpdatedAt' => $r['exchange_rate_updated_at'],
        'currencyDisplay' => $r['currency_display'],
    ];
}

function update_settings(array $patch): array
{
    $cur = get_settings();
    $v = new V(array_merge($cur, array_intersect_key($patch, array_flip(['businessName', 'exchangeRate', 'currencyDisplay']))));
    $v->str('businessName', 1, 120, 'Enter a business name');
    $v->num('exchangeRate', 0.0001, 1_000_000, 'Rate must be above zero');
    $v->enum('currencyDisplay', ['USD', 'VES', 'both']);
    $d = $v->done();
    $updatedAt = (float) $d['exchangeRate'] !== (float) $cur['exchangeRate'] ? now_iso() : $cur['exchangeRateUpdatedAt'];
    q(
        'UPDATE settings SET business_name = ?, exchange_rate = ?, exchange_rate_updated_at = ?, currency_display = ? WHERE id = 1',
        [$d['businessName'], $d['exchangeRate'], $updatedAt, $d['currencyDisplay']],
    );
    return get_settings();
}

function snapshot(): array
{
    return [
        'contacts' => list_entities('contacts'),
        'bookings' => list_entities('bookings'),
        'services' => list_entities('services'),
        'interactions' => list_entities('interactions'),
        'followUps' => list_entities('follow_ups'),
        'settings' => get_settings(),
    ];
}

/**
 * Replace all CRM records (demo reset or clearing data). Records are written
 * as given (ids and timestamps included) after type mapping; users are untouched.
 */
function replace_data(array $input): void
{
    tx(function () use ($input) {
        foreach (['follow_ups', 'interactions', 'bookings', 'contacts', 'services'] as $t) {
            db()->exec("DELETE FROM $t");
        }
        $map = ['services' => 'services', 'contacts' => 'contacts', 'bookings' => 'bookings', 'interactions' => 'interactions', 'followUps' => 'follow_ups'];
        foreach ($map as $key => $entity) {
            foreach (($input[$key] ?? []) as $record) {
                if (!is_array($record) || !isset($record['id']) || !is_string($record['id'])) {
                    fail(422, "Every $key record needs an id.");
                }
                write_entity($entity, $record, true);
            }
        }
        if (isset($input['settings']) && is_array($input['settings'])) {
            update_settings($input['settings']);
        }
    });
}
