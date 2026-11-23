<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchRobloxAPI($url, $ua) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ($code === 200 && $res) ? json_decode($res, true) : null;
}

function injectIntoHead($html, $markup) {
    $headStart = stripos($html, '<head');
    if ($headStart === false) {
        return $markup . $html;
    }

    $insertAt = strpos($html, '>', $headStart);
    if ($insertAt === false) {
        return $markup . $html;
    }

    $insertAt++;
    return substr($html, 0, $insertAt) . $markup . substr($html, $insertAt);
}

function fetchHtmlDocument($url, $ua) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
            'Cache-Control: no-cache'
        ],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 400 && !empty($html)) {
        return $html;
    }

    return null;
}

function getProfileCachePath($targetUserId) {
    $cacheDir = __DIR__ . '/../.cache/profile-html';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0777, true);
    }
    return $cacheDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', (string) $targetUserId) . '.html';
}

function getCachedProfileHtml($targetUserId, $maxAgeSeconds) {
    $cachePath = getProfileCachePath($targetUserId);
    if (file_exists($cachePath) && (time() - filemtime($cachePath) <= $maxAgeSeconds)) {
        $cached = file_get_contents($cachePath);
        if (!empty($cached)) {
            return $cached;
        }
    }
    return null;
}

function saveCachedProfileHtml($targetUserId, $html) {
    if (empty($html)) return;
    @file_put_contents(getProfileCachePath($targetUserId), $html);
}

$userId = '';
if (preg_match('/\/users\/(\d+)/i', $_SERVER['REQUEST_URI'] ?? '', $m)) {
    $userId = $m[1];
} elseif (isset($_GET['id'])) {
    $userId = (string) $_GET['id'];
}
if ($userId === '') {
    $userId = '855367619';
}

$profilesFile = __DIR__ . '/../fake_profiles.json';
$fakeProfile = null;
$targetUserId = $userId;

if (file_exists($profilesFile)) {
    $profiles = json_decode(file_get_contents($profilesFile), true);
    if (isset($profiles[$userId])) {
        $fakeProfile = $profiles[$userId];
        if (!empty($fakeProfile['realUserId'])) {
            $targetUserId = (string) $fakeProfile['realUserId'];
        }
    }
}

$fakeUsername = $fakeProfile['fakeUsername'] ?? '';
$fakeDisplayName = $fakeProfile['fakeDisplayName'] ?? $fakeUsername;
$fakeBio = $fakeProfile['fakeBio'] ?? '';
$friendsCount = (int) ($fakeProfile['friends'] ?? 0);
$followersCount = (int) ($fakeProfile['followers'] ?? 0);
$followingCount = (int) ($fakeProfile['followings'] ?? 0);
$avatarUrl = $fakeProfile['avatarUrl'] ?? '';

$realDisplayName = '';
$realUsername = '';
if ($targetUserId !== '') {
    $realProfileData = fetchRobloxAPI("https://users.roblox.com/v1/users/{$targetUserId}", $USER_AGENT);
    if ($realProfileData) {
        $realDisplayName = $realProfileData['displayName'] ?? '';
        $realUsername = $realProfileData['name'] ?? '';
    }

    if ($avatarUrl === '') {
        $avatarData = fetchRobloxAPI(
            "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={$targetUserId}&size=420x420&format=Png&isCircular=false",
            $USER_AGENT
        );
        if (!empty($avatarData['data'][0]['imageUrl'])) {
            $avatarUrl = $avatarData['data'][0]['imageUrl'];
        }
    }
}

$html = getCachedProfileHtml($targetUserId, 120);
if ($html === null) {
    $html = fetchHtmlDocument("http://localhost/rblx-profile/users/{$targetUserId}/profile", $USER_AGENT);
    if ($html === null) {
        $html = fetchHtmlDocument("https://www.roblox.com/users/{$targetUserId}/profile", $USER_AGENT);
    }
    if ($html !== null) {
        saveCachedProfileHtml($targetUserId, $html);
    }
}

if ($html === null) {
    http_response_code(502);
    echo 'Failed to fetch profile from Roblox';
    exit;
}

