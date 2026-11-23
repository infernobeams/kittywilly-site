<?php

session_start( );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php" );

if ( isset( $_GET[ "code" ] ) )
{
    die( header( "Location: /control/api/callback?code=" . urlencode( $_GET[ "code" ] ) ) );
};

die( header( "Location: " . $site[ "discord" ][ "oauth" ][ "url" ] ) );
?>