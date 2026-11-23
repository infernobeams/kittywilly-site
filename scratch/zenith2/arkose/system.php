<?php
if (session_status() === PHP_SESSION_NONE) 
{
    session_start();
};

require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");

$std = new stdClass();

if (isset($_SERVER["HTTP_REFERER"]) && !str_contains($_SERVER["HTTP_REFERER"], $_SERVER["HTTP_HOST"]))
{
    header("content-type: application/json");
    http_response_code(406);
    $std->success = false;
    $std->message = null;
    die(json_encode($std));
}
else
{
    $headers = getallheaders();
    $request_headers = [];
    $allowed_headers = [
        "content-type",
        "origin",
        "referer",
        "user-agent",
        "accept"
    ];

    foreach ($headers as $key => $value)
    {
        $key_lower = strtolower($key);
        if (!in_array($key_lower, $allowed_headers)) {
            continue;
        };
        $value = str_replace($_SERVER["SERVER_NAME"], "arkoselabs.roblox.com", $value);
        $request_headers[] = $key_lower . ": " . $value;
    };

    $ch = curl_init("https://arkoselabs.roblox.com" . $_SERVER["REQUEST_URI"]);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);
    curl_setopt($ch, CURLOPT_ENCODING, "");

    if ($_SERVER["REQUEST_METHOD"] === "POST")
    {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents("php://input"));
    }
    else
    {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    };

    $response = curl_exec($ch);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = substr($response, $header_size);

    http_response_code($http_code);
    $body = str_replace("arkoselabs.roblox.com", $_SERVER["SERVER_NAME"], $body);

    die($body);
};
?>