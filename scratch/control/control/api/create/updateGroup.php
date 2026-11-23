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

if ( isset( $body[ "group" ] ) && is_array( $body[ "group" ] ) )
{
    if ( array_key_exists( "owner", $body[ "group" ] ) )
    {
        $v = trim( (string) $body[ "group" ][ "owner" ] );

        if ( $v === "" || mb_strlen( $v ) > 20 )
        {
            $errors[ ] = "Owner name must be 1-20 chars";
        }
        else
        {
            $set[ ] = "group_owner_name = ?";
            $values[ ] = $v;
        };
    };

    if ( array_key_exists( "name", $body[ "group" ] ) )
    {
        $v = trim( (string) $body[ "group" ][ "name" ] );

        if ( $v === "" || mb_strlen( $v ) > 50 )
        {
            $errors[ ] = "Group name must be 1-50 chars";
        }
        else
        {
            $set[ ] = "group_name = ?";
            $values[ ] = $v;
            $set[ ] = "group_roblox_id = 0";
        };
    };

    if ( array_key_exists( "thumbnail", $body[ "group" ] ) )
    {
        $v = trim( (string) $body[ "group" ][ "thumbnail" ] );

        if ( mb_strlen( $v ) > 300 )
        {
            $errors[ ] = "Thumbnail URL too long";
        }
        else
        {
            $set[ ] = "group_thumbnail = ?";
            $values[ ] = $v;
        };
    };
};

if ( isset( $body[ "stats" ] ) && is_array( $body[ "stats" ] ) )
{
    if ( array_key_exists( "members", $body[ "stats" ] ) )
    {
        $set[ ] = "group_members = ?";
        $values[ ] = max( 0, (int) $body[ "stats" ][ "members" ] );
    };

    if ( array_key_exists( "funds", $body[ "stats" ] ) )
    {
        $set[ ] = "group_funds = ?";
        $values[ ] = max( 0, (int) $body[ "stats" ][ "funds" ] );
    };
};

if ( array_key_exists( "shout", $body ) )
{
    $v = trim( (string) $body[ "shout" ] );

    if ( mb_strlen( $v ) > 255 )
    {
        $errors[ ] = "Shout max 255 chars";
    }
    else
    {
        $set[ ] = "group_shout = ?";
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
        $set[ ] = "group_description = ?";
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

die( json_encode( [ "success" => true, "msg" => "Group updated successfully!" ] ) );
?>
