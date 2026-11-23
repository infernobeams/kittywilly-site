<?php
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$st = $db->prepare("SELECT discord_username, discord_avatar, discord_id, account_level, statistics_visits, account_last_active FROM users WHERE account_banned = 0 ORDER BY account_level DESC, statistics_visits DESC LIMIT 100");
$st->execute();
$rows = $st->fetchAll();

$out = [];
foreach ($rows as $row) {
    $avatar = !empty($row["discord_avatar"])
        ? "https://cdn.discordapp.com/avatars/" . $row["discord_id"] . "/" . $row["discord_avatar"] . ".png?size=256"
        : "https://cdn.discordapp.com/embed/avatars/0.png";
    $out[] = [
        "level"   => (int)$row["account_level"],
        "cookies" => (int)$row["statistics_hits"],
        "user"    => [
            "display" => $row["discord_username"],
            "username"=> $row["discord_username"],
            "avatar"  => $avatar,
            "online"  => (time() - (int)$row["account_last_active"]) < 60,
        ],
    ];
};

echo json_encode($out);
?>