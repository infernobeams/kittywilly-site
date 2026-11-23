<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
$lvl = user_level_info( $info );
$level = (int) $lvl[ "level" ];
$progress = (float) $lvl[ "progress" ];

$payload = [
    "name" => $info[ "discord_username" ] ?? "User",
    "avatar" => discord_avatar_url( $info, 256 ),
    "level" => "Lvl " . $level,
    "rank" => $info[ "account_rank" ] ?? "Noob",
    "rankKey" => $info[ "account_rank_key" ] ?? "default",
    "progress" => $progress,
];

die( json_encode( $payload, JSON_UNESCAPED_SLASHES ) );
?>
