<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

require_account( true );

$name = trim( (string) ( $_GET[ "name" ] ?? "" ) );
$avatar = $name !== "" ? fetch_roblox_headshot( $name ) : null;

die( json_encode( [
    "avatar" => $avatar,
], JSON_UNESCAPED_SLASHES ) );
?>
