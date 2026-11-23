<?php
header("content-type: application/json");
$input = json_decode(file_get_contents("php://input"), true);

if (isset($input["Url"])) {
    $url = trim($input["Url"]);

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        die(json_encode([
            "success" => false,
            "msg" => "Check URL Format"
        ]));
    };

    $ch = curl_init("https://linkurl.pk/e/?url=" . urlencode($url));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        die(json_encode([
            "success" => false,
            "msg" => "Unknown Error"
        ]));
    };

    curl_close($ch);

    $json = json_decode($response, true);

    if (!isset($json["url"])) {
        die(json_encode([
            "success" => false,
            "msg" => "Unknown Error"
        ]));
    };

    $safe_url = str_replace("://", "*:*//", $url);

    die(json_encode([
        "success" => true,
        "msg" => "[" . $safe_url . "](" . $json["url"] . ")"
    ]));
} else {
    die(json_encode([
        "success" => false,
        "msg" => "Check URL Format"
    ]));
};
?>