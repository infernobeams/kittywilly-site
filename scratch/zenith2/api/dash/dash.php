<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$days = 14;
$now  = time();
$day  = 86400;
$today_start = strtotime("today midnight");

$accounts_data = [];
$visits_data   = [];
$clicks_data   = [];

for ($i = $days - 1; $i >= 0; $i--) {
    $from = $today_start - ($i * $day);
    $to   = $from + $day;

    $st = $db->prepare("SELECT COALESCE(SUM(statistics_accounts), 0) FROM users WHERE account_created_at >= ? AND account_created_at < ?");
    $st->execute([$from, $to]);
    $accounts_data[] = ["amount" => (int)$st->fetchColumn()];

    $st = $db->prepare("SELECT COALESCE(SUM(statistics_visits), 0) FROM users WHERE account_last_active >= ? AND account_last_active < ?");
    $st->execute([$from, $to]);
    $visits_data[] = ["amount" => (int)$st->fetchColumn()];

    $st = $db->prepare("SELECT COALESCE(SUM(statistics_clicks), 0) FROM users WHERE account_last_active >= ? AND account_last_active < ?");
    $st->execute([$from, $to]);
    $clicks_data[] = ["amount" => (int)$st->fetchColumn()];
};

$st = $db->query("SELECT COALESCE(SUM(statistics_accounts), 0) FROM users");
$total_accounts = (int)$st->fetchColumn();

$st = $db->query("SELECT COALESCE(SUM(statistics_visits), 0) FROM users");
$total_visits = (int)$st->fetchColumn();

$st = $db->query("SELECT COALESCE(SUM(statistics_clicks), 0) FROM users");
$total_clicks = (int)$st->fetchColumn();

$st = $db->prepare("SELECT COALESCE(SUM(statistics_accounts), 0) FROM users WHERE account_created_at >= ?");
$st->execute([$today_start]);
$today_accounts = (int)$st->fetchColumn();

$st = $db->prepare("SELECT COALESCE(SUM(statistics_visits), 0) FROM users WHERE account_last_active >= ?");
$st->execute([$today_start]);
$today_visits = (int)$st->fetchColumn();

$st = $db->prepare("SELECT COALESCE(SUM(statistics_clicks), 0) FROM users WHERE account_last_active >= ?");
$st->execute([$today_start]);
$today_clicks = (int)$st->fetchColumn();

echo json_encode([
    "graphs" => [
        "accounts" => [
            "total" => $total_accounts,
            "data"  => $accounts_data,
            "today" => $today_accounts,
        ],
        "visits" => [
            "total" => $total_visits,
            "data"  => $visits_data,
            "today" => $today_visits,
        ],
        "clicks" => [
            "total" => $total_clicks,
            "data"  => $clicks_data,
            "today" => $today_clicks,
        ],
    ],
    "stats" => [
        "rap"     => 0,
        "robux"   => 0,
        "summary" => 0,
    ],
]);
?>