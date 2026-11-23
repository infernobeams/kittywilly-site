<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");
header("content-type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) {
    http_response_code(401);
    die(json_encode(["success" => false, "message" => "Unauthorized"]));
}

$input = json_decode(file_get_contents("php://input"), true);

if (!$input) {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Invalid input"]));
}

$name = isset($input["Name"]) ? trim($input["Name"]) : null;
$description = isset($input["Description"]) ? trim($input["Description"]) : null;
$invite = isset($input["Invite"]) ? trim($input["Invite"]) : null;

if ($name !== null && strlen($name) > 20) {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Check Format"]));
}

if ($description !== null && strlen($description) > 200) {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Check Format"]));
}

if ($invite !== null && strlen($invite) > 20) {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Check Format"]));
}

global $db;

$update_fields = [];
$params = [];

if ($name !== null) {
    $update_fields[] = "referral_name = ?";
    $params[] = htmlspecialchars(strip_tags($name), ENT_QUOTES, 'UTF-8');
}

if ($description !== null) {
    $update_fields[] = "referral_description = ?";
    $params[] = htmlspecialchars(strip_tags($description), ENT_QUOTES, 'UTF-8');
}

if ($invite !== null) {
    $update_fields[] = "referral_invite = ?";
    $params[] = htmlspecialchars(strip_tags($invite), ENT_QUOTES, 'UTF-8');
}

if (empty($update_fields)) {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Check Format"]));
}

$params[] = $user["recovery_token"];
$sql = "UPDATE users SET " . implode(", ", $update_fields) . " WHERE recovery_token = ?";
$st = $db->prepare($sql);
$success = $st->execute($params);

if ($success) {
    die(json_encode(["success" => true, "msg" => "Referral Settings updated successfully!"]));
} else {
    http_response_code(500);
    die(json_encode(["success" => false, "msg" => "Failed to update referral settings"]));
}
?>