<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");
header("content-type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) { http_response_code(401); die(json_encode(["success" => false, "message" => "Unauthorized"])); }
$referral_count = 0;
if (!empty($user["referral_code"])) {
    global $db;
    $st = $db->prepare("SELECT COUNT(*) FROM users WHERE referred_by = ? LIMIT 1");
    $st->execute([$user["referral_code"]]);
    $referral_count = (int)$st->fetchColumn();
};
die(json_encode([
    "avatar"      => "https://cdn.discordapp.com/avatars/" . $user["discord_id"] . "/" . $user["discord_avatar"] . ".png?size=256",
    "referals"    => $referral_count,
    "referCode"   => $user["referral_code"],
    "Name"        => $user["referral_name"],
    "Description" => $user["referral_description"],
    "Invite"      => $user["referral_invite"]
]));
?>