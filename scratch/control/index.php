<?php
$protocol = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off" || $_SERVER["SERVER_PORT"] == 443) ? "https://" : "http://";
die( file_get_contents( $protocol . $_SERVER[ "SERVER_NAME" ] . "/curl/https://www.roblox.com/" ) );
?>