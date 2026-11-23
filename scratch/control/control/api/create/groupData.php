<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );

die( json_encode( [
    "group" => [
        "name" => $info[ "group_name" ] ?? "",
        "owner" => $info[ "group_owner_name" ] ?? "",
        "thumbnail" => $info[ "group_thumbnail" ] ?? "",
        "id" => (string) ( (int) ( $info[ "group_fake_id" ] ?? 0 ) ?: (int) ( $info[ "profile_fake_id" ] ?? 0 ) ),
    ],
    "stats" => [
        "members" => (int) ( $info[ "group_members" ] ?? 0 ),
        "funds" => (int) ( $info[ "group_funds" ] ?? 0 ),
    ],
    "shout" => $info[ "group_shout" ] ?? "",
    "description" => $info[ "group_description" ] ?? "",
    "domains" => dashboard_host_list( ),
], JSON_UNESCAPED_SLASHES ) );
?>
