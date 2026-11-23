<?php

if ( php_sapi_name( ) === "cli" )
{
    return;
};

require_once $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/configuration/setup.php";

if ( !isset( $security ) || !is_array( $security ) )
{
    return;
};

$secret = (string) ( $security[ "secret" ] ?? "" );
$difficulty = max( 3, min( 6, (int) ( $security[ "difficulty" ] ?? 5 ) ) );
$clear_ttl = max( 300, (int) ( $security[ "clearance_ttl" ] ?? 86400 ) );
$chal_ttl = max( 60, (int) ( $security[ "challenge_ttl" ] ?? 300 ) );
$batch_size = max( 32, min( 512, (int) ( $security[ "batch_size" ] ?? 256 ) ) );
$img_chance = max( 0, min( 100, (int) ( $security[ "image_chance" ] ?? 50 ) ) );

if ( $secret === "" || $secret === "GAYBLACKMEN" )
{
    $secret = hash( "sha256", __DIR__ . ( $_SERVER[ "SERVER_NAME" ] ?? "localhost" ) );
};

$cookie_name = "_sec_clearance";
$verify_act = "sec_pow_verify";

function hmac( string $data, string $secret ): string
{
    return hash_hmac( "sha256", $data, $secret );
};

function b64u_encode( string $data ): string
{
    return rtrim( strtr( base64_encode( $data ), "+/", "-_" ), "=" );
};

function b64u_decode( string $data ): string|false
{
    $pad = strlen( $data ) % 4;

    if ( $pad > 0 )
    {
        $data .= str_repeat( "=", 4 - $pad );
    };

    return base64_decode( strtr( $data, "-_", "+/" ), true );
};

function token_key( string $secret ): string
{
    return hash( "sha256", $secret, true );
};

function client_ip( ): string
{
    $cf = trim( (string) ( $_SERVER[ "HTTP_CF_CONNECTING_IP" ] ?? "" ) );

    if ( $cf !== "" )
    {
        return $cf;
    };

    $xff = trim( (string) ( $_SERVER[ "HTTP_X_FORWARDED_FOR" ] ?? "" ) );

    if ( $xff !== "" )
    {
        $list = explode( ",", $xff );
        return trim( (string) ( $list[ 0 ] ?? "" ) );
    };

    return trim( (string) ( $_SERVER[ "REMOTE_ADDR" ] ?? "" ) );
};

function request_server_fp( string $secret ): string
{
    $parts =
    [ client_ip( ),
        (string) ( $_SERVER[ "HTTP_USER_AGENT" ] ?? "" ),
        (string) ( $_SERVER[ "HTTP_ACCEPT_LANGUAGE" ] ?? "" ) ];

    return hash_hmac( "sha256", implode( "|", $parts ), $secret );
};

function normalize_client_fp( string $raw ): string
{
    $raw = trim( $raw );

    if ( $raw === "" || strlen( $raw ) > 4096 )
    {
        return "";
    };

    $decoded = json_decode( $raw, true );

    if ( !is_array( $decoded ) )
    {
        return "";
    };

    $safe =
    [ "sr" => (string) ( $decoded[ "sr" ] ?? "" ),
        "vp" => (string) ( $decoded[ "vp" ] ?? "" ),
        "tz" => (string) ( $decoded[ "tz" ] ?? "" ),
        "lang" => (string) ( $decoded[ "lang" ] ?? "" ),
        "platform" => (string) ( $decoded[ "platform" ] ?? "" ),
        "hc" => (string) ( $decoded[ "hc" ] ?? "" ),
        "plugins" => (string) ( $decoded[ "plugins" ] ?? "" ),
        "webdriver" => (string) ( $decoded[ "webdriver" ] ?? "" ) ];

    return json_encode( $safe );
};

function encrypt_token_payload( array $payload, string $secret ): string
{
    $json = json_encode( $payload, JSON_UNESCAPED_SLASHES );
    $iv = random_bytes( 16 );
    $cipher = openssl_encrypt( $json, "AES-256-CBC", token_key( $secret ), OPENSSL_RAW_DATA, $iv );

    if ( $cipher === false )
    {
        return "";
    };

    return b64u_encode( $iv . $cipher );
};

function decrypt_token_payload( string $encrypted, string $secret ): ?array
{
    $raw = b64u_decode( $encrypted );

    if ( $raw === false || strlen( $raw ) <= 16 )
    {
        return null;
    };

    $iv = substr( $raw, 0, 16 );
    $cipher = substr( $raw, 16 );
    $json = openssl_decrypt( $cipher, "AES-256-CBC", token_key( $secret ), OPENSSL_RAW_DATA, $iv );

    if ( $json === false )
    {
        return null;
    };

    $payload = json_decode( $json, true );

    if ( !is_array( $payload ) )
    {
        return null;
    };

    return $payload;
};

function timing_eq( string $a, string $b ): bool
{
    if ( function_exists( "hash_equals" ) )
    {
        return hash_equals( $a, $b );
    };

    if ( strlen( $a ) !== strlen( $b ) )
    {
        return false;
    };

    $result = 0;
    $length = strlen( $a );

    for ( $i = 0; $i < $length; $i++ )
    {
        $result |= ord( $a[ $i ] ) ^ ord( $b[ $i ] );
    };

    return $result === 0;
};

