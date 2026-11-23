<?php

require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

header( "content-type: application/json; charset=utf-8" );

$body = json_decode( file_get_contents( "php://input" ), true );
$token = trim( (string) ( $body[ "recoveryToken" ] ?? "" ) );

if ( $token === "" )
{
    die( json_encode( [ "success" => false, "msg" => "Invalid recovery token" ] ) );
};

$user = get_user_by_recovery_token( $token );

if ( $user === null || !empty( $user[ "account_banned" ] ) )
{
    die( json_encode( [ "success" => false, "msg" => "Invalid recovery token" ] ) );
};

set_auth_cookie( $token );
update_last_active( (int) $user[ "id" ] );

die( json_encode( [ "success" => true, "msg" => "Logged in" ] ) );
?>
