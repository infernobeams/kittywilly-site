<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) { http_response_code(401); die(json_encode(["success" => false, "message" => "Unauthorized"])); }
die(json_encode([
    "privateServerLinkCode" => $user["private_server_code"],
    "secret" => $user["referral_code"],
    "domains"     => [$_SERVER["SERVER_NAME"]]
]));
?>