function clearance_ok( string $cookie_name, string $secret, int $ttl ): bool
{
    if ( empty( $_COOKIE[ $cookie_name ] ) )
    {
        return false;
    };

    $parts = explode( ".", $_COOKIE[ $cookie_name ], 2 );

    if ( count( $parts ) !== 2 )
    {
        return false;
    };

    list( $payload_b64, $signature ) = $parts;
    $expected = hmac( $payload_b64, $secret );

    if ( !timing_eq( $expected, $signature ) )
    {
        return false;
    };

    $payload = decrypt_token_payload( $payload_b64, $secret );

    if ( !is_array( $payload ) || empty( $payload[ "exp" ] ) || empty( $payload[ "v" ] ) || empty( $payload[ "id" ] ) || empty( $payload[ "fp" ] ) )
    {
        return false;
    };

    if ( (int) $payload[ "exp" ] < time( ) || (int) $payload[ "v" ] !== 1 )
    {
        return false;
    };

    $current_fp = request_server_fp( $secret );

    if ( !timing_eq( (string) $payload[ "fp" ], $current_fp ) )
    {
        return false;
    };

    return true;
};

function clearance_set( string $cookie_name, string $secret, int $ttl, string $client_fp_raw = "" ): void
{
    $client_fp = normalize_client_fp( $client_fp_raw );
    $payload =
    [ "v" => 1,
        "id" => bin2hex( random_bytes( 8 ) ),
        "iat" => time( ),
        "exp" => time( ) + $ttl,
        "fp" => request_server_fp( $secret ),
        "cfp" => $client_fp === "" ? null : hash_hmac( "sha256", $client_fp, $secret ) ];

    $payload_b64 = encrypt_token_payload( $payload, $secret );

    if ( $payload_b64 === "" )
    {
        return;
    };

    $signature = hmac( $payload_b64, $secret );
    $value = $payload_b64 . "." . $signature;
    $expires = $payload[ "exp" ];
    $secure = !empty( $_SERVER[ "HTTPS" ] ) && $_SERVER[ "HTTPS" ] !== "off";

    if ( PHP_VERSION_ID >= 70300 )
    {
        setcookie( $cookie_name,
            $value,
            [ "expires" => $expires,
                "path" => "/",
                "secure" => $secure,
                "httponly" => true,
                "samesite" => "Lax" ] );
    } else
    {
        setcookie( $cookie_name, $value, $expires, "/", "", $secure, true );
    };

    $_COOKIE[ $cookie_name ] = $value;
};

function verify_post( ): void
{
    global $verify_act, $secret, $cookie_name;
    global $clear_ttl, $difficulty;

    if ( $_SERVER[ "REQUEST_METHOD" ] !== "POST"
        || ( $_POST[ "action" ] ?? "" ) !== $verify_act ) {
        return;
    };

    $challenge_token = (string) ( $_POST[ "challenge" ] ?? "" );
    $solution = (string) ( $_POST[ "solution" ] ?? "" );
    $challenge = challenge_parse( $challenge_token, $secret );

    if ( $challenge === null )
    {
        json_out( [ "ok" => false, "error" => "Challenge expired. Refresh and try again." ], 400 );
    };

    if ( !challenge_verify( $challenge, $solution, $difficulty ) )
    {
        json_out( [ "ok" => false, "error" => "Invalid solution." ], 400 );
    };

    $client_fp_raw = (string) ( $_POST[ "browser_fp" ] ?? "" );
    clearance_set( $cookie_name, $secret, $clear_ttl, $client_fp_raw );
    json_out( [ "ok" => true ] );
};

function challenge_sign( array $challenge, string $secret ): string
{
    $payload_b64 = rtrim( strtr( base64_encode( json_encode( $challenge ) ), "+/", "-_" ), "=" );
    $signature = hmac( $payload_b64, $secret );

    return $payload_b64 . "." . $signature;
};

function captcha_code( int $length = 5 ): string
{
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    $max = strlen( $chars ) - 1;
    $code = "";

    for ( $i = 0; $i < $length; $i++ )
    {
        $code .= $chars[ random_int( 0, $max ) ];
    };

    return $code;
};

function captcha_svg( string $code ): string
{
    $width = 240;
    $height = 88;
    $noise = "";

    for ( $i = 0; $i < 14; $i++ )
    {
        $x1 = random_int( 0, $width );
        $y1 = random_int( 0, $height );
        $x2 = random_int( 0, $width );
        $y2 = random_int( 0, $height );
        $noise .= '<line x1="' . $x1 . '" y1="' . $y1 . '" x2="' . $x2 . '" y2="' . $y2 . '" stroke="#353C4B" stroke-width="1"/>';
    };

    for ( $i = 0; $i < 8; $i++ )
    {
        $x1 = random_int( 0, $width );
        $y1 = random_int( 0, $height );
        $x2 = random_int( 0, $width );
        $y2 = random_int( 0, $height );
        $noise .= '<line x1="' . $x1 . '" y1="' . $y1 . '" x2="' . $x2 . '" y2="' . $y2 . '" stroke="#1446FF" stroke-width="1.2" opacity="0.45"/>';
    };

    $letters = "";
    $x = 16;

    for ( $i = 0, $len = strlen( $code ); $i < $len; $i++ )
    {
        $char = htmlspecialchars( $code[ $i ], ENT_XML1 | ENT_QUOTES, "UTF-8" );
        $y = random_int( 48, 68 );
        $size = random_int( 26, 34 );
        $rotate = random_int( -32, 32 );
        $letters .= '<text x="' . $x . '" y="' . $y . '" fill="#FFFFFF" font-family="Builder Sans,Helvetica,Arial,sans-serif" font-size="' . $size . '" font-weight="700" transform="rotate(' . $rotate . ' ' . $x . ' ' . $y . ')">' . $char . '</text>';
        $x += random_int( 30, 40 );
    };

    $svg = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<svg xmlns="http://www.w3.org/2000/svg" width="' . $width . '" height="' . $height . '" viewBox="0 0 ' . $width . ' ' . $height . '">'
        . '<rect width="100%" height="100%" fill="#171922"/>'
        . $noise
        . $letters
        . '</svg>';

    return "data:image/svg+xml;base64," . base64_encode( $svg );
};

