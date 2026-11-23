<?php

session_start( );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

$token = $_COOKIE[ "Authentication" ] ?? "";
if ( $token !== "" && get_user_by_recovery_token( $token ) !== null )
{
    die( header( "Location: /control/dashboard/" ) );
};

die( header( "Location: /control/sign-in/" ) );
?>