<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/function.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
connect( );

global $db;

function chat_row_to_json( array $row, bool $is_admin ): array
{
    $rank = resolve_account_rank(
        (string) ( $row[ "discord_id" ] ?? "" ),
        (string) ( $row[ "account_rank" ] ?? "Noob" )
    );

    $text = (string) ( $row[ "message" ] ?? "" );
    if ( chat_message_violation( $text ) !== null )
    {
        $text = "[removed]";
    };

    return [
        "id" => (string) $row[ "id" ],
        "username" => $row[ "discord_username" ],
        "message" => $text,
        "level" => (int) $row[ "account_level" ],
        "rank" => $rank[ "label" ],
        "rankKey" => $rank[ "key" ],
        "avatarUrl" => discord_avatar_url( $row, 128 ),
        "time" => chat_time_label( (int) $row[ "created_at" ] ),
        "isAdmin" => $is_admin,
    ];
};

$viewer_level = (int) ( $info[ "account_level" ] ?? 1 );
$is_admin = $viewer_level >= 100;

if ( $_SERVER[ "REQUEST_METHOD" ] === "POST" )
{
    $body = json_decode( file_get_contents( "php://input" ), true );
    $message = isset( $body[ "message" ] ) ? trim( (string) $body[ "message" ] ) : "";

    if ( $message === "" )
    {
        http_response_code( 400 );
        die( json_encode( [ "success" => false, "message" => "Empty message" ] ) );
    };

    if ( mb_strlen( $message ) > 500 )
    {
        http_response_code( 400 );
        die( json_encode( [ "success" => false, "message" => "Message too long" ] ) );
    };

    $message = strip_tags( $message );
    $message = preg_replace( "/https?:\/\/\S+/i", "[URL Blocked]", $message );
    $message = preg_replace( "/www\.\S+/i", "[URL Blocked]", $message );
    $message = preg_replace( "/[^\x20-\x7E\s]/u", "", $message );
    $message = trim( $message );

    if ( $message === "" )
    {
        http_response_code( 400 );
        die( json_encode( [ "success" => false, "message" => "Empty message" ] ) );
    };

    $violation = chat_message_violation( $message );
    if ( $violation !== null )
    {
        http_response_code( 400 );
        die( json_encode( [ "success" => false, "message" => $violation ] ) );
    };

    $now = time( );
    $st = $db->prepare( "INSERT INTO chat (user_id, message, created_at) VALUES (?, ?, ?)" );
    $st->execute( [ (int) $info[ "id" ], $message, $now ] );

    $new_id = (int) $db->lastInsertId( );
    update_last_active( (int) $info[ "id" ] );

    $row = [
        "id" => $new_id,
        "message" => $message,
        "created_at" => $now,
        "discord_username" => $info[ "discord_username" ] ?? "User",
        "discord_id" => $info[ "discord_id" ] ?? "",
        "discord_avatar" => $info[ "discord_avatar" ] ?? "",
        "account_level" => $info[ "account_level" ] ?? 1,
        "account_rank" => $info[ "account_rank" ] ?? "Noob",
    ];
    $row = apply_account_rank( $row );

    die( json_encode( [
        "success" => true,
        "id" => $new_id,
        "message" => chat_row_to_json( $row, $is_admin ),
    ], JSON_UNESCAPED_SLASHES ) );
};

$after = isset( $_GET[ "after" ] ) ? (int) $_GET[ "after" ] : 0;

$st = $db->prepare( "
    SELECT c.id, c.message, c.created_at, u.discord_username, u.discord_id, u.discord_avatar, u.account_level, u.account_rank
    FROM chat c
    JOIN users u ON u.id = c.user_id
    WHERE c.id > ?
    ORDER BY c.id ASC
    LIMIT 100
" );
$st->execute( [ $after ] );
$rows = $st->fetchAll( );

$out = [ ];

foreach ( $rows as $row )
{
    $out[ ] = chat_row_to_json( $row, $is_admin );
};

die( json_encode( $out, JSON_UNESCAPED_SLASHES ) );
?>