function captcha_img( string $code ): string
{
    return captcha_svg( $code );
};

function challenge_create( string $secret, int $difficulty, int $ttl ): array
{
    global $img_chance;

    if ( random_int( 1, 100 ) <= $img_chance )
    {
        $code = captcha_code( );
        $challenge =
        [ "type" => "image",
            "hash" => hash_hmac( "sha256", $code, $secret ),
            "exp" => time( ) + $ttl,
            "v" => 2 ];

        return
        [ "type" => "image",
            "token" => challenge_sign( $challenge, $secret ),
            "captcha_image" => captcha_img( $code ) ];
    };

    $challenge =
    [ "type" => "pow",
        "nonce" => bin2hex( random_bytes( 16 ) ),
        "difficulty" => $difficulty,
        "exp" => time( ) + $ttl,
        "v" => 1 ];

    return
    [ "type" => "pow",
        "token" => challenge_sign( $challenge, $secret ),
        "captcha_image" => null ];
};

function challenge_parse( string $token, string $secret ): ?array
{
    $parts = explode( ".", $token, 2 );

    if ( count( $parts ) !== 2 )
    {
        return null;
    };

    list( $payload_b64, $signature ) = $parts;
    $expected = hmac( $payload_b64, $secret );

    if ( !timing_eq( $expected, $signature ) )
    {
        return null;
    };

    $payload_json = base64_decode( strtr( $payload_b64, "-_", "+/" ), true );

    if ( $payload_json === false )
    {
        return null;
    };

    $challenge = json_decode( $payload_json, true );

    if ( !is_array( $challenge ) || empty( $challenge[ "exp" ] ) )
    {
        return null;
    };

    $type = (string) ( $challenge[ "type" ] ?? "pow" );

    if ( $type === "image" )
    {
        if ( empty( $challenge[ "hash" ] ) )
        {
            return null;
        }
    } else
    {
        if ( empty( $challenge[ "nonce" ] ) )
        {
            return null;
        }
    };

    if ( (int) $challenge[ "exp" ] < time( ) )
    {
        return null;
    };

    return $challenge;
};

function challenge_verify( array $challenge, string $solution, int $difficulty ): bool
{
    global $secret;

    $type = (string) ( $challenge[ "type" ] ?? "pow" );

    if ( $type === "image" )
    {
        if ( !preg_match( '/^[A-Za-z0-9]+$/', $solution ) )
        {
            return false;
        };

        $expected = (string) ( $challenge[ "hash" ] ?? "" );
        $actual = hash_hmac( "sha256", $solution, $secret );

        return timing_eq( $expected, $actual );
    };

    if ( !preg_match( '/^[0-9]+$/', $solution ) )
    {
        return false;
    };

    $challenge_difficulty = max( 3, min( 6, (int) ( $challenge[ "difficulty" ] ?? $difficulty ) ) );
    $hash = hash( "sha256", $challenge[ "nonce" ] . ":" . $solution );
    $prefix = str_repeat( "0", $challenge_difficulty );

    return strncmp( $hash, $prefix, $challenge_difficulty ) === 0;
};

function json_out( array $data, int $status = 200 ): void
{
    if ( !headers_sent( ) )
    {
        http_response_code( $status );
        header( "Content-Type: application/json; charset=utf-8" );
        header( "Cache-Control: no-store, no-cache, must-revalidate" );
    };

    echo json_encode( $data );
    exit;
};

function is_script_req( ): bool
{
    $sec_dest = strtolower( (string) ( $_SERVER[ "HTTP_SEC_FETCH_DEST" ] ?? "" ) );
    $sec_mode = strtolower( (string) ( $_SERVER[ "HTTP_SEC_FETCH_MODE" ] ?? "" ) );

    if ( $sec_dest === "document" || $sec_mode === "navigate" )
    {
        return false;
    };

    if ( $sec_dest === "script" )
    {
        return true;
    };

    $accept = (string) ( $_SERVER[ "HTTP_ACCEPT" ] ?? "" );

    if ( stripos( $accept, "text/html" ) !== false )
    {
        return false;
    };

    if ( stripos( $accept, "application/javascript" ) !== false
        || stripos( $accept, "text/javascript" ) !== false ) {
        return true;
    };

    return false;
};

