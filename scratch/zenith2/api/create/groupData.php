<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) {
    http_response_code(401);
    die(json_encode(["success" => false, "message" => "Unauthorized"]));
}

$roblox_id = null;
$roblox_avatar = null;

$real_name = trim($user["profile_real_name"]);
if (!empty($real_name)) {
    $ch = curl_init("https://users.roblox.com/v1/usernames/users");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            "usernames" => [$real_name],
            "excludeBannedUsers" => false
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    ]);

    $res = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!empty($res["data"][0]["id"])) {
        $roblox_id = (string)$res["data"][0]["id"];

        $ch = curl_init("https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" . $roblox_id . "&size=150x150&format=Png");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);

        $thumb = json_decode(curl_exec($ch), true);
        curl_close($ch);

        $roblox_avatar = $thumb["data"][0]["imageUrl"] ?? null;
    }
}

$statusMap = [
    "Offline" => "offline",
    "Online" => "online",
    "In Game" => "playing"
];

$status = $statusMap[$user["profile_status"]] ?? "offline";

die(json_encode([
    "group" => [
        "name" => $user["group_name"],
        "owner" => $user["group_owner_name"],
        "thumbnail" => $user["group_thumbnail"],
        "id" => $user["profile_fake_id"],
    ],
    "stats" => [
        "members" => (int)$user["group_members"],
        "funds" => (int)$user["group_funds"]
    ],
    "shout" => $user["group_shout"],
    "description" => $user["group_description"],
    "domains" => [$_SERVER["SERVER_NAME"]]
]));
?>