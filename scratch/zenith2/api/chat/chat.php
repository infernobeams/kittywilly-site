<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) { http_response_code(401); die(json_encode(["success" => false, "message" => "Unauthorized"])); }

$after = isset($_GET["after"]) ? (int)$_GET["after"] : 0;

$st = $db->prepare("
    SELECT c.id, c.message, c.created_at, u.discord_username, u.discord_id, u.discord_avatar, u.account_level, u.account_rank
    FROM chat c
    JOIN users u ON u.id = c.user_id
    WHERE c.id > ?
    ORDER BY c.id DESC
    LIMIT 50
");
$st->execute([$after]);
$rows = $st->fetchAll();

$out = [];
foreach ($rows as $row) {
    $avatar = !empty($row["discord_avatar"])
        ? "https://cdn.discordapp.com/avatars/" . $row["discord_id"] . "/" . $row["discord_avatar"] . ".png"
        : "https://cdn.discordapp.com/embed/avatars/0.png";

    $age = time() - (int)$row["created_at"];
    if ($age < 60)           { $time = $age . "s"; }
    elseif ($age < 3600)     { $time = floor($age / 60) . "m"; }
    elseif ($age < 86400)    { $time = floor($age / 3600) . "h"; }
    else                     { $time = floor($age / 86400) . "d"; }

    $out[] = [
        "username"  => $row["discord_username"],
        "id"        => (string)$row["id"],
        "message"   => $row["message"],
        "level"     => (int)$row["account_level"],
        "rank"      => $row["account_rank"],
        "avatarUrl" => $avatar,
        "time"      => $time,
        "isAdmin"   => (int)$row["account_level"] >= 100 ? true : false,
    ];
}

die(json_encode($out));
?>