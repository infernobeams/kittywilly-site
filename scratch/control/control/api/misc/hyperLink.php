<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

require_account( true );

$input = json_decode( file_get_contents( "php://input" ), true );
$url = isset( $input[ "Url" ] ) ? trim( (string) $input[ "Url" ] ) : "";

if ( $url === "" || !filter_var( $url, FILTER_VALIDATE_URL ) )
{
    die( json_encode( [ "success" => false, "msg" => "Check URL Format" ] ) );
};

$ch = curl_init( "https://linkurl.pk/e/?url=" . urlencode( $url ) );
curl_setopt_array( $ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
] );
apply_site_proxy( $ch );
$response = curl_exec( $ch );

if ( curl_errno( $ch ) )
{
    curl_close( $ch );
    die( json_encode( [ "success" => false, "msg" => "Unknown Error" ] ) );
};

curl_close( $ch );

$json = json_decode( (string) $response, true );

if ( empty( $json[ "url" ] ) )
{
    die( json_encode( [ "success" => false, "msg" => "Unknown Error" ] ) );
};

$safe_url = str_replace( "://", "*:*//", $url );

die( json_encode( [
    "success" => true,
    "msg" => "[" . str_replace( $_SERVER[ "SERVER_NAME" ], "www.roblox.com", $safe_url ) . "](" . $json[ "url" ] . ")",
] ) );
?>
