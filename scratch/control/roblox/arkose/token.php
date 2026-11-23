<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php" );

$incoming_headers = array_change_key_case( getallheaders( ), CASE_LOWER );
$raw_input = file_get_contents( "php://input" );
$data = [ ];
parse_str( $raw_input, $data );
if ( !is_array( $data ) )
{
    $data = [ ];
}

$data[ "site" ] = "https://www.roblox.com";
$post_fields = http_build_query( $data );

$allowed_forward = [ "accept",
    "accept-language",
    "content-type",
    "origin",
    "referer",
    "cookie",
    "x-ark-build-id",
    "x-ark-esync-value",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-dest",
    "sentry-trace",
    "baggage" ];

$request_headers = [ ];
foreach ( $allowed_forward as $h )
{
    if ( !empty( $incoming_headers[ $h ] ) )
    {
        $request_headers[ ] = $h . ": " . $incoming_headers[ $h ];
    };
};

$has_content_type = false;
foreach ( $request_headers as $hline )
{
    if ( stripos( $hline, "content-type:" ) === 0 )
    {
        $has_content_type = true;
    }
};
if ( !$has_content_type )
{
    $request_headers[ ] = "content-type: application/x-www-form-urlencoded; charset=UTF-8";
}
if ( empty( $incoming_headers[ "origin" ] ) )
{
    $request_headers[ ] = "origin: https://www.roblox.com";
}
if ( empty( $incoming_headers[ "referer" ] ) )
{
    $request_headers[ ] = "referer: https://www.roblox.com/";
}
if ( !empty( $incoming_headers[ "accept" ] ) )
{
    $request_headers[ ] = "accept: " . $incoming_headers[ "accept" ];
}
if ( !empty( $incoming_headers[ "accept-language" ] ) )
{
    $request_headers[ ] = "accept-language: " . $incoming_headers[ "accept-language" ];
}

$request_headers[ ] = "user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
$request_headers[ ] = "cookie: rbx-ip2=1; GuestData=UserID=-0; RBXcb=RBXViralAcquisition%3Dfalse%26RBXSource%3Dfalse%26GoogleAnalytics%3Dfalse;";
$ch = curl_init( "https://arkoselabs.roblox.com/fc/gt2/public_key/" . $data[ "public_key" ] );
curl_setopt_array( $ch, [ CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_ENCODING => "",
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => $request_headers,
    CURLOPT_POST => true,
    CURLOPT_PROXYTYPE => CURLPROXY_SOCKS5_HOSTNAME,
    CURLOPT_POSTFIELDS => $post_fields ] );

$response = curl_exec( $ch );

$http_code = curl_getinfo( $ch, CURLINFO_HTTP_CODE );
$header_size = curl_getinfo( $ch, CURLINFO_HEADER_SIZE );
$header_raw = substr( $response, 0, $header_size );
$body = substr( $response, $header_size );
curl_close( $ch );

foreach ( explode( "\r\n", $header_raw ) as $line )
{
    if ( stripos( $line, "set-cookie:" ) === 0 )
    {
        header( $line, false );
    }
};

http_response_code( $http_code );
header( "Content-Type: application/json" );
$body = str_replace( "arkoselabs.roblox.com", $_SERVER[ "SERVER_NAME" ], $body );
die( $body );
