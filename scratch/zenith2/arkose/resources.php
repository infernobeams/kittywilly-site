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
    $ch = curl_init("https://arkoselabs.roblox.com" . $_SERVER["REQUEST_URI"]);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0");
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0); 
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_HEADER, true);
    $response = curl_exec($ch);
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $header_string = substr($response, 0, $header_size);
    $body = substr($response, $header_size);
    $header_lines = explode("\r\n", $header_string);

    foreach ($header_lines as $line) 
    {
        if (strpos($line, ":") !== false) 
        {
            list($key, $value) = explode(":", $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (in_array(strtolower($key), ["content-type", "content-length"]))
            {
                header("$key: $value");
            };
        };
    };
    
    http_response_code($http_code);
    die($body);
};
?>