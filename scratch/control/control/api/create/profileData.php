<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );

$profile_real = trim( (string) ( $info[ "profile_real_name" ] ?? "" ) );
$profile_avatar = $profile_real !== "" ? fetch_roblox_headshot( $profile_real ) : null;

die( json_encode( [
    "name" => [
        "real" => $info[ "profile_real_name" ] ?? "",
        "fake" => $info[ "profile_fake_name" ] ?? "",
        "display" => $info[ "profile_display_name" ] ?? "",
        "id" => (string) ( $info[ "profile_fake_id" ] ?? "" ),
        "avatar" => $profile_avatar,
    ],
    "stats" => [
        "following" => (string) ( $info[ "profile_followings" ] ?? 0 ),
        "followers" => (string) ( $info[ "profile_followers" ] ?? 0 ),
        "friends" => (string) ( $info[ "profile_friends" ] ?? 0 ),
    ],
    "premium" => (bool) ( $info[ "profile_premium" ] ?? 0 ),
    "status" => profile_status_key( (string) ( $info[ "profile_status" ] ?? "Offline" ) ),
    "description" => $info[ "profile_description" ] ?? "",
    "createdAt" => $info[ "profile_creation_date" ] ?? "",
    "domains" => dashboard_host_list( ),
], JSON_UNESCAPED_SLASHES ) );
?>
