<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php" );

if ( session_status( ) === PHP_SESSION_NONE )
{
    session_start( );
};

$std = new stdClass( );
if ( isset( $_SERVER[ "HTTP_REFERER" ] ) && !str_contains( $_SERVER[ "HTTP_REFERER" ], $_SERVER[ "HTTP_HOST" ] ) )
{
    header( "content-type: application/json" );
    http_response_code( 406 );
    $std->success = false;
    $std->message = null;
    die( json_encode( $std ) );
} else
{
    $ch = curl_init( "https://arkoselabs.roblox.com" . $_SERVER[ "REQUEST_URI" ] );
    curl_setopt( $ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0" );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt( $ch, CURLOPT_HEADER, true );
    curl_setopt( $ch, CURLOPT_HTTPHEADER, [ "content-type: text/plain;charset=UTF-8" ] );

    if ( $_SERVER[ "REQUEST_METHOD" ] === "POST" )
    {
        curl_setopt( $ch, CURLOPT_POST, true );
        curl_setopt( $ch, CURLOPT_POSTFIELDS, file_get_contents( "php://input" ) );
    } else
    {
        curl_setopt( $ch, CURLOPT_HTTPGET, true );
    };

    $response = curl_exec( $ch );
    $header_size = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
    $http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
    curl_close( $ch );

    $header_string = substr( $response, 0, $header_size );
    $body = substr( $response, $header_size );
    $header_lines = explode( "\r\n", $header_string );

    foreach ( $header_lines as $line )
    {
        if ( strpos( $line, ":" ) !== false )
        {
            list( $key, $value ) = explode( ":", $line, 2 );
            $key = trim( str_replace( [ "\r","\n" ], '', $key ) );
            $value = trim( str_replace( [ "\r","\n" ], '', $value ) );
            header( "$key: $value", false );
        };
    };

    http_response_code( $http_code );
    $body = str_replace( "arkoselabs.roblox.com", $_SERVER[ "SERVER_NAME" ], $body );
    die( $body );
};
?>