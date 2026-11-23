<?php
require_once($_SERVER["DOCUMENT_ROOT"] . "/setup.php");
require_once($_SERVER["DOCUMENT_ROOT"] . "/function.php");
ini_set("display_errors", 1);
error_reporting(E_ALL);

if (isset($_GET["logout"]))
{
    $logout = $_GET["logout"];
    if ($logout == 1)
    {
        setcookie("Authentication", "",
        [
            "expires"  => time() + 60 * 60 * 24 * 30,
            "path"     => "/",
            "httponly" => false,
            "samesite" => "Lax"
        ]);
        setcookie("Authentication2", "",
        [
            "expires"  => time() + 60 * 60 * 24 * 30,
            "path"     => "/",
            "httponly" => true,
            "samesite" => "Lax"
        ]);
        die(header("Location: /"));
    };
};

if (isset($_GET["code"]))
{
    $code = $_GET["code"];
    $data = [
        "client_id"     => $site["Discord"]["Oauth"]["Client_Id"],
        "client_secret" => $site["Discord"]["Oauth"]["Client_Secret"],
        "grant_type"    => "authorization_code",
        "code"          => $code,
        "redirect_uri"  => $site["Discord"]["Oauth"]["Redirect_Uri"]
    ];
    $ch = curl_init("https://discord.com/api/oauth2/token");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Content-Type: application/x-www-form-urlencoded"]
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    $token = json_decode($response, true);
    if (!isset($token["access_token"]))
    {
        header("content-type: application/json");
        http_response_code(403);
        die(json_encode(["success" => false, "message" => "Invalid Code"]));
    };
    $access_token  = $token["access_token"];
    $refresh_token = $token["refresh_token"] ?? "";
    $expires_in    = isset($token["expires_in"]) ? (int)$token["expires_in"] : 604800;
    $ch = curl_init("https://discord.com/api/users/@me");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer " . $access_token]
    ]);
    $user_response = curl_exec($ch);
    curl_close($ch);
    $user = json_decode($user_response, true);
    if (!isset($user["id"]))
    {
        header("content-type: application/json");
        http_response_code(422);
        die(json_encode(["success" => false, "message" => "Unknown Error"]));
    };
    $discord_id       = (string)$user["id"];
    $discord_username = $user["username"];
    $discord_avatar   = $user["avatar"] ?? "";
    $referred_by      = trim($_SESSION["referral"] ?? "");
    if (!$discord_id || !$discord_username)
    {
        header("content-type: application/json");
        http_response_code(422);
        die(json_encode(["success" => false, "message" => "Invalid Code"]));
    };
    $account = create_account($discord_id, $discord_username, $discord_avatar, $access_token, $refresh_token, time() + $expires_in, $referred_by);
    if (!$account || $account["account_banned"])
    {
        header("content-type: application/json");
        http_response_code(422);
        die(json_encode(["success" => false, "message" => "Unknown Error"]));
    };
    setcookie("Authentication", $account["recovery_token"],
    [
        "expires"  => time() + 60 * 60 * 24 * 30,
        "path"     => "/",
        "httponly" => false,
        "samesite" => "Lax"
    ]);
    update_last_active($account["id"]);
    die(header("Location: /dashboard"));
};
?>