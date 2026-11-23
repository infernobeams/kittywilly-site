<?php
session_start();
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

header("Content-Type: application/json");

$user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
if (!$user || $user["account_banned"]) { http_response_code(401); die(json_encode(["success" => false, "message" => "Unauthorized"])); }

$body = json_decode(file_get_contents("php://input"), true);
$message = isset($body["message"]) ? trim((string)$body["message"]) : "";

if (empty($message)) { http_response_code(400); die(json_encode(["success" => false, "message" => "Empty message"])); }
if (mb_strlen($message) > 500) { http_response_code(400); die(json_encode(["success" => false, "message" => "Message too long"])); }

$message = strip_tags($message);
$message = preg_replace('/https?:\/\/\S+/i', '[URL Blocked]', $message);
$message = preg_replace('/www\.\S+/i', '[URL Blocked]', $message);
$message = preg_replace('/[^\x20-\x7E\s]/u', '', $message);
$message = trim($message);

if (empty($message)) { http_response_code(400); die(json_encode(["success" => false, "message" => "Empty message"])); }

$db->prepare("
    CREATE TABLE IF NOT EXISTS chat (
        id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id    BIGINT UNSIGNED NOT NULL,
        message    VARCHAR(500) NOT NULL,
        created_at BIGINT NOT NULL,
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
")->execute();

$st = $db->prepare("INSERT INTO chat (user_id, message, created_at) VALUES (?, ?, ?)");
$st->execute([$user["id"], $message, time()]);

update_last_active($user["id"]);

die(json_encode(["success" => true, "id" => (int)$db->lastInsertId()]));
?>