$host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
$html = strtr($html, [
    'https://www.roblox.com/' => '//' . $host . '/',
    'https://roblox.com/' => '//' . $host . '/',
    'https://tr.rbxcdn.com/' => '/thumbnails/',
    'https://images.rbxcdn.com/' => '/imgrbx/',
    'https://css.rbxcdn.com/' => '/rbxcdn/',
    'https://js.rbxcdn.com/' => '/rblx-js/',
    'https://static.rbxcdn.com/' => '/staticrbx/',
]);

$proxyShim = '';
$proxyShimFile = __DIR__ . '/proxy-shim.js';
if (file_exists($proxyShimFile)) {
    $proxyShim = file_get_contents($proxyShimFile) ?: '';
}

$injectedMarkup =
    '<script>window.__FAKE_PROFILE__=' . json_encode([
        'username' => $fakeUsername,
        'displayName' => $fakeDisplayName,
        'bio' => $fakeBio,
        'friends' => $friendsCount,
        'followers' => $followersCount,
        'following' => $followingCount,
        'avatarUrl' => $avatarUrl,
        'targetUserId' => $targetUserId,
        'realUsername' => $realUsername,
        'realDisplayName' => $realDisplayName,
        'loginRedirect' => '/login.php?returnUrl=' . rawurlencode($_SERVER['REQUEST_URI'] ?? '/') . '&profileId=' . rawurlencode($targetUserId),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';</script>' .
    '<script>' . $proxyShim . '</script>' .
    <<<'SCRIPT'
<style>
.fake-current-wearing-section .fake-current-wearing-layout {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
}

.fake-current-wearing-section .fake-current-wearing-avatar-card,
.fake-current-wearing-section .fake-current-wearing-assets-card {
    background: #272930;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px;
}

.fake-current-wearing-section .fake-current-wearing-avatar-card img {
    aspect-ratio: 1 / 1;
    border-radius: 10px;
    display: block;
    height: auto;
    object-fit: cover;
    width: 100%;
}

.fake-current-wearing-section .fake-current-wearing-avatar-label,
.fake-current-wearing-section .fake-current-wearing-status {
    color: #b8bcc7;
    font-size: 13px;
    line-height: 1.4;
    margin-top: 10px;
}

.fake-current-wearing-section .fake-current-wearing-status {
    margin: 0;
}

.fake-current-wearing-section .fake-current-wearing-assets-header {
    align-items: baseline;
    display: flex;
    gap: 8px;
    justify-content: space-between;
    margin-bottom: 12px;
}

.fake-current-wearing-section .fake-current-wearing-assets-header h4 {
    color: #ffffff;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
}

.fake-current-wearing-section .fake-current-wearing-count {
    color: #9aa0ab;
    font-size: 12px;
    text-transform: uppercase;
}

.fake-current-wearing-section .fake-current-wearing-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.fake-current-wearing-section .fake-current-wearing-item {
    background: #1f2024;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    color: inherit;
    display: block;
    overflow: hidden;
    text-decoration: none;
}

.fake-current-wearing-section .fake-current-wearing-item:hover {
    border-color: rgba(255, 255, 255, 0.16);
    text-decoration: none;
}

.fake-current-wearing-section .fake-current-wearing-thumb {
    align-items: center;
    aspect-ratio: 1 / 1;
    background: #111216;
    display: flex;
    justify-content: center;
}

.fake-current-wearing-section .fake-current-wearing-thumb img {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
}

.fake-current-wearing-section .fake-current-wearing-fallback {
    color: #7d828d;
    font-size: 28px;
    font-weight: 700;
}

.fake-current-wearing-section .fake-current-wearing-meta {
    padding: 10px;
}

.fake-current-wearing-section .fake-current-wearing-title {
    color: #f2f4f7;
    display: block;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
}

.fake-current-wearing-section .fake-current-wearing-id {
    color: #9aa0ab;
    display: block;
    font-size: 12px;
    margin-top: 4px;
}

@media (max-width: 991px) {
    .fake-current-wearing-section .fake-current-wearing-layout {
        grid-template-columns: 1fr;
    }
}
</style>
<script>
(function () {
    'use strict';

    const fake = window.__FAKE_PROFILE__ || {};
    let lastPatchedSignature = '';
    let currentWearingLoadedFor = '';
    let currentWearingLoading = false;
    let playerBadgesLoadedFor = '';
    let playerBadgesLoading = false;

    function replaceText(selectors, value) {
        if (!value && value !== 0) return;
        document.querySelectorAll(selectors).forEach((el) => {
            if (!el || !el.textContent || !el.textContent.trim()) return;
            if (el.textContent !== String(value)) {
                el.textContent = value;
            }
        });
    }

    function toLocalImage(url) {
        if (!url) return '';
        if (url.startsWith('/proxy/image?url=')) return url;
        if (/^https:\/\/(?:tr\.rbxcdn\.com|images\.rbxcdn\.com|thumbnails\.roblox\.com|static\.rbxcdn\.com|css\.rbxcdn\.com|js\.rbxcdn\.com)\//i.test(url)) {
            return '/proxy/image?url=' + encodeURIComponent(url);
        }
        return url;
    }

    function ensureCurrentWearingSection() {
        let section = document.querySelector('.fake-current-wearing-section');
        if (section) return section;

        const anchor = document.querySelector('.groups-showcase, #roblox-badges-container, #player-badges-container');
        if (!anchor || !anchor.parentNode) return null;

        section = document.createElement('div');
        section.className = 'section fake-current-wearing-section';
        section.innerHTML = [
            '<div class="container-header">',
            '  <h3>Currently Wearing</h3>',
            '</div>',
            '<div class="section-content">',
            '  <div class="fake-current-wearing-layout">',
            '    <div class="fake-current-wearing-avatar-card">',
            '      <div class="fake-current-wearing-thumb"><span class="fake-current-wearing-fallback">3D</span></div>',
            '      <div class="fake-current-wearing-avatar-label">Loading full avatar preview...</div>',
            '    </div>',
            '    <div class="fake-current-wearing-assets-card">',
            '      <div class="fake-current-wearing-assets-header">',
            '        <h4>Accessories</h4>',
            '        <span class="fake-current-wearing-count">0 items</span>',
            '      </div>',
            '      <p class="fake-current-wearing-status">Loading worn accessories...</p>',
            '      <div class="fake-current-wearing-grid"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        anchor.parentNode.insertBefore(section, anchor);
        return section;
    }

    function renderCurrentWearing(avatarUrl, assetIds, thumbnailMap) {
        const section = ensureCurrentWearingSection();
        if (!section) return;

        const avatarCard = section.querySelector('.fake-current-wearing-avatar-card');
        const statusEl = section.querySelector('.fake-current-wearing-status');
        const countEl = section.querySelector('.fake-current-wearing-count');
        const gridEl = section.querySelector('.fake-current-wearing-grid');

        if (avatarCard) {
            const resolvedAvatarUrl = toLocalImage(avatarUrl || fake.avatarUrl || '');
            avatarCard.innerHTML = resolvedAvatarUrl
                ? '<img src="' + resolvedAvatarUrl + '" alt="Avatar preview"><div class="fake-current-wearing-avatar-label">Live avatar render from Roblox.</div>'
                : '<div class="fake-current-wearing-thumb"><span class="fake-current-wearing-fallback">3D</span></div><div class="fake-current-wearing-avatar-label">Avatar preview unavailable.</div>';
        }

        if (countEl) {
            countEl.textContent = assetIds.length + (assetIds.length === 1 ? ' item' : ' items');
        }

        if (!gridEl || !statusEl) return;

        if (!assetIds.length) {
            statusEl.textContent = 'No currently worn accessories were returned by Roblox.';
            gridEl.innerHTML = '';
            return;
        }

        statusEl.textContent = 'Showing live accessory thumbnails from Roblox.';
        gridEl.innerHTML = assetIds.map((assetId, index) => {
            const thumbUrl = toLocalImage(thumbnailMap[assetId] || '');
            const thumbMarkup = thumbUrl
                ? '<img src="' + thumbUrl + '" alt="Accessory ' + (index + 1) + '">'
                : '<span class="fake-current-wearing-fallback">#</span>';

            return [
                '<a class="fake-current-wearing-item" href="' + (fake.loginRedirect || '/login.php') + '">',
                '  <div class="fake-current-wearing-thumb">' + thumbMarkup + '</div>',
                '  <div class="fake-current-wearing-meta">',
                '    <span class="fake-current-wearing-title">Worn Accessory</span>',
                '    <span class="fake-current-wearing-id">Asset #' + assetId + '</span>',
                '  </div>',
                '</a>'
            ].join('');
        }).join('');
    }

    async function loadCurrentWearing() {
        const targetUserId = String(fake.targetUserId || '').trim();
        if (!targetUserId || currentWearingLoading || currentWearingLoadedFor === targetUserId) {
            return;
        }

        const section = ensureCurrentWearingSection();
        if (!section) {
            return;
        }

        currentWearingLoading = true;
        const statusEl = section.querySelector('.fake-current-wearing-status');
        if (statusEl) {
            statusEl.textContent = 'Loading worn accessories...';
        }

        try {
            const [wearingRes, avatarRes] = await Promise.all([
                fetch('/rblx-avatar/v1/users/' + encodeURIComponent(targetUserId) + '/currently-wearing'),
                fetch('/rblx-thumbnails-api/v1/users/avatar?userIds=' + encodeURIComponent(targetUserId) + '&size=720x720&format=Png&isCircular=false')
            ]);

            const wearingData = await wearingRes.json();
            const avatarData = await avatarRes.json();

            const assetIds = Array.isArray(wearingData.assetIds) ? wearingData.assetIds.slice(0, 18) : [];
            const avatarUrl = avatarData && avatarData.data && avatarData.data[0] ? avatarData.data[0].imageUrl : '';
            const thumbnailMap = {};

            if (assetIds.length > 0) {
                const thumbsRes = await fetch('/rblx-thumbnails-api/v1/assets?assetIds=' + assetIds.join(',') + '&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false');
                const thumbsData = await thumbsRes.json();
                (thumbsData.data || []).forEach((entry) => {
                    if (entry && entry.targetId) {
                        thumbnailMap[entry.targetId] = entry.imageUrl || '';
                    }
                });
            }

            renderCurrentWearing(avatarUrl, assetIds, thumbnailMap);
            currentWearingLoadedFor = targetUserId;
        } catch (error) {
            if (statusEl) {
                statusEl.textContent = 'Unable to load Roblox accessories right now.';
            }
        } finally {
            currentWearingLoading = false;
        }
    }

    function ensurePlayerBadgesSection() {
        let section = document.querySelector('.fake-player-badges-section');
        if (section) return section;

        const wearingSection = document.querySelector('.fake-current-wearing-section');
        if (!wearingSection || !wearingSection.parentNode) return null;

        section = document.createElement('div');
        section.className = 'section fake-player-badges-section';
        section.innerHTML = [
            '<div class="container-header">',
            '  <h3>Player Badges</h3>',
            '</div>',
            '<div class="section-content">',
            '  <p class="fake-player-badges-status" style="margin-bottom:10px;">Loading badges...</p>',
            '  <div class="fake-player-badges-list" style="display: flex; flex-wrap: wrap; gap: 10px;"></div>',
            '</div>'
        ].join('');

        wearingSection.parentNode.insertBefore(section, wearingSection.nextSibling);
        return section;
    }

    function renderPlayerBadges(badges, thumbnailMap) {
        const section = ensurePlayerBadgesSection();
        if (!section) return;

        const statusEl = section.querySelector('.fake-player-badges-status');
        const listEl = section.querySelector('.fake-player-badges-list');

        if (!listEl || !statusEl) return;

        if (!badges.length) {
            statusEl.textContent = 'This user has no badges or they failed to load.';
            listEl.innerHTML = '';
            return;
        }

        statusEl.textContent = 'Showing live badges from Roblox.';
        listEl.innerHTML = badges.map((badge, index) => {
            const thumbUrl = toLocalImage(thumbnailMap[badge.id] || '');
            const thumbMarkup = thumbUrl
                ? '<img src="' + thumbUrl + '" alt="Badge" style="width: 75px; height: 75px; border-radius: 8px;">'
                : '<div style="width: 75px; height: 75px; background: #333; border-radius: 8px;"></div>';

            return [
                '<a class="fake-badge-item" href="' + (fake.loginRedirect || '/login.php') + '" style="display: flex; gap: 15px; width: 100%; min-width: 300px; flex: 1 1 calc(50% - 10px); padding: 15px; background: #232527; border-radius: 8px; text-decoration: none; color: inherit;">',
                '  <div class="fake-badge-thumb" style="flex-shrink: 0;">' + thumbMarkup + '</div>',
                '  <div class="fake-badge-meta" style="display: flex; flex-direction: column; justify-content: center; overflow: hidden;">',
                '    <strong style="font-size: 16px; margin-bottom: 6px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">' + (badge.name || 'Unknown Badge') + '</strong>',
                '    <span style="font-size: 14px; color: #b8b8b8; line-height: 1.4;">' + (badge.description || '').substring(0, 80) + (badge.description && badge.description.length > 80 ? '...' : '') + '</span>',
                '  </div>',
                '</a>'
            ].join('');
        }).join('');
    }

    async function loadPlayerBadges() {
        const targetUserId = String(fake.targetUserId || '').trim();
        if (!targetUserId || playerBadgesLoading || playerBadgesLoadedFor === targetUserId) {
            return;
        }

        const section = ensurePlayerBadgesSection();
        if (!section) return;

        playerBadgesLoading = true;
        const statusEl = section.querySelector('.fake-player-badges-status');
        if (statusEl) statusEl.textContent = 'Loading badges...';

        try {
            const badgesRes = await fetch('/rblx-badges/v1/users/' + encodeURIComponent(targetUserId) + '/badges?limit=10&sortOrder=Desc');
            const badgesData = await badgesRes.json();
            const badges = Array.isArray(badgesData.data) ? badgesData.data : [];
            const badgeIds = badges.map(b => b.id);
            const thumbnailMap = {};

            if (badgeIds.length > 0) {
                const thumbsRes = await fetch('/rblx-thumbnails-api/v1/badges/icons?badgeIds=' + badgeIds.join(',') + '&size=150x150&format=Png&isCircular=false');
                const thumbsData = await thumbsRes.json();
                (thumbsData.data || []).forEach((entry) => {
                    if (entry && entry.targetId) {
                        thumbnailMap[entry.targetId] = entry.imageUrl || '';
                    }
                });
            }

            renderPlayerBadges(badges, thumbnailMap);
            playerBadgesLoadedFor = targetUserId;
        } catch (error) {
            if (statusEl) statusEl.textContent = 'Unable to load badges right now.';
        } finally {
            playerBadgesLoading = false;
        }
    }

    let patchTimer = null;
    function patchProfile() {
        if (fake.displayName) {
            document.title = fake.displayName + ' - Roblox';
        }
        
        function replaceExactText(oldVal, newVal) {
            if (!oldVal || !newVal) return;
            var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            var node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.includes(oldVal)) {
                    var val = node.nodeValue;
                    if (val.trim() === oldVal) {
                        node.nodeValue = val.replace(oldVal, newVal);
                    } else if (val.trim() === '@' + oldVal) {
                        node.nodeValue = val.replace('@' + oldVal, '@' + newVal);
                    }
                }
            }
        }

        if (fake.realDisplayName) replaceExactText(fake.realDisplayName, fake.displayName || fake.username);
        if (fake.realUsername) replaceExactText(fake.realUsername, fake.username || fake.displayName);

        replaceText('.profile-description, .bio, .description, [data-testid="description"], [data-testid="profile-description"]', fake.bio);
        replaceText('.friend-count, .friends-count, [data-testid="friend-count"]', Number(fake.friends || 0).toLocaleString());
        replaceText('.follower-count, .followers-count, [data-testid="follower-count"]', Number(fake.followers || 0).toLocaleString());
        replaceText('.following-count, .followings-count, [data-testid="following-count"]', Number(fake.following || 0).toLocaleString());
        ensureCurrentWearingSection();
    }

    document.addEventListener('click', function (event) {
        const button = event.target.closest('button, a');
        if (!button) return;

        const text = (button.textContent || '').toLowerCase();
        const href = (button.getAttribute('href') || '').toLowerCase();
        if (text.includes('friend') || text.includes('follow') || text.includes('add') || text.includes('join') || text.includes('log in') || text.includes('sign in') || text.includes('login') || href.includes('/login')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            window.location.href = fake.loginRedirect || '/login.php';
        }
    }, true);

    patchProfile();
    setTimeout(loadCurrentWearing, 300);
    setTimeout(loadPlayerBadges, 400);
    const observer = new MutationObserver(() => {
        observer.disconnect();
        setTimeout(() => {
            patchProfile();
            loadCurrentWearing();
            loadPlayerBadges();
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }, 150);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(patchProfile, 250);
    setTimeout(() => observer.disconnect(), 10000);
})();
</script>
SCRIPT;

$html = injectIntoHead($html, $injectedMarkup);
echo $html;
?>
