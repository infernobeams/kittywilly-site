<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

if (!headers_sent()) {
    header("Content-Type: application/json");
}

try {
    $user = get_user_by_recovery_token($_COOKIE["Authentication"] ?? "");
    if (!$user || $user["account_banned"]) {
        http_response_code(401);
        die(json_encode(["success" => false, "msg" => "Unauthorized"]));
    }

    $body = json_decode(file_get_contents("php://input"), true);
    if (!is_array($body)) {
        die(json_encode(["success" => false, "msg" => "Invalid JSON"]));
    }

    $valid_statuses = ["In Game", "Online", "Offline"];
    $set = [];
    $values = [];
    $errors = [];

    if (array_key_exists("name", $body) && is_array($body["name"])) {
        $name_data = $body["name"];
        
        if (array_key_exists("real", $name_data)) {
            $v = trim((string)$name_data["real"]);
            if (empty($v) || mb_strlen($v) > 20) {
                $errors[] = "Real name must be 1-20 chars";
            } else {
                $set[] = "profile_real_name = ?";
                $values[] = $v;
            }
        }

        if (array_key_exists("fake", $name_data)) {
            $v = trim((string)$name_data["fake"]);
            if (empty($v) || mb_strlen($v) > 20) {
                $errors[] = "Fake name must be 1-20 chars";
            } else {
                $set[] = "profile_fake_name = ?";
                $values[] = $v;
            }
        }

        if (array_key_exists("display", $name_data)) {
            $v = trim((string)$name_data["display"]);
            if (empty($v) || mb_strlen($v) > 20) {
                $errors[] = "Display name must be 1-20 chars";
            } else {
                $set[] = "profile_display_name = ?";
                $values[] = $v;
            }
        }
    }

    if (array_key_exists("stats", $body) && is_array($body["stats"])) {
        $stats_data = $body["stats"];
        
        if (array_key_exists("following", $stats_data)) {
            $v = (int)$stats_data["following"];
            $set[] = "profile_followings = ?";
            $values[] = $v;
        }
        
        if (array_key_exists("followers", $stats_data)) {
            $v = (int)$stats_data["followers"];
            $set[] = "profile_followers = ?";
            $values[] = $v;
        }
        
        if (array_key_exists("friends", $stats_data)) {
            $v = (int)$stats_data["friends"];
            $set[] = "profile_friends = ?";
            $values[] = $v;
        }
    }

    if (array_key_exists("premium", $body)) {
        $set[] = "profile_premium = ?";
        $values[] = (int)(bool)$body["premium"];
    }

    if (array_key_exists("status", $body)) {
        $v = trim((string)$body["status"]);
        $v_lower = strtolower($v);

        $map = [
            "online" => "Online",
            "offline" => "Offline",
            "in game" => "In Game",
            "ingame" => "In Game",
            "playing" => "In Game"
        ];

        if (isset($map[$v_lower])) {
            $v = $map[$v_lower];
        }

        if (!in_array($v, $valid_statuses)) {
            $errors[] = "Status must be one of: " . implode(", ", $valid_statuses);
        } else {
            $set[] = "profile_status = ?";
            $values[] = $v;
        }
    }

    if (array_key_exists("description", $body)) {
        $v = trim((string)$body["description"]);
        if (mb_strlen($v) > 1000) {
            $errors[] = "Description max 1000 chars";
        } else {
            $set[] = "profile_description = ?";
            $values[] = $v;
        }
    }

    if (array_key_exists("createdAt", $body)) {
        $v = trim((string)$body["createdAt"]);
        if (!empty($v) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
            $errors[] = "createdAt must be YYYY-MM-DD";
        } else {
            $set[] = "profile_creation_date = ?";
            $values[] = $v;
        }
    }

    if (!empty($errors)) {
        http_response_code(400);
        die(json_encode(["success" => false, "msg" => implode(", ", $errors)]));
    }

    if (empty($set)) {
        http_response_code(400);
        die(json_encode(["success" => false, "msg" => "Nothing to update"]));
    }

    $values[] = $user["id"];
    $sql = "UPDATE users SET " . implode(", ", $set) . " WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($values);
    
    echo json_encode(["success" => true, "msg" => "Profile updated successfully!"]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "msg" => "Server error: " . $e->getMessage()]);
}
?>