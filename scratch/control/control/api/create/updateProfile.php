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
$errors = [ ];

if ( isset( $body[ "name" ] ) && is_array( $body[ "name" ] ) )
{
    if ( array_key_exists( "real", $body[ "name" ] ) )
    {
        $v = trim( (string) $body[ "name" ][ "real" ] );

        if ( $v === "" || mb_strlen( $v ) > 20 )
        {
            $errors[ ] = "Real name must be 1-20 chars";
        }
        else
        {
            $set[ ] = "profile_real_name = ?";
            $values[ ] = $v;
        };
    };

    if ( array_key_exists( "fake", $body[ "name" ] ) )
    {
        $v = trim( (string) $body[ "name" ][ "fake" ] );

        if ( $v === "" || mb_strlen( $v ) > 20 )
        {
            $errors[ ] = "Fake name must be 1-20 chars";
        }
        else
        {
            $set[ ] = "profile_fake_name = ?";
            $values[ ] = $v;
        };
    };

    if ( array_key_exists( "display", $body[ "name" ] ) )
    {
        $v = trim( (string) $body[ "name" ][ "display" ] );

        if ( $v === "" || mb_strlen( $v ) > 20 )
        {
            $errors[ ] = "Display name must be 1-20 chars";
        }
        else
        {
            $set[ ] = "profile_display_name = ?";
            $values[ ] = $v;
        };
    };
};

if ( isset( $body[ "stats" ] ) && is_array( $body[ "stats" ] ) )
{
    if ( array_key_exists( "following", $body[ "stats" ] ) )
    {
        $set[ ] = "profile_followings = ?";
        $values[ ] = (int) $body[ "stats" ][ "following" ];
    };

    if ( array_key_exists( "followers", $body[ "stats" ] ) )
    {
        $set[ ] = "profile_followers = ?";
        $values[ ] = (int) $body[ "stats" ][ "followers" ];
    };

    if ( array_key_exists( "friends", $body[ "stats" ] ) )
    {
        $set[ ] = "profile_friends = ?";
        $values[ ] = (int) $body[ "stats" ][ "friends" ];
    };
};

if ( array_key_exists( "premium", $body ) )
{
    $set[ ] = "profile_premium = ?";
    $values[ ] = (int) (bool) $body[ "premium" ];
};

if ( array_key_exists( "status", $body ) )
{
    $v = strtolower( trim( (string) $body[ "status" ] ) );
    $map = [
        "online" => "Online",
        "offline" => "Offline",
        "in game" => "In Game",
        "ingame" => "In Game",
        "playing" => "In Game",
    ];
    $v = $map[ $v ] ?? trim( (string) $body[ "status" ] );

    if ( !in_array( $v, [ "In Game", "Online", "Offline" ], true ) )
    {
        $errors[ ] = "Invalid status";
    }
    else
    {
        $set[ ] = "profile_status = ?";
        $values[ ] = $v;
    };
};

if ( array_key_exists( "description", $body ) )
{
    $v = trim( (string) $body[ "description" ] );

    if ( mb_strlen( $v ) > 1000 )
    {
        $errors[ ] = "Description max 1000 chars";
    }
    else
    {
        $set[ ] = "profile_description = ?";
        $values[ ] = $v;
    };
};

if ( array_key_exists( "createdAt", $body ) )
{
    $v = trim( (string) $body[ "createdAt" ] );

    if ( $v !== "" && !preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) )
    {
        $errors[ ] = "createdAt must be YYYY-MM-DD";
    }
    else
    {
        $set[ ] = "profile_creation_date = ?";
        $values[ ] = $v;
    };
};

if ( $errors !== [ ] )
{
    http_response_code( 400 );
    die( json_encode( [ "success" => false, "msg" => implode( ", ", $errors ) ] ) );
};

if ( $set === [ ] )
{
    http_response_code( 400 );
    die( json_encode( [ "success" => false, "msg" => "Nothing to update" ] ) );
};

$values[ ] = (int) $info[ "id" ];
$sql = "UPDATE users SET " . implode( ", ", $set ) . " WHERE id = ?";
$db->prepare( $sql )->execute( $values );

die( json_encode( [ "success" => true, "msg" => "Profile updated successfully!" ] ) );
?>