function worker_b64( bool $report_progress ): string
{
    return json_encode( base64_encode( worker_src( $report_progress ) ),
        JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
};

function worker_src( bool $report_progress ): string
{
    $progress = $report_progress
        ? "\n      self.postMessage({ type: 'progress', counter: counter, expected: Math.pow(16, difficulty) });"
        : "";

    return <<<'JS'
self.onmessage = async function (e) {
  const nonce = e.data.nonce;
  const difficulty = e.data.difficulty;
  const batch_size = e.data.batch_size;
  const prefix = '0'.repeat(difficulty);
  let counter = 0;
  async function sha256Hex(message) {
    const data = new TextEncoder().encode(message);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  };
  try {
    while (true) {
      const jobs = new Array(batch_size);
      for (let i = 0; i < batch_size; i++) {
        const attempt = counter + i;
        jobs[i] = sha256Hex(nonce + ':' + attempt).then(function (hash) {
          return { hash: hash, attempt: attempt };
        });
      };
      const results = await Promise.all(jobs);
      counter += batch_size;
JS
        . $progress . <<<'JS'

      for (let j = 0; j < results.length; j++) {
        if (results[j].hash.slice(0, difficulty) === prefix) {
          self.postMessage({ type: 'done', solution: String(results[j].attempt) });
          return;
        }
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : 'Worker failed' });
  }
};
JS;
};

function challenge_render_js( string $challenge_token ): void
{
    $challenge_js = json_encode( $challenge_token, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $verify_action_js = json_encode( $GLOBALS[ "verify_act" ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $boot_js = json_encode( [ "batch_size" => $GLOBALS[ "batch_size" ],
            "difficulty" => $GLOBALS[ "difficulty" ] ],
        JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $script_url_js = json_encode( (string) ( $_SERVER[ "REQUEST_URI" ] ?? "/" ),
        JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $worker_b64_js = worker_b64( false );

    if ( !headers_sent( ) )
    {
        http_response_code( 200 );
        header( "Content-Type: application/javascript; charset=utf-8" );
        header( "Cache-Control: no-store, no-cache, must-revalidate" );
    };

    echo '(function(){'
        . '"use strict";'
        . 'var boot=' . $boot_js . ';'
        . 'var challengeToken=' . $challenge_js . ';'
        . 'var verifyAction=' . $verify_action_js . ';'
        . 'var workerB64=' . $worker_b64_js . ';'
        . 'var batch_size=boot.batch_size||256;'
        . 'var default_difficulty=boot.difficulty||5;'
        . 'var fallbackPath=' . $script_url_js . ';'
        . 'var current=document.currentScript;'
        . 'var scriptUrl=current&&current.src?current.src:location.origin+fallbackPath;'
        . 'function getBrowserFp(){'
        . 'var tz="";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"";}catch(e){}'
        . 'return JSON.stringify({'
        . 'sr:(screen&&screen.width&&screen.height)?(String(screen.width)+"x"+String(screen.height)):"",'
        . 'vp:String(window.innerWidth||0)+"x"+String(window.innerHeight||0),'
        . 'tz:tz,'
        . 'lang:navigator.language||"",'
        . 'platform:navigator.platform||"",'
        . 'hc:String(navigator.hardwareConcurrency||""),'
        . 'plugins:String((navigator.plugins&&navigator.plugins.length)||0),'
        . 'webdriver:navigator.webdriver?1:0'
        . '});}'
        . 'function parseChallenge(token){var parts=token.split(".");if(parts.length!==2)throw new Error("Invalid challenge");return JSON.parse(atob(parts[0].replace(/-/g,"+").replace(/_/g,"/")));}'
        . 'function solvePowInWorker(challenge){return new Promise(function(resolve,reject){var worker;try{worker=new Worker(URL.createObjectURL(new Blob([atob(workerB64)],{"type":"application/javascript"})));}catch(e){reject(e);return;}'
        . 'worker.onmessage=function(e){var msg=e.data;if(msg.type==="done"){worker.terminate();resolve(msg.solution);}else if(msg.type==="error"){worker.terminate();reject(new Error(msg.message));}};'
        . 'worker.onerror=function(){worker.terminate();reject(new Error("Security worker crashed"));};'
        . 'worker.postMessage({nonce:challenge.nonce,difficulty:challenge.difficulty||default_difficulty,batch_size:batch_size});});}'
        . 'function ajaxPost(url,fields){return new Promise(function(resolve,reject){var xhr=new XMLHttpRequest();var body=new URLSearchParams(fields);xhr.open("POST",url,true);xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded");xhr.setRequestHeader("Accept","application/json");xhr.setRequestHeader("X-Requested-With","XMLHttpRequest");'
        . 'xhr.onload=function(){var data;try{data=JSON.parse(xhr.responseText);}catch(e){reject(new Error("Invalid verify response"));return;}'
        . 'if(xhr.status>=200&&xhr.status<300&&data.ok){resolve(data);}else{reject(new Error(data.error||"Verification failed"));}};'
        . 'xhr.onerror=function(){reject(new Error("Network error"));};xhr.send(body.toString());});}'
        . 'function submitSolution(solution){return ajaxPost(scriptUrl.split("#")[0],{action:verifyAction,challenge:challengeToken,solution:solution,browser_fp:getBrowserFp()});}'
        . 'function reloadScript(){var base=scriptUrl.split("#")[0];var sep=base.indexOf("?")>=0?"&":"?";var tag=document.createElement("script");tag.src=base+sep+"_sec="+Date.now();tag.async=true;if(current&&current.parentNode){current.parentNode.insertBefore(tag,current.nextSibling);}else{(document.head||document.documentElement).appendChild(tag);}}'
        . 'function run(){if(!window.Worker||!window.crypto||!window.crypto.subtle){if(window.top!==window.self){try{parent.location.reload();}catch(e){parent.location.href=parent.location.href;}}else if(document.referrer){location.replace(document.referrer);}return;}'
        . 'var challenge=parseChallenge(challengeToken);if(challenge.type==="image"){if(window.top!==window.self){try{parent.location.reload();}catch(e){parent.location.href=parent.location.href;}}else if(document.referrer){location.replace(document.referrer);}else{location.replace("/");}return;}'
        . 'solvePowInWorker(challenge).then(submitSolution).then(reloadScript).catch(function(){if(window.top!==window.self){try{parent.location.reload();}catch(e){parent.location.href=parent.location.href;}}else if(document.referrer){location.replace(document.referrer);}});}'
        . 'run();})();';
    exit;
};

function sec_request_target( ): string
{
    $uri = (string) ( $_SERVER[ "REQUEST_URI" ] ?? "/" );
    $path = parse_url( $uri, PHP_URL_PATH );
    if ( !is_string( $path ) || $path === "" )
    {
        $path = "/";
    };
    $query = parse_url( $uri, PHP_URL_QUERY );
    return $path . ( is_string( $query ) && $query !== "" ? "?" . $query : "" );
};

function sec_internal_bypass_ok( ): bool
{
    global $secret;
    $token = (string) ( $_SERVER[ "HTTP_X_SEC_INTERNAL" ] ?? "" );
    if ( $token === "" )
    {
        return false;
    };
    $expected = hash_hmac( "sha256", sec_request_target( ), $secret );
    return timing_eq( $token, $expected );
};

function should_fetch_destination_head( ): bool
{
    if ( ( $_SERVER[ "REQUEST_METHOD" ] ?? "GET" ) !== "GET" )
    {
        return false;
    };
    $path = parse_url( $_SERVER[ "REQUEST_URI" ] ?? "/", PHP_URL_PATH );
    if ( !is_string( $path ) || $path === "" )
    {
        $path = "/";
    };
    if ( preg_match( '#\.(js|css|png|jpe?g|gif|webp|ico|woff2?|svg|map|json|xml|txt)$#i', $path ) )
    {
        return false;
    };
    if ( preg_match( '#^/(control/api|functional|apis|roblox/arkose|v2/|fc/|metrics/|cdn/|dapib/|pows/|powseq/)#i', $path ) )
    {
        return false;
    };
    return true;
};

function fetch_destination_head_html( ): string
{
    global $secret;
    $target = sec_request_target( );
    $host = (string) ( $_SERVER[ "HTTP_HOST" ] ?? "localhost" );
    $token = hash_hmac( "sha256", $target, $secret );
    $port = (int) ( $_SERVER[ "SERVER_PORT" ] ?? 80 );
    $https = !empty( $_SERVER[ "HTTPS" ] ) && $_SERVER[ "HTTPS" ] !== "off";
    $scheme = $https ? "https" : "http";
    $url = $scheme . "://127.0.0.1";
    if ( ( !$https && $port !== 80 ) || ( $https && $port !== 443 ) )
    {
        $url .= ":" . $port;
    };
    $url .= $target;

    $ch = curl_init( $url );
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER => [
            "Host: " . $host,
            "X-Sec-Internal: " . $token,
            "Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language: en-US,en;q=0.9",
            "User-Agent: Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
        ],
    ];
    if ( $https )
    {
        $opts[ CURLOPT_SSL_VERIFYPEER ] = false;
        $opts[ CURLOPT_SSL_VERIFYHOST ] = 0;
    };
    curl_setopt_array( $ch, $opts );
    $body = curl_exec( $ch );
    curl_close( $ch );

    return is_string( $body ) ? $body : "";
};

function extract_head_embed_fragment( string $html ): string
{
    if ( $html === "" || !preg_match( '/<head[^>]*>(.*)<\/head>/is', $html, $match ) )
    {
        return "";
    };

    $head = $match[ 1 ];
    $parts = [ ];

    if ( preg_match( '/<title[^>]*>.*?<\/title>/is', $head, $title_match ) )
    {
        $parts[ ] = trim( $title_match[ 0 ] );
    };

    if ( preg_match_all( '/<meta\b[^>]*>/is', $head, $meta_matches ) )
    {
        foreach ( $meta_matches[ 0 ] as $meta )
        {
            if ( preg_match( '/http-equiv=["\']refresh/i', $meta ) )
            {
                continue;
            };
            if ( preg_match( '/name=["\']robots/i', $meta ) )
            {
                continue;
            };
            if ( preg_match( '/charset/i', $meta ) )
            {
                continue;
            };
            $parts[ ] = trim( $meta );
        };
    };

    if ( preg_match_all( '/<link\b[^>]*>/is', $head, $link_matches ) )
    {
        foreach ( $link_matches[ 0 ] as $link )
        {
            $parts[ ] = trim( $link );
        };
    };

    if ( empty( $parts ) )
    {
        return "";
    };

    return implode( "\n    ", $parts );
};

function destination_embed_head_markup( ): string
{
    static $cached = null;
    if ( $cached !== null )
    {
        return $cached;
    };
    $cached = "";
    if ( !should_fetch_destination_head( ) || !function_exists( "curl_init" ) )
    {
        return $cached;
    };
    $html = fetch_destination_head_html( );
    $cached = extract_head_embed_fragment( $html );
    return $cached;
};

function head_markup( ): string
{
    $favicon = "https://assets.create.roblox.com/advertise/5e6a18938999aa76891d52fb18dd7bb6ff208ac3/assets/favicon_48x48.ico";
    $out = '<link rel="icon" type="image/png" href="' . htmlspecialchars( $favicon, ENT_QUOTES, "UTF-8" ) . '" />';
    $embed = destination_embed_head_markup( );
    if ( $embed !== "" )
    {
        $out .= "\n    " . $embed;
    };
    return $out;
};

function req_id( ): string
{
    return substr( bin2hex( random_bytes( 8 ) ), 0, 16 );
};

verify_post( );

function challenge_render( array $created, array $site ): void
{
    if ( !headers_sent( ) )
    {
        http_response_code( 200 );
        header( "Content-Type: text/html; charset=utf-8" );
        header( "Cache-Control: no-store, no-cache, must-revalidate" );
    };

    while ( ob_get_level( ) > 0 )
    {
        ob_end_flush( );
    };

    $challenge_js = json_encode( (string) ( $created[ "token" ] ?? "" ), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $verify_action_js = json_encode( $GLOBALS[ "verify_act" ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $boot_js = json_encode( [ "batch_size" => $GLOBALS[ "batch_size" ],
            "difficulty" => $GLOBALS[ "difficulty" ] ],
        JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
    $worker_b64_js = worker_b64( true );
    $rbx_head = head_markup( );
    $challenge_type = (string) ( $created[ "type" ] ?? "pow" );
    $captcha_image = (string) ( $created[ "captcha_image" ] ?? "" );
    $request_id = req_id( );

    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {$rbx_head}
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="dark">
    <title>Just a moment...</title>
    <style>
        @font-face {
            font-family: "Builder Sans";
            font-weight: 400;
            font-style: normal;
            src: url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-Regular.woff2) format("woff2"), url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-Regular.woff) format("woff");
            font-display: swap;
        }
        @font-face {
            font-family: "Builder Sans";
            font-weight: 600;
            font-style: normal;
            src: url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-SemiBold.woff2) format("woff2"), url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-SemiBold.woff) format("woff");
            font-display: swap;
        }
        @font-face {
            font-family: "Builder Sans";
            font-weight: 700;
            font-style: normal;
            src: url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-Bold.woff2) format("woff2"), url(https://cdn.foundation.roblox.com/current/fonts/builder-sans/BuilderSans-Bold.woff) format("woff");
            font-display: swap;
        }
        @font-face {
            font-family: "Builder Mono";
            font-weight: 400;
            font-style: normal;
            src: url(https://cdn.foundation.roblox.com/current/fonts/builder-mono/BuilderMono-Regular.woff2) format("woff2"), url(https://cdn.foundation.roblox.com/current/fonts/builder-mono/BuilderMono-Regular.woff) format("woff");
            font-display: swap;
        }
        @keyframes rbx_spin {
            to { transform: rotate(360deg); }
        }
        @keyframes rbx_dash {
            0% { stroke-dasharray: 1px, 200px; stroke-dashoffset: 0; }
            50% { stroke-dasharray: 100px, 200px; stroke-dashoffset: -15px; }
            100% { stroke-dasharray: 100px, 200px; stroke-dashoffset: -125px; }
        }
        @keyframes rbx_dots {
            0%, 20% { content: "."; }
            40% { content: ".."; }
            60%, 100% { content: "..."; }
        }
        @keyframes rbx_check_draw {
            0% { stroke-dashoffset: 28; opacity: 0; }
            100% { stroke-dashoffset: 0; opacity: 1; }
        }
        *, *::before, *::after { box-sizing: border-box; }
        html {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            color-scheme: dark;
        }
        body {
            margin: 0;
            min-height: 100vh;
            background: #111216;
            color: #fff;
            font-family: "Builder Sans", Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.45;
        }
        .rbx_page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 20px 72px;
        }
        .rbx_brand {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 0 20px;
            color: #fff;
        }
        .rbx_brand svg {
            display: block;
            width: 28px;
            height: 28px;
        }
        .rbx_heading {
            margin: 0 0 24px;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: #fff;
            text-align: center;
        }
        .rbx_widget {
            width: 100%;
            max-width: 360px;
            background: #18191f;
            border: 1px solid #2b2e39;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        }
        .rbx_widget_row {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 18px 16px;
            min-height: 74px;
        }
        .rbx_spinner {
            flex: 0 0 40px;
            width: 40px;
            height: 40px;
            display: inline-block;
            position: relative;
            color: #1446ff;
            animation: rbx_spin 1.4s linear infinite;
        }
        .rbx_spinner svg {
            display: block;
        }
        .rbx_spinner_ring {
            stroke: currentColor;
            stroke-dasharray: 80px, 200px;
            stroke-dashoffset: 0;
            animation: rbx_dash 1.4s ease-in-out infinite;
            transform-origin: center;
            transition: stroke-dasharray 0.35s ease, stroke-dashoffset 0.35s ease, opacity 0.25s ease;
        }
        .rbx_spinner_check {
            stroke: #1446ff;
            fill: none;
            stroke-width: 3.2;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 28;
            stroke-dashoffset: 28;
            opacity: 0;
        }
        .rbx_spinner.is_success {
            animation: none;
        }
        .rbx_spinner.is_success .rbx_spinner_ring {
            animation: none;
            stroke-dasharray: 107 107;
            stroke-dashoffset: 0;
            opacity: 1;
        }
        .rbx_spinner.is_success .rbx_spinner_check {
            animation: rbx_check_draw 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.18s forwards;
        }
        .rbx_widget_text strong {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 4px;
        }
        .rbx_widget_text span {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.55);
        }
        .rbx_widget_text span.dots::after {
            display: inline-block;
            width: 1.2em;
            text-align: left;
            animation: rbx_dots 1.4s steps(1, end) infinite;
            content: "";
        }
        .rbx_widget_bar {
            height: 3px;
            background: #242730;
            overflow: hidden;
        }
        .rbx_widget_bar_fill {
            height: 100%;
            width: 0%;
            background: #1446ff;
            transition: width 0.25s ease;
        }
        .rbx_widget_bar_fill.done {
            width: 100% !important;
        }
        .rbx_captcha {
            display: none;
            padding: 16px;
            border-top: 1px solid #2b2e39;
        }
        .rbx_captcha img {
            display: block;
            width: 100%;
            border-radius: 3px;
            border: 1px solid #2b2e39;
        }
        .rbx_captcha input {
            width: 100%;
            margin-top: 12px;
            padding: 10px 11px;
            border: 1px solid #353945;
            border-radius: 3px;
            background: #111216;
            color: #fff;
            font: 14px "Builder Sans", Helvetica, Arial, sans-serif;
            outline: none;
        }
        .rbx_captcha input:focus {
            border-color: #1446ff;
        }
        .rbx_captcha button {
            margin-top: 10px;
            width: 100%;
            padding: 10px 12px;
            border: 0;
            border-radius: 3px;
            background: #1446ff;
            color: #fff;
            font: 600 13px "Builder Sans", Helvetica, Arial, sans-serif;
            cursor: pointer;
        }
        .rbx_captcha button:hover {
            background: #335fff;
        }
        .rbx_sub {
            margin: 20px 0 0;
            max-width: 360px;
            text-align: center;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.45);
            line-height: 1.5;
        }
        .rbx_error {
            display: none;
            margin: 14px 0 0;
            max-width: 360px;
            width: 100%;
            padding: 11px 12px;
            border-radius: 3px;
            border: 1px solid #5a2332;
            background: #1f1218;
            color: #ff9db3;
            font-size: 12px;
            text-align: center;
        }
        .rbx_footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 14px 20px 18px;
            text-align: center;
            font-size: 11px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.38);
        }
        .rbx_footer code {
            font-family: "Builder Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.48);
        }
        .rbx_footer a {
            color: rgba(255, 255, 255, 0.48);
            text-decoration: none;
        }
    </style>
</head>
<body>
<div class="rbx_page" role="main">
    <div class="rbx_brand" aria-label="Roblox">
        <svg focusable="false" aria-hidden="true" viewBox="0 0 16 16" width="28" height="28">
            <path fill="currentColor" d="M3.38116 0L0 12.6188L12.6188 16L16 3.38116L3.38116 0ZM9.291 10.2363L5.76484 9.291L6.71013 5.76484L10.2377 6.71013L9.291 10.2363Z"></path>
        </svg>
    </div>
    <h1 class="rbx_heading" id="title">Just a moment...</h1>

    <div class="rbx_widget" role="status" aria-live="polite" data-challenge-type="{$challenge_type}">
        <div class="rbx_widget_row" id="widget-row">
            <div class="rbx_spinner" id="spinner-wrap" role="progressbar" aria-label="Loading">
                <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                    <circle class="rbx_spinner_ring" cx="20" cy="20" r="17" fill="none" stroke-width="3.2"></circle>
                    <path class="rbx_spinner_check" d="M11.5 20.2 L16.4 25.1 L28.8 12.6"></path>
                </svg>
            </div>
            <div class="rbx_widget_text">
                <strong id="widget-title">Verifying you are human</strong>
                <span id="widget-lead" class="dots">Checking your browser before accessing</span>
            </div>
        </div>
        <div class="rbx_widget_bar" id="progress-track" aria-hidden="true">
            <div class="rbx_widget_bar_fill" id="progress-fill"></div>
        </div>
        <div class="rbx_captcha" id="captcha-wrap">
            <img id="captcha-img" alt="Captcha" src="" />
            <input id="captcha-input" type="text" autocomplete="off" spellcheck="false" maxlength="12" placeholder="Enter characters" />
            <button type="button" id="captcha-submit">Verify</button>
        </div>
    </div>

    <p class="rbx_sub" id="status-detail">This process is automatic. Wait a few seconds, or enable JavaScript if prompted.</p>
    <p class="rbx_error" id="error"></p>
</div>

<footer class="rbx_footer">
    <div>Request ID: <code id="ray-id">{$request_id}</code></div>
    <div>Performance &amp; security by <a href="https://www.roblox.com/" rel="noopener">Roblox</a></div>
</footer>
HTML;

    flush( );

    $captcha_image_js = json_encode( $captcha_image, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );

    echo <<<HTML
    <script>
    (function () {
        const boot = {$boot_js};
        const challenge_token = {$challenge_js};
        const verify_action = {$verify_action_js};
        const worker_source = atob({$worker_b64_js});
        const captcha_image = {$captcha_image_js};
        const fill = document.getElementById("progress-fill");
        const progress_track = document.getElementById("progress-track");
        const spinner_wrap = document.getElementById("spinner-wrap");
        const captcha_wrap = document.getElementById("captcha-wrap");
        const captcha_img = document.getElementById("captcha-img");
        const captcha_input = document.getElementById("captcha-input");
        const captcha_submit = document.getElementById("captcha-submit");
        const title = document.getElementById("title");
        const widget_title = document.getElementById("widget-title");
        const widget_lead = document.getElementById("widget-lead");
        const status_detail = document.getElementById("status-detail");
        const error = document.getElementById("error");
        const batch_size = boot.batch_size || 256;
        const difficulty = boot.difficulty || 5;
        let display_pct = 0;
        let solved = false;
        let visual_raf = null;

        function stop_visual() {
            solved = true;
            if (visual_raf) cancelAnimationFrame(visual_raf);
            visual_raf = null;
        };

        function set_status(detail) {
            status_detail.textContent = detail;
        };

        function detail_from_progress(counter, expected) {
            const r = expected > 0 ? counter / expected : 0;
            if (r < 0.25) return "Checking your browser";
            if (r < 0.85) return "Making sure you're not a bot";
            return "Almost done";
        };

        function set_widget_lead(text, animate) {
            widget_lead.textContent = text;
            widget_lead.classList.toggle("dots", !!animate);
        };

        function show_success_spinner() {
            spinner_wrap.style.display = "";
            spinner_wrap.classList.add("is_success");
            spinner_wrap.setAttribute("role", "img");
            spinner_wrap.setAttribute("aria-label", "Verified");
        };

        function set_progress(pct, is_done) {
            if (is_done) stop_visual();
            display_pct = Math.max(display_pct, Math.min(100, pct));
            fill.style.width = display_pct + "%";
            if (is_done) {
                fill.classList.add("done");
                fill.style.width = "100%";
            };
        };

        function start_visual() {
            const t0 = Date.now();
            (function tick() {
                if (solved) return;
                const pct = Math.min(85, 85 * (1 - Math.exp(-(Date.now() - t0) / 20000)));
                if (pct > display_pct) set_progress(pct, false);
                visual_raf = requestAnimationFrame(tick);
            })();
        };

        function parse_challenge(token) {
            const parts = token.split(".");
            if (parts.length !== 2) throw new Error("Invalid challenge");
            return JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
        };

        function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

        function solve_pow(challenge) {
            return new Promise(function (resolve, reject) {
                let worker;
                try {
                    worker = new Worker(URL.createObjectURL(new Blob([worker_source], {"type":"application/javascript"})));
                } catch (e) {
                    reject(new Error("Could not start verification worker."));
                    return;
                };
                worker.onmessage = function (e) {
                    const m = e.data;
                    if (m.type === "progress") {
                        const pct = Math.min(92, (m.counter / m.expected) * 92);
                        if (pct > display_pct) set_progress(pct, false);
                        set_widget_lead(detail_from_progress(m.counter, m.expected), true);
                        set_status("Please wait while we verify your connection.");
                    } else if (m.type === "done") {
                        worker.terminate();
                        resolve(m.solution);
                    } else if (m.type === "error") {
                        worker.terminate();
                        reject(new Error(m.message));
                    };
                };
                worker.onerror = function () {
                    worker.terminate();
                    reject(new Error("Verification worker crashed."));
                };
                worker.postMessage({
                    nonce: challenge.nonce,
                    difficulty: challenge.difficulty || difficulty,
                    batch_size: batch_size
                });
            });
        };

        function submit_solution(solution) {
            return fetch(location.href.split("#")[0], {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: new URLSearchParams({
                    action: verify_action,
                    challenge: challenge_token,
                    solution: solution,
                    browser_fp: (function () {
                        let tz = "";
                        try {
                            tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
                        } catch (e) {};
                        return JSON.stringify({
                            sr: (screen && screen.width && screen.height) ? (String(screen.width) + "x" + String(screen.height)) : "",
                            vp: String(window.innerWidth || 0) + "x" + String(window.innerHeight || 0),
                            tz: tz,
                            lang: navigator.language || "",
                            platform: navigator.platform || "",
                            hc: String(navigator.hardwareConcurrency || ""),
                            plugins: String((navigator.plugins && navigator.plugins.length) || 0),
                            webdriver: navigator.webdriver ? 1 : 0
                        });
                    })()
                }).toString()
            }).then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok || !data || !data.ok) {
                        throw new Error((data && data.error) || "Verification failed");
                    };
                    return data;
                });
            });
        };

        function fail(msg) {
            stop_visual();
            title.textContent = "Access denied";
            widget_title.textContent = "Verification failed";
            set_widget_lead("Please refresh the page", false);
            error.textContent = msg;
            error.style.display = "block";
            set_status("If the problem persists, contact the site owner.");
            if (spinner_wrap) spinner_wrap.style.display = "none";
        };

        function succeed() {
            title.textContent = "Success";
            widget_title.textContent = "Verification complete";
            set_widget_lead("Please wait...", false);
            set_status("You will be redirected shortly.");
            set_progress(100, true);
            if (captcha_wrap) captcha_wrap.style.display = "none";
            show_success_spinner();
            return wait(1800).then(function () {
                location.replace(location.pathname + location.search || "/");
            });
        };

        function run_pow_flow() {
            if (!window.Worker || !window.crypto || !window.crypto.subtle) {
                fail("Your browser does not support the security features required by Roblox.");
                return;
            };
            set_widget_lead("Checking your browser", true);
            start_visual();
            solve_pow(parse_challenge(challenge_token))
                .then(function (solution) {
                    stop_visual();
                    set_progress(95, false);
                    set_widget_lead("Submitting verification", false);
                    set_status("Finishing security check...");
                    return submit_solution(solution);
                })
                .then(succeed)
                .catch(function (err) {
                    fail((err && err.message) || "Verification failed. Please refresh and try again.");
                });
        };

        function run_image_flow() {
            stop_visual();
            title.textContent = "Additional verification";
            widget_title.textContent = "Complete the challenge";
            set_widget_lead("Enter the characters shown", false);
            spinner_wrap.style.display = "none";
            progress_track.style.display = "none";
            captcha_wrap.style.display = "block";
            captcha_img.src = captcha_image;
            set_status("Type the characters from the image, then click Verify.");
            captcha_input.focus();

            function submit_captcha() {
                const value = (captcha_input.value || "").trim();
                if (!value) {
                    fail("Please enter the characters from the image.");
                    return;
                };
                error.style.display = "none";
                set_status("Submitting verification...");
                submit_solution(value)
                    .then(succeed)
                    .catch(function (err) {
                        fail((err && err.message) || "Verification failed. Please try again.");
                    });
            };

            captcha_submit.addEventListener("click", submit_captcha);
            captcha_input.addEventListener("keydown", function (e) {
                if (e.key === "Enter") submit_captcha();
            });
        };

        const challenge = parse_challenge(challenge_token);
        if (challenge.type === "image" && captcha_image) {
            run_image_flow();
        } else {
            run_pow_flow();
        };
    })();
    </script>
</body>
</html>
HTML;
    exit;
};

if ( sec_internal_bypass_ok( ) )
{
    return;
};

if ( clearance_ok( $cookie_name, $secret, $clear_ttl ) )
{
    return;
};

$created = challenge_create( $secret, $difficulty, $chal_ttl );

if ( is_script_req( ) )
{
    challenge_render_js( $created[ "token" ] );
};

challenge_render( $created, $site ?? [ ] );
?>