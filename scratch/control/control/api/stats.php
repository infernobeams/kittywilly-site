<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

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

$payload = [
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
];

die( json_encode( $payload, JSON_UNESCAPED_SLASHES ) );
?>