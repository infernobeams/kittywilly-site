<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
connect( );

global $db;

$page = isset( $_GET[ "page" ] ) ? max( 1, (int) $_GET[ "page" ] ) : 1;
$limit = 20;
$offset = ( $page - 1 ) * $limit;
$owner_id = (int) $info[ "id" ];

$count_stmt = $db->prepare( "SELECT COUNT(*) FROM user_visits WHERE owner_id = ? AND type <> 'log'" );
$count_stmt->execute( [ $owner_id ] );
$total_visits = (int) $count_stmt->fetchColumn( );
$total_pages = max( 1, (int) ceil( $total_visits / $limit ) );

if ( $total_visits === 0 )
{
    die( json_encode( [
        "logs" => [ ],
        "pages" => 1,
    ], JSON_UNESCAPED_SLASHES ) );
};

$stmt = $db->prepare( "
    SELECT id, ip, country, city, url, type, visited_at
    FROM user_visits
    WHERE owner_id = ? AND type <> 'log'
    ORDER BY visited_at DESC
    LIMIT ? OFFSET ?
" );
$stmt->bindValue( 1, $owner_id, PDO::PARAM_INT );
$stmt->bindValue( 2, $limit, PDO::PARAM_INT );
$stmt->bindValue( 3, $offset, PDO::PARAM_INT );
$stmt->execute( );
$rows = $stmt->fetchAll( );

$host = strtolower( (string) ( $_SERVER[ "HTTP_HOST" ] ?? "localhost" ) );
if ( strpos( $host, ":" ) !== false )
{
    $host = explode( ":", $host, 2 )[ 0 ];
};

$logs = [ ];

foreach ( $rows as $visit )
{
    $path = (string) ( $visit[ "url" ] ?? "" );
    if ( $path !== "" && $path[ 0 ] !== "/" )
    {
        $path = "/" . $path;
    };

    $logs[ ] = [
        "user" => [
            "ip" => $visit[ "ip" ] ?? "",
            "country" => $visit[ "country" ] ?? "",
            "city" => $visit[ "city" ] ?? "",
        ],
        "date" => date( "Y-m-d H:i:s", (int) ( $visit[ "visited_at" ] ?? 0 ) ),
        "link" => [
            "type" => $visit[ "type" ] ?? "",
            "url" => "https://" . $host . $path,
        ],
    ];
};

die( json_encode( [
    "logs" => $logs,
    "pages" => $total_pages,
], JSON_UNESCAPED_SLASHES ) );
?>
