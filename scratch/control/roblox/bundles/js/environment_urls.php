<?php

header( "content-type: application/javascript" );

$html = file_get_contents( "https://www.roblox.com/login" );
if ( !$html )
{
    die( http_response_code( 500 ) );
};

preg_match( '/<script[^>]+data-bundlename="EnvironmentUrls"[^>]+src="([^"]+)"/i',
    $html,
    $matches );

$bundle = $matches[ 1 ] ?? null;
if ( !$bundle )
{
    die( http_response_code( 500 ) );
};

$js = file_get_contents( $bundle );
if ( !$js )
{
    die( http_response_code( 500 ) );
};

$js = preg_replace_callback( '/"https:\/\/([^"]+)"/',
    function ( $m )
    {
        return '"/curl/https://' . $m[ 1 ] . '"';
    },
    $js );

$js = preg_replace( '/\/\/# sourceMappingURL=https:\/\/([^\s]+)/',
    '//# sourceMappingURL=/curl/https://$1',
    $js );

$js = preg_replace( '/\/\/# debugId=.*/',
    '//# debugId=' . bin2hex( random_bytes( 8 ) ),
    $js );

die( $js );