<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );

$payload = [
    "privateServerLinkCode" => $info[ "private_server_code" ] ?? "",
    "domains" => dashboard_host_list( ),
];

die( json_encode( $payload, JSON_UNESCAPED_SLASHES ) );
?>