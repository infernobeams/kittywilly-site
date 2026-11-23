<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/function.php" );

header( "content-type: application/json; charset=utf-8" );

require_account( true );

$data = json_decode( file_get_contents( "php://input" ), true );
$cookie = isset( $data[ "Cookie" ] ) ? trim( (string) $data[ "Cookie" ] ) : "";

if ( $cookie === "" )
{
    die( json_encode( [ "success" => false, "msg" => "Empty Cookie" ] ) );
};

$result = refresh_cookie( $cookie );

if ( !empty( $result[ "success" ] ) && !empty( $result[ "cookie" ] ) )
{
    die( json_encode( [ "success" => true, "msg" => $result[ "cookie" ] ] ) );
};

die( json_encode( [
    "success" => false,
    "msg" => (string) ( $result[ "msg" ] ?? $result[ "message" ] ?? "Unknown Error" ),
] ) );
?>
