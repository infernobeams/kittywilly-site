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

$page = isset($_GET["page"]) ? max(1, intval($_GET["page"])) : 1;
$sort_by = isset($_GET["sort_by"]) ? $_GET["sort_by"] : "visited_at";
$limit = 20;
$offset = ($page - 1) * $limit;

$allowed_sort = ["visited_at", "id", "ip", "country", "city"];
$sort_by = in_array($sort_by, $allowed_sort) ? $sort_by : "visited_at";
$order_dir = "DESC";

$count_stmt = $db->prepare("
    SELECT COUNT(*) as total 
    FROM user_visits 
    WHERE owner_id = ?
");
$count_stmt->execute([$user["id"]]);
$total_visits = $count_stmt->fetch(PDO::FETCH_ASSOC)["total"];
$total_pages = ceil($total_visits / $limit);

if ($total_visits == 0) {
    die(json_encode([
        "logs" => [],
        "pages" => 1
    ]));
}

$stmt = $db->prepare("
    SELECT 
        uv.id,
        uv.ip,
        uv.country,
        uv.city,
        uv.url,
        uv.type
    FROM user_visits uv
    LEFT JOIN users vu ON uv.user_id = vu.id
    WHERE uv.owner_id = ?
    ORDER BY uv.{$sort_by} {$order_dir}
    LIMIT ? OFFSET ?
");
$stmt->execute([$user["id"], $limit, $offset]);
$visits = $stmt->fetchAll(PDO::FETCH_ASSOC);

$logs = [];
foreach ($visits as $visit) {
    $roblox_id = null;
    $roblox_avatar = null;
    
    if (!empty($visit["visitor_real_name"])) {
        $ch = curl_init("https://users.roblox.com/v1/usernames/users");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(["usernames" => [$visit["visitor_real_name"]], "excludeBannedUsers" => false]),
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
    
    $logs[] = [
        "user" => [
            "ip" => $visit["ip"],
            "country" => $visit["country"],
            "city" => $visit["city"]
        ],
        "date" => date("Y-m-d H:i:s", $visit["visited_at"]),
        "link" => [
            "type" => $visit["type"],
            "url" => "https://" . $_SERVER["SERVER_NAME"] . $visit["url"]
        ]
    ];
}

die(json_encode([
    "logs" => $logs,
    "pages" => $total_pages
]));
?>