<?php

session_start( );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

clear_auth_cookie( );
unset( $_SESSION[ "info" ] );

die( header( "Location: /control/sign-in/" ) );
?>