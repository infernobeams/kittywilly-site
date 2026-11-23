
// ══════════════════════════════════════════════
//  ULTIMA ENGINE: STARFIELD & DOCK NAVIGATION
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
//  FLOATING GRAY DOTS CANVAS — GLOBAL DASHBOARD BACKGROUND
// ══════════════════════════════════════════════════════════════════════
let globalGrayDotsActive = false;
function initStarfield() {
    if (globalGrayDotsActive) return;
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let dots = [];
    let mouse = { x: -2000, y: -2000 };

    function resize() {
        W = canvas.width = window.innerWidth || document.documentElement.clientWidth || 1;
        H = canvas.height = window.innerHeight || document.documentElement.clientHeight || 1;
    }
    resize();
    globalGrayDotsActive = true;

    const COUNT = window.innerWidth < 768 ? 140 : 250;
    dots = [];
    for (let i = 0; i < COUNT; i++) {
        const shade = Math.floor(Math.random() * 35) + 165; // 165-200 silvery floating gray
        dots.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.32,
            vy: (Math.random() - 0.5) * 0.32,
            r: Math.random() * 2.0 + 1.2, // 1.2px to 3.2px floating gray dots
            baseAlpha: Math.random() * 0.32 + 0.38, // 0.38 to 0.70 distinct alpha
            phase: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.4 + 0.25,
            shade: shade
        });
    }

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });

    function render() {
        if (!document.getElementById('bgCanvas')) return;
        ctx.clearRect(0, 0, W, H);
        const t = Date.now() * 0.001;
        const len = dots.length;

        // Draw connecting constellation lines between nearby floating gray dots
        for (let i = 0; i < len; i++) {
            const p1 = dots[i];
            for (let j = i + 1; j < len; j++) {
                const p2 = dots[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 6400) { // 80px
                    const dist = Math.sqrt(distSq);
                    const lineAlpha = (1 - dist / 80) * 0.16;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(175, 180, 195, ${lineAlpha})`;
                    ctx.lineWidth = 0.65;
                    ctx.stroke();
                }
            }
        }

        // Draw and update each floating gray dot
        for (let i = 0; i < len; i++) {
            const p = dots[i];
            // Organic floating drift with gentle wave oscillation
            p.x += p.vx + Math.sin(t * p.swaySpeed + p.phase) * 0.12;
            p.y += p.vy + Math.cos(t * p.swaySpeed + p.phase) * 0.12;

            // Subtle mouse repulsion
            const mdx = p.x - mouse.x;
            const mdy = p.y - mouse.y;
            const mDistSq = mdx * mdx + mdy * mdy;
            if (mDistSq < 14400 && mDistSq > 0) { // 120px
                const mDist = Math.sqrt(mDistSq);
                const force = (1 - mDist / 120) * 0.4;
                p.x += (mdx / mDist) * force;
                p.y += (mdy / mDist) * force;
            }

            // Screen edge wrap
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;

            const alpha = Math.min(0.85, Math.max(0.22, p.baseAlpha + Math.sin(t * 0.6 + p.phase) * 0.14));
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            if (p.r > 2.0) {
                ctx.shadowColor = `rgba(${p.shade}, ${p.shade}, ${p.shade}, 0.35)`;
                ctx.shadowBlur = 5;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = `rgba(${p.shade}, ${p.shade}, ${p.shade}, ${alpha})`;
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        requestAnimationFrame(render);
    }
    render();

    window.addEventListener('resize', () => {
        resize();
    });
}

// ══════════════════════════════════════════════════════════════════════
//  WHITE MOVING DOTS CANVAS — SETTINGS TAB BACKGROUND
// ══════════════════════════════════════════════════════════════════════
let settingsDotsInitialized = false;
let resizeSettingsDotsCanvasFn = null;

function initSettingsDotsCanvas() {
    const canvas = document.getElementById('settingsDotsCanvas');
    const tab = document.getElementById('settings-tab');
    if (!canvas || !tab) return;
    if (settingsDotsInitialized) {
        if (resizeSettingsDotsCanvasFn) resizeSettingsDotsCanvasFn();
        return;
    }

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let whiteDots = [];

    function resize() {
        if (!canvas || !tab) return;
        const rect = tab.getBoundingClientRect();
        W = canvas.width = Math.max(tab.clientWidth || 0, rect.width || 0, window.innerWidth || 800);
        H = canvas.height = Math.max(tab.clientHeight || 0, tab.scrollHeight || 0, 750);
    }
    resizeSettingsDotsCanvasFn = resize;
    resize();
    settingsDotsInitialized = true;

    const WHITE_COUNT = window.innerWidth < 768 ? 75 : 125;
    whiteDots = [];
    for (let i = 0; i < WHITE_COUNT; i++) {
        whiteDots.push({
            x: Math.random() * (W || 1000),
            y: Math.random() * (H || 800),
            vx: (Math.random() - 0.5) * 0.65,
            vy: (Math.random() - 0.5) * 0.65,
            r: Math.random() * 2.2 + 1.6, // 1.6px to 3.8px bright white dots
            baseAlpha: Math.random() * 0.45 + 0.45, // 0.45 to 0.90
            phase: Math.random() * Math.PI * 2
        });
    }

    function renderSettings() {
        if (!document.getElementById('settingsDotsCanvas')) return;
        const isTabActive = tab.classList.contains('active');
        if (isTabActive) {
            ctx.clearRect(0, 0, W, H);
            const t = Date.now() * 0.001;
            const len = whiteDots.length;

            // Draw white constellation links
            for (let i = 0; i < len; i++) {
                const p1 = whiteDots[i];
                for (let j = i + 1; j < len; j++) {
                    const p2 = whiteDots[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < 10000) { // 100px
                        const dist = Math.sqrt(distSq);
                        const lineAlpha = (1 - dist / 100) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                    }
                }
            }

            // Draw glowing white dots
            for (let i = 0; i < len; i++) {
                const p = whiteDots[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = W;
                if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H;
                if (p.y > H) p.y = 0;

                const alpha = Math.min(1.0, Math.max(0.3, p.baseAlpha + Math.sin(t * 0.8 + p.phase) * 0.18));
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
                ctx.shadowBlur = 8;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
        requestAnimationFrame(renderSettings);
    }
    renderSettings();

    window.addEventListener('resize', () => {
        resize();
    });
}

function switchMainTab(tabName, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(`${tabName}-tab`);
    if (targetPanel) targetPanel.classList.add('active');

    if (tabName === 'settings') {
        if (typeof loadSettingsWebhook === 'function') loadSettingsWebhook();
        if (typeof initSettingsDotsCanvas === 'function') initSettingsDotsCanvas();
        if (typeof resizeSettingsDotsCanvasFn === 'function') {
            setTimeout(resizeSettingsDotsCanvasFn, 50);
        }
    }

    document.querySelectorAll('.dock-item[data-tab]').forEach(item => {
        const isMatch = item.dataset.tab === tabName;
        item.classList.toggle('active', isMatch);
        const track = item.querySelector('.dock-progress-track');
        const bar = item.querySelector('.dock-progress-bar');
        if (isMatch && bar) {
            bar.classList.add('loading');
            setTimeout(() => bar.classList.remove('loading'), 400);
        }
    });

    const dd = document.getElementById('headerDropdown');
    if (dd) dd.classList.remove('show');
    const u = document.getElementById('headerUser');
    if (u) u.classList.remove('open');
}
window.switchTab = switchMainTab;


function toggleHeaderDropdown(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('headerDropdown');
    const u = document.getElementById('headerUser');
    if (dd) dd.classList.toggle('show');
    if (u) u.classList.toggle('open');
}

window.addEventListener('click', (e) => {
    const dd = document.getElementById('headerDropdown');
    const u = document.getElementById('headerUser');
    if (dd && !dd.contains(e.target) && !u?.contains(e.target)) {
        dd.classList.remove('show');
        if (u) u.classList.remove('open');
    }
});

function buildMiniChart(containerId, labelId, pctId, data, labels, tooltipLabel) {
    const c = document.getElementById(containerId);
    const l = document.getElementById(labelId);
    const p = document.getElementById(pctId);
    if (!c) return;
    const mx = Math.max.apply(null, data) || 1;
    const tl = tooltipLabel || 'Count';
    const today = data[data.length - 1] || 0;
    const yesterday = data[data.length - 2] || 0;
    const pct = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : (today > 0 ? 100 : 0);

    c.innerHTML = '';
    if (l) l.innerHTML = '';

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        const h = val > 0 ? Math.max(((val / mx) * 100), 12) : 12;
        const bar = document.createElement('div');
        bar.className = 'stat-mini-bar' + (val === 0 ? ' zero' : '');
        bar.style.height = h + '%';
        bar.setAttribute('data-val', val);
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

    if (!c.dataset.tooltipBound) {
        c.dataset.tooltipBound = '1';
        c.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('globalStatTooltip');
            if (!tt) return;
            const bars = c.querySelectorAll('.stat-mini-bar');
            let hit = null;
            for (let j = 0; j < bars.length; j++) {
                const br = bars[j].getBoundingClientRect();
                if (e.clientX >= br.left && e.clientX <= br.right) { hit = bars[j]; break; }
            }
            if (!hit) { tt.style.opacity = '0'; return; }
            const val = hit.getAttribute('data-val');
            const lbl = hit.getAttribute('data-label');
            const tlbl = hit.getAttribute('data-tl');
            tt.innerHTML = `
                <div style="font-weight:700;color:#fff;margin-bottom:4px;font-family:'Rajdhani',sans-serif;">${lbl}</div>
                <div style="display:flex;align-items:center;gap:6px;font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.7);">
                    <span style="color:rgba(255,255,255,0.4);">${tlbl}:</span>
                    <span style="color:#fff;font-weight:700;">${val}</span>
                </div>
            `;
            const r = hit.getBoundingClientRect();
            tt.style.left = (r.left + r.width / 2 - 45) + 'px';
            tt.style.top = (r.top - 55) + 'px';
            tt.style.opacity = '1';
        });
        c.addEventListener('mouseleave', () => {
            const tt = document.getElementById('globalStatTooltip');
            if (tt) tt.style.opacity = '0';
        });
    }
}

function buildSummaryMini(cId, lId, pId, data, labels, clr, tooltipLabel) {
    const c = document.getElementById(cId);
    const l = document.getElementById(lId);
    const p = document.getElementById(pId);
    if (!c) return;
    const mx = Math.max.apply(null, data) || 1;
    const today = data[data.length - 1] || 0;
    const yest = data[data.length - 2] || 0;
    const pct = yest > 0 ? Math.round(((today - yest) / yest) * 100) : (today > 0 ? 100 : 0);

    c.innerHTML = '';
    if (l) l.innerHTML = '';

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        const h = val > 0 ? Math.max(((val / mx) * 100), 12) : 12;
        const bar = document.createElement('div');
        bar.className = 'summary-mini-bar' + (val === 0 ? ' zero' : '');
        bar.style.height = h + '%';
        bar.setAttribute('data-val', val);
        bar.setAttribute('data-label', labels[i] || '');
        bar.setAttribute('data-tl', tooltipLabel || 'Total');
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

    if (!c.dataset.tooltipBound) {
        c.dataset.tooltipBound = '1';
        c.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('globalStatTooltip');
            if (!tt) return;
            const bars = c.querySelectorAll('.summary-mini-bar');
            let hit = null;
            for (let j = 0; j < bars.length; j++) {
                const br = bars[j].getBoundingClientRect();
                if (e.clientX >= br.left && e.clientX <= br.right) { hit = bars[j]; break; }
            }
            if (!hit) { tt.style.opacity = '0'; return; }
            const val = hit.getAttribute('data-val');
            const lbl = hit.getAttribute('data-label');
            const tlbl = hit.getAttribute('data-tl');
            tt.innerHTML = `
                <div style="font-weight:700;color:#fff;margin-bottom:4px;font-family:'Rajdhani',sans-serif;">${lbl}</div>
                <div style="display:flex;align-items:center;gap:6px;font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.7);">
                    <span style="color:rgba(255,255,255,0.4);">${tlbl}:</span>
                    <span style="color:#fff;font-weight:700;">${val}</span>
                </div>
            `;
            const r = hit.getBoundingClientRect();
            tt.style.left = (r.left + r.width / 2 - 45) + 'px';
            tt.style.top = (r.top - 55) + 'px';
            tt.style.opacity = '1';
        });
        c.addEventListener('mouseleave', () => {
            const tt = document.getElementById('globalStatTooltip');
            if (tt) tt.style.opacity = '0';
        });
    }
}


// ══════════════════════════════════════════════
//  TOAST SYSTEM
// ══════════════════════════════════════════════
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
window.alert = function(message) {
    let type = 'info';
    const msgLower = String(message).toLowerCase();
    if (msgLower.includes('success') || msgLower.includes('copied') || msgLower.includes('sent') || msgLower.includes('created') || msgLower.includes('connected') || msgLower.includes('saved')) {
        type = 'success';
    } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('invalid') || msgLower.includes('please') || msgLower.includes('network') || msgLower.includes('enter') || msgLower.includes('did not') || msgLower.includes('first')) {
        type = 'error';
    }
    showToast(message, type);
};

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let profileState = {
    realUserId: null,
    avatarUrl: null,
    fetchedForUsername: null
};

const STATUS_COLORS = {
    'Online': '#22c55e',
    'In Game': '#3b82f6',
    'In Studio': '#f97316',
    'Offline': '#6b7280'
};

// ══════════════════════════════════════════════
//  USER SESSION
// ══════════════════════════════════════════════
async function loadUserData() {
    try {
        const res = await fetch('/api/user');
        const user = await res.json();
        if (user.error) { showGuestHeader(); return; }
        document.body.dataset.username = user.username || 'Guest';
        document.getElementById('headerUsername').textContent = user.username || 'Guest';
        const opName = document.getElementById('operatorCardName');
        if (opName && user.username) opName.textContent = user.username;
        const opRole = document.getElementById('operatorCardRole');
        if (opRole) opRole.textContent = 'Member';
        const opAvatar = document.getElementById('operatorCardAvatar');
        if (opAvatar && user.id) {
            const avatarUrl = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
            opAvatar.innerHTML = `<img src="${avatarUrl}" alt="${user.username}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
        const avatarImg = document.getElementById('headerAvatar');
        avatarImg.src = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        avatarImg.onerror = () => { avatarImg.src = `https://cdn.discordapp.com/embed/avatars/0.png`; };
        
        ['acc', 'visits', 'clicks'].forEach(prefix => {
            const uName = document.getElementById(`${prefix}UserName`);
            if (uName) uName.textContent = user.username || 'Guest';
            const uAvatar = document.getElementById(`${prefix}UserAvatar`);
            if (uAvatar) {
                uAvatar.src = user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                uAvatar.onerror = () => { uAvatar.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; };
            }
        });
    
        applyTabTitle(currentTab());
    } catch (e) { showGuestHeader(); }
}

function showGuestHeader() {
    document.body.dataset.username = 'Guest';
    const nameEl = document.getElementById('headerUsername');
    if (nameEl) nameEl.textContent = 'Guest';
    const widget = document.getElementById('headerProfile');
    if (widget) widget.style.display = 'flex';
    applyTabTitle(currentTab());
}

function currentTab() {
    const active = document.querySelector('.menu-item-link.active');
    return active ? active.dataset.tab : 'main';
}

function applyTabTitle(tab) {
    const link = document.querySelector(`.menu-item-link[data-tab="${tab}"]`);
    const name = document.body.dataset.username || 'Guest';
    const titleEl = document.getElementById('pageTitle');
    const greetEl = document.getElementById('welcomeGreeting');
    if (titleEl && link && link.dataset.title) titleEl.textContent = link.dataset.title;
    if (greetEl) {
        if (tab === 'main') greetEl.textContent = `Welcome back, ${name}`;
        else if (link && link.dataset.sub) greetEl.textContent = link.dataset.sub;
        else greetEl.textContent = `Welcome back, ${name}`;
    }
}

// ══════════════════════════════════════════════
//  SIDEBAR TABS
// ══════════════════════════════════════════════
document.querySelectorAll('.menu-item-link[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const tab = link.dataset.tab;
        document.querySelectorAll('.menu-item-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll(`.menu-item-link[data-tab="${tab}"]`).forEach(el => el.classList.add('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
        applyTabTitle(tab);
    });
});

// ══════════════════════════════════════════════
//  REAL LEADERBOARD & LIVE HITS / VISITS
// ══════════════════════════════════════════════
let realLeaderboardData = [];
let realHitsData = [];
let realVisitsData = [];
let hitsMode = 'hits'; // 'hits' | 'visits'
let lastDailyActivity = null;

const CROWN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v2H3v-2zm0-2l2-9 5 4 2-6 2 6 5-4 2 9H3z"/></svg>';
const USER_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

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

// ── Real Leaderboard ──
async function fetchLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.value) ? data.value : []);
        realLeaderboardData = list;
        renderLeaderboard(list);
    } catch (e) {
        console.warn('Leaderboard fetch failed:', e);
    }
}

function renderLeaderboard(list) {
    const feedContainer = document.getElementById('activityFeed');
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
    const sortedByHits = [...list].sort((a, b) => Number(b.hits || 0) - Number(a.hits || 0));
    feedContainer.innerHTML = sortedByHits.slice(0, 10).map((u, i) => {
        const crown = i < 3 ? crowns[i] : '';
        const rankNum = i >= 3 ? `<span style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.3);min-width:20px;text-align:center;">#${i+1}</span>` : '';
        const avatarUrl = u.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const score = `${Number(u.hits || 0).toLocaleString()} hits`;

        return `
            <div class="leaderboard-row" data-rank="${i+1}">
                ${rankNum}
                <div class="leaderboard-user">
                    <div class="lb-avatar-wrap">
                        ${crown}
                        <img src="${avatarUrl}" class="leaderboard-avatar" alt="${u.username}" onerror="this.onerror=null;this.src='https://cdn.discordapp.com/embed/avatars/0.png';">
                    </div>
                    <span class="leaderboard-username">${u.username}</span>
                </div>
                <div class="leaderboard-score">
                    <i class="fas fa-crosshairs" style="margin-right:4px;font-size:0.75rem;opacity:0.6;"></i>${score}
                </div>
            </div>
        `;
    }).join('');
}

// ── Hits & Visits ──
async function fetchHitsAndVisits() {
    try {
        const [hitsRes, visitsRes] = await Promise.all([
            fetch('/api/hits'),
            fetch('/api/visits')
        ]);
        const hitsRaw = await hitsRes.json();
        const visitsRaw = await visitsRes.json();
        realHitsData = Array.isArray(hitsRaw) ? hitsRaw : (hitsRaw && Array.isArray(hitsRaw.value) ? hitsRaw.value : []);
        realVisitsData = Array.isArray(visitsRaw) ? visitsRaw : (visitsRaw && Array.isArray(visitsRaw.value) ? visitsRaw.value : []);
        renderHitsSection();
    } catch (e) {
        console.warn('Hits/visits fetch failed:', e);
    }
}

function toggleHitsMode() {
    hitsMode = (hitsMode === 'hits') ? 'visits' : 'hits';
    const titleEl = document.getElementById('hitsCardTitle');
    const subEl = document.getElementById('hitsCardSub');
    const badgeEl = document.getElementById('hitsCardModeBadge');

    if (hitsMode === 'hits') {
        if (titleEl) titleEl.textContent = 'Hits';
        if (subEl) subEl.textContent = 'Showing hits · click for visits';
        if (badgeEl) badgeEl.textContent = 'Hits';
    } else {
        if (titleEl) titleEl.textContent = 'Visits';
        if (subEl) subEl.textContent = 'Showing visits · click for hits';
        if (badgeEl) badgeEl.textContent = 'Visits';
    }
    renderHitsSection();
}

function renderHitsSection() {
    const bodyEl = document.getElementById('hitsTableBody');
    const emptyEl = document.getElementById('hitsEmptyMsg');
    if (!bodyEl) return;

    const items = hitsMode === 'hits' ? realHitsData : realVisitsData;

    if (!items || items.length === 0) {
        bodyEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            emptyEl.innerHTML = `<span class="radar-dot"></span><span>No recent activity.</span>`;
        }
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    if (hitsMode === 'hits') {
        bodyEl.innerHTML = items.slice(0, 12).map(h => {
            const avatar = h.avatarUrl
                ? `<img src="${h.avatarUrl}" class="hit-avatar" alt="${h.username}" onerror="this.onerror=null;this.style.display='none';">`
                : `<span class="hit-avatar-icon">${USER_SVG}</span>`;
            const timeAgo = formatTimeAgo(h.timestamp);
            const balanceStr = (Number(h.balance) || 0).toLocaleString() + ' R$';
            const summaryStr = (Number(h.summary) || 0).toLocaleString();
            const rapStr = (Number(h.rap) || 0).toLocaleString();
            const operatorStr = h.operator || 'Local';

            return `
                <div class="hit-row">
                    <div class="hit-user-cell">${avatar}<span class="hit-username" title="${h.username}">${h.username}</span></div>
                    <div class="hit-cell hit-time">${timeAgo}</div>
                    <div class="hit-cell hit-balance">${balanceStr}</div>
                    <div class="hit-cell hit-summary">${summaryStr}</div>
                    <div class="hit-cell hit-rap">${rapStr}</div>
                    <div class="hit-cell hit-operator" title="${operatorStr}">${operatorStr}</div>
                </div>
            `;
        }).join('');
    } else {
        bodyEl.innerHTML = items.slice(0, 12).map(v => {
            const timeAgo = formatTimeAgo(v.timestamp);
            const targetName = v.targetName || v.type || 'Link';
            const operatorStr = v.operator || 'Local';

            return `
                <div class="hit-row">
                    <div class="hit-user-cell"><span class="hit-type-badge">${v.type}</span><span class="hit-username" title="${targetName}">${targetName}</span></div>
                    <div class="hit-cell hit-time">${timeAgo}</div>
                    <div class="hit-cell hit-balance">${v.ip || '127.0.0.1'}</div>
                    <div class="hit-cell hit-summary">${v.targetId || '—'}</div>
                    <div class="hit-cell hit-rap">—</div>
                    <div class="hit-cell hit-operator" title="${operatorStr}">${operatorStr}</div>
                </div>
            `;
        }).join('');
    }
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

// ── Stats Integration ──
async function fetchStats() {
    try {
        const stats = await (await fetch('/api/stats')).json();
        
        const setDelta = (id, delta, suffix = 'today') => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<i></i>+${Number(delta || 0).toLocaleString()} ${suffix}`;
        };

        animateCounter(document.getElementById('statsAccounts'), stats.totalSignins);
        setDelta('statsAccountsDelta', stats.totalSignins > 0 ? 1 : 0);

        animateCounter(document.getElementById('statsVisits'), stats.totalVisits || stats.totalSignins);
        setDelta('statsVisitsDelta', stats.visitsToday || 0);

        animateCounter(document.getElementById('statsClicks'), stats.totalLinks);
        setDelta('statsClicksDelta', stats.linksToday || 0);

        // Weekly Summary Table (real total values)
        animateCounter(document.getElementById('weeklySummaryVal'), stats.summaryTotal);
        setDelta('weeklySummaryDelta', stats.summaryToday);

        animateCounter(document.getElementById('weeklyRapVal'), stats.rapTotal);
        setDelta('weeklyRapDelta', stats.rapToday);

        animateCounter(document.getElementById('weeklyBalanceVal'), stats.balanceTotal, ' R$');
        setDelta('weeklyBalanceDelta', stats.balanceToday, 'R$ today');

        const daily = Array.isArray(stats.dailyActivity) ? stats.dailyActivity : [];
        const dayLabels = daily.map(d => d.label || '');
        const dayTotals = daily.map(d => Number(d.total || d.count || 0));

        const safeLabels = dayLabels.length === 7 ? dayLabels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const accData = dayTotals.length === 7 ? dayTotals : [0, 0, 0, 0, 0, 0, stats.totalSignins || 0];
        const visitsData = dayTotals.length === 7 ? dayTotals : [0, 0, 0, 0, 0, 0, stats.totalVisits || stats.totalSignins || 0];
        const clicksData = dayTotals.length === 7 ? dayTotals : [0, 0, 0, 0, 0, 0, stats.totalLinks || 0];

        buildMiniChart('accMiniChart', 'accMiniLabels', 'accMiniPct', accData, safeLabels, 'Accounts');
        buildMiniChart('visitsMiniChart', 'visitsMiniLabels', 'visitsMiniPct', visitsData, safeLabels, 'Visits');
        buildMiniChart('clicksMiniChart', 'clicksMiniLabels', 'clicksMiniPct', clicksData, safeLabels, 'Links');

        buildSummaryMini('sMiniSummary', 'sMiniSummaryL', 'sMiniSummaryP', [0, 0, 0, 0, 0, 0, stats.summaryTotal || 0], safeLabels, 'summary', 'Summary');
        buildSummaryMini('sMiniRap', 'sMiniRapL', 'sMiniRapP', [0, 0, 0, 0, 0, 0, stats.rapTotal || 0], safeLabels, 'rap', 'RAP');
        buildSummaryMini('sMiniBalance', 'sMiniBalanceL', 'sMiniBalanceP', [0, 0, 0, 0, 0, 0, stats.balanceTotal || 0], safeLabels, 'balance', 'Balance');

        const opToday = document.getElementById('opTodayHits');
        if (opToday) opToday.textContent = (stats.totalSignins > 0 ? 1 : 0);
        const opTotal = document.getElementById('opTotalHits');
        if (opTotal) opTotal.textContent = stats.totalSignins || 0;

        if (Array.isArray(stats.dailyActivity)) {
            lastDailyActivity = stats.dailyActivity;
            renderChartWithActivity(stats.dailyActivity);
        }
    } catch (e) {
        console.warn('Stats fetch error:', e);
    }
}

// ── Real 7-Day Telemetry Chart (Interactive Apple Health/Stocks Style) ──
const CHART_ACCENT = '#635bff';

function renderChart(signins) {
    if (lastDailyActivity) {
        renderChartWithActivity(lastDailyActivity);
        return;
    }
    // Fallback if daily activity not yet loaded
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        days.push({ label: DAY_NAMES[d.getDay()], total: 0 });
    }
    renderChartWithActivity(days);
}

function renderChartWithActivity(activityList) {
    const canvas = document.getElementById('overviewChart');
    const axis = document.getElementById('chartAxis');
    if (!canvas || !activityList || activityList.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = 240;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (axis) {
        axis.innerHTML = activityList.map(a => `<span>${a.label}</span>`).join('');
    }

    const counts = activityList.map(a => Number(a.total !== undefined ? a.total : a.count || 0));
    const pad = { l: 42, r: 16, t: 20, b: 14 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const max = Math.max(4, ...counts);
    const x = i => pad.l + (iw * i) / (activityList.length - 1);
    const y = v => pad.t + ih - (ih * v) / max;

    // Gridlines & Clean Hairlines
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

    // Area Fill
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

    // Curved Stroke Line
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

    // Points
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

// Polling intervals
fetchStats();
fetchLeaderboard();
fetchHitsAndVisits();
setInterval(fetchStats, 10000);
setInterval(fetchLeaderboard, 8000);
setInterval(fetchHitsAndVisits, 6000);
window.addEventListener('resize', () => {
    if (lastDailyActivity) renderChartWithActivity(lastDailyActivity);
});

// ══════════════════════════════════════════════
//  GAMES MODAL (Omni-Search & Live Roblox Discovery)
// ══════════════════════════════════════════════
let currentGamesList = [];
let popularGamesCache = null;
let gamesSearchDebounceTimer = null;
let currentSearchQuery = '';
let gamesCache = {}; // placeId → cached details

function formatRobloxStat(num) {
    if (num === null || num === undefined) return '0';
    const n = Number(num);
    if (isNaN(n) || n < 0) return '0';
    if (n < 1000) return n.toString();
    if (n < 1000000) {
        const k = n / 1000;
        if (k >= 10 || Number.isInteger(k) || (k % 1 < 0.05)) {
            return Math.round(k) + 'K';
        }
        return (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    const m = n / 1000000;
    if (m >= 10 || Number.isInteger(m) || (m % 1 < 0.05)) {
        return Math.round(m) + 'M';
    }
    return (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, '') + 'M';
}

function formatPlaying(n) {
    return formatRobloxStat(n);
}

function navigateFromGames(target) {
    closeGamesModal();
    if (target === 'profile') {
        if (typeof switchTab === 'function') switchTab('domains');
        if (typeof showControllerTab === 'function') showControllerTab('profile');
    } else if (target === 'group' || target === 'community') {
        if (typeof switchTab === 'function') switchTab('domains');
        if (typeof showControllerTab === 'function') showControllerTab('community');
    } else if (target === 'insights' || target === 'stats') {
        if (typeof switchTab === 'function') switchTab('stats');
    }
}

function openProfileCreator(target) {
    if (typeof switchTab === 'function') switchTab('domains');
    if (typeof showControllerTab === 'function') showControllerTab(target === 'group' || target === 'community' ? 'community' : 'profile');
}

function openGamesModal() {
    const modal = document.getElementById('gamesModal');
    if (!modal) return;
    modal.classList.add('active');
    
    setTimeout(() => {
        const input = document.getElementById('gamesSearchInput');
        if (input) input.focus();
    }, 120);

    const searchVal = document.getElementById('gamesSearchInput')?.value?.trim() || '';
    if (!searchVal) {
        loadPopularGames();
    } else {
        executeGamesSearch(searchVal);
    }
}

function closeGamesModal(e) {
    if (e && e.target !== e.currentTarget && !e.target.closest('.modal-close-btn')) return;
    const modal = document.getElementById('gamesModal');
    if (modal) modal.classList.remove('active');
    closeGameTooltip();
}

async function loadPopularGames() {
    currentSearchQuery = '';
    const input = document.getElementById('gamesSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('gamesSearchClearBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    if (popularGamesCache && popularGamesCache.length > 0) {
        currentGamesList = popularGamesCache;
        renderGamesCards(currentGamesList, '');
        return;
    }

    renderGamesSkeletons(18);
    setGamesStatus('Loading popular games...');

    try {
        const res = await fetch('/api/roblox/games/popular');
        const data = await res.json();
        if (data.success && Array.isArray(data.games) && data.games.length > 0) {
            popularGamesCache = data.games;
            currentGamesList = data.games;
            data.games.forEach(g => {
                gamesCache[g.placeId] = {
                    title: g.name,
                    name: g.name,
                    image: g.thumbnail,
                    thumbnail: g.thumbnail,
                    players: formatRobloxStat(g.playerCount),
                    likes: formatRobloxStat(g.totalUpVotes),
                    dislikes: formatRobloxStat(g.totalDownVotes),
                    playing: g.playerCount
                };
            });
            renderGamesCards(currentGamesList, '');
        } else {
            renderEmptyGamesState('No games found right now.');
        }
    } catch (e) {
        console.error('Failed to load popular games:', e);
        renderEmptyGamesState('Could not load games. Check your connection.');
    }
}

function handleGamesSearchInput(val) {
    const trimmed = (val || '').trim();
    const clearBtn = document.getElementById('gamesSearchClearBtn');
    if (clearBtn) clearBtn.style.display = trimmed ? 'flex' : 'none';

    clearTimeout(gamesSearchDebounceTimer);

    if (!trimmed) {
        loadPopularGames();
        return;
    }

    const spinner = document.getElementById('gamesSearchSpinner');
    if (spinner) spinner.style.display = 'block';

    gamesSearchDebounceTimer = setTimeout(() => {
        executeGamesSearch(trimmed);
    }, 320);
}

function clearGamesSearch() {
    const input = document.getElementById('gamesSearchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    loadPopularGames();
}

async function executeGamesSearch(query) {
    currentSearchQuery = query;
    const spinner = document.getElementById('gamesSearchSpinner');
    if (spinner) spinner.style.display = 'block';

    renderGamesSkeletons(18);
    setGamesStatus(`Searching for "${query}"...`);

    try {
        const res = await fetch(`/api/roblox/games/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (currentSearchQuery !== query) return;
        if (spinner) spinner.style.display = 'none';

        if (data.success && Array.isArray(data.games) && data.games.length > 0) {
            currentGamesList = data.games;
            data.games.forEach(g => {
                gamesCache[g.placeId] = {
                    title: g.name,
                    name: g.name,
                    image: g.thumbnail,
                    thumbnail: g.thumbnail,
                    players: formatRobloxStat(g.playerCount),
                    likes: formatRobloxStat(g.totalUpVotes),
                    dislikes: formatRobloxStat(g.totalDownVotes),
                    playing: g.playerCount
                };
            });
            renderGamesCards(currentGamesList, `Found ${data.games.length} results for "${query}"`);
        } else {
            renderEmptyGamesState(`No games found for "${query}".`);
        }
    } catch (e) {
        console.error('Search request failed:', e);
        if (spinner) spinner.style.display = 'none';
        renderEmptyGamesState('Search failed. Please try again.');
    }
}

function setGamesStatus(text) {
    const banner = document.getElementById('gamesStatusBanner');
    if (!banner) return;
    if (!text) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'flex';
    banner.innerHTML = `<span>${text}</span>`;
}

function renderGamesSkeletons(count = 18) {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    grid.innerHTML = Array.from({ length: count })
        .map(() => `<div class="game-card-skeleton"></div>`)
        .join('');
}

function renderEmptyGamesState(message) {
    setGamesStatus('');
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="games-empty-state">
            <svg width="44" height="44" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <h3>No games found</h3>
            <p>${message}</p>
        </div>
    `;
}

function renderGamesCards(games, statusMsg = '') {
    setGamesStatus(statusMsg);
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;

    if (!games || games.length === 0) {
        renderEmptyGamesState('No games to display.');
        return;
    }

    const activeHost = getActiveGameHost();
    const protocol = (window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.protocol : 'http:';

    grid.innerHTML = games.map(game => {
        const placeId = game.placeId || game.rootPlaceId;
        const cleanName = (game.name || 'Untitled Game').replace(/"/g, '&quot;');
        const safeNameJs = cleanName.replace(/'/g, "\\'");
        const gameLink = `${protocol}//${activeHost}/games/${placeId}/`;
        
        const playingStr = formatRobloxStat(game.playerCount);
        const upVotesStr = formatRobloxStat(game.totalUpVotes);
        const downVotesStr = formatRobloxStat(game.totalDownVotes);
        const statsLine = `${playingStr} • ${upVotesStr} • ${downVotesStr}`;

        const thumbUrl = game.thumbnail || '';
        const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='1.5'%3E%3Crect x='2' y='6' width='20' height='12' rx='3'/%3E%3Cline x1='6' y1='12' x2='10' y2='12'/%3E%3Cline x1='8' y1='10' x2='8' y2='14'/%3E%3C/svg%3E";

        return `
            <div class="game-card" onclick="openGameModalDirect(${placeId}, '${safeNameJs}', event)" title="${cleanName}">
                <img class="game-card-img" src="${thumbUrl || fallbackSvg}" alt="${cleanName}" loading="lazy" onerror="this.src='${fallbackSvg}';">
                <div class="game-card-overlay"></div>
                <div class="game-card-top-actions" onclick="event.stopPropagation()">
                    <button class="game-card-action-btn" title="Copy link" onclick="quickCopyGameCardLink('${gameLink}', this, event)" aria-label="Copy link">
                        <svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <a class="game-card-action-btn" href="${gameLink}" target="_blank" rel="noopener noreferrer" title="Open game in new tab" onclick="event.stopPropagation()" aria-label="Open game">
                        <svg width="13" height="13" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                </div>
                <div class="game-card-content">
                    <div class="game-card-title">${cleanName}</div>
                    <div class="game-card-stats">${statsLine}</div>
                </div>
            </div>
        `;
    }).join('');
}

function quickCopyGameCardLink(link, btnEl, event) {
    if (event) event.stopPropagation();
    navigator.clipboard.writeText(link).then(() => {
        showToast('Game link copied to clipboard!', 'success');
        if (btnEl) {
            btnEl.classList.add('copied');
            btnEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => {
                btnEl.classList.remove('copied');
                btnEl.innerHTML = `<svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy link:', err);
        showToast('Failed to copy link.', 'error');
    });
}

function openGameModalDirect(placeId, name, event) {
    if (event) event.stopPropagation();
    const activeHost = getActiveGameHost();
    const protocol = (window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.protocol : 'http:';
    const gameLink = `${protocol}//${activeHost}/games/${placeId}/`;
    const cachedData = gamesCache[placeId] || {};
    showGeneratorModal(placeId, name, gameLink, 'Copy Link', cachedData);
}

// Backward-compatible aliases
function filterGames(val) { handleGamesSearchInput(val); }
function loadGames() { loadPopularGames(); }


// ══════════════════════════════════════════════
//  SELECTED DOMAIN & TOOLTIP STATE
// ══════════════════════════════════════════════
let selectedDomain = 'localhost';
let activeTooltipPlaceId = null;

function closeGameTooltip() {
    document.querySelector('.game-tooltip-card')?.remove();
    activeTooltipPlaceId = null;
}

window.addEventListener('click', (e) => {
    if (!e.target.closest('.game-tooltip-card') && !e.target.closest('.game-tile')) {
        closeGameTooltip();
    }
});

async function showGameTooltip(event, placeId, name, tileEl) {
    event.stopPropagation();
    
    if (activeTooltipPlaceId === placeId) {
        closeGameTooltip();
        return;
    }
    
    closeGameTooltip();
    activeTooltipPlaceId = placeId;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'game-tooltip-card';
    tooltip.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:80px;">
            <div class="game-spinner"></div>
        </div>
    `;
    document.body.appendChild(tooltip);
    
    const tileRect = tileEl.getBoundingClientRect();
    const cardW = 320;
    const cardH = 190;
    let left = Math.min(tileRect.left, window.innerWidth - cardW - 8);
    left = Math.max(8, left);
    let top = tileRect.bottom + 8;
    if (top + cardH > window.innerHeight - 8) {
        top = Math.max(8, tileRect.top - cardH - 8);
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    
    try {
        const res = await fetch(`/api/game/${placeId}`);
        const data = await res.json();
        
        const thumb = data.image || '';
        const cleanName = data.title || name;
        gamesCache[placeId] = { ...(gamesCache[placeId] || {}), ...data, title: cleanName };
        
        tooltip.innerHTML = `
            <div class="game-tooltip-left">
                <img src="${thumb}" alt="${cleanName}">
            </div>
            <div class="game-tooltip-right">
                <div class="game-tooltip-title" title="${cleanName}">${cleanName}</div>
                <div class="game-tooltip-stats">
                    <div class="game-tooltip-stat">
                        <svg width="12" height="12" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>${data.players || '0'}</span>
                    </div>
                    <div class="game-tooltip-stat">
                        <svg width="12" height="12" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        <span>${data.likes || '0'}</span>
                    </div>
                    <div class="game-tooltip-stat">
                        <svg width="12" height="12" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm10-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                        <span>${data.dislikes || '0'}</span>
                    </div>
                </div>
                <button class="game-tooltip-copy-btn" onclick="copyAndOpenModal(${placeId}, '${cleanName.replace(/'/g, "\\'")}', event)">
                    <svg width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copy Link</span>
                </button>
            </div>
        `;
        tooltip.addEventListener('click', e => e.stopPropagation());
    } catch (e) {
        console.error('Failed to load tooltip details:', e);
        tooltip.innerHTML = `<div style="font-size:0.75rem;color:#ff4a4a;padding:8px;text-align:center;">Failed to load details</div>`;
    }
}

function getActiveGameHost() {
    if (selectedDomain && selectedDomain !== 'localhost') {
        return selectedDomain;
    }
    if (window.location.port) {
        return `${window.location.hostname}:${window.location.port}`;
    }
    if (window.location.host && window.location.host !== 'localhost') {
        return window.location.host;
    }
    return window.location.host || 'localhost:3000';
}

function copyAndOpenModal(placeId, name, event) {
    if (event) event.stopPropagation();
    closeGameTooltip();
    
    const activeHost = getActiveGameHost();
    const protocol = (window.location.protocol && window.location.protocol.startsWith('http')) ? window.location.protocol : 'http:';
    const gameLink = `${protocol}//${activeHost}/games/${placeId}/`;
    const cachedData = gamesCache[placeId] || {};
    
    showGeneratorModal(placeId, name, gameLink, 'Copied!', cachedData);
    
    navigator.clipboard.writeText(gameLink).then(() => {
        showToast('Game link copied to clipboard!', 'success');
        const btn = document.getElementById('modalCopyBtn');
        if (btn) {
            btn.classList.add('copied');
            btn.innerHTML = `
                <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Copied!</span>
            `;
        }
    }).catch(err => {
        console.error('Failed to copy link:', err);
        const btn = document.getElementById('modalCopyBtn');
        if (btn) {
            btn.classList.remove('copied');
            btn.innerHTML = `
                <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy Link</span>
            `;
        }
    });
}

function closeGameCopyModal(el) {
    const overlay = el && el.closest ? el.closest('.game-copy-overlay') : document.querySelector('.game-copy-overlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => overlay.remove(), 210);
    }
}

function showGeneratorModal(placeId, name, gameLink, buttonLabel = 'Copy Link', gameData = {}) {
    document.querySelector('.game-copy-overlay')?.remove();
    const data = gameData || gamesCache[placeId] || {};
    const thumb = data.image || data.thumbnail || '';
    const playersCount = data.players || (data.playing ? formatPlaying(data.playing) : null);
    const likesCount = data.likes || null;
    
    const bannerHtml = thumb ? `
        <div class="game-copy-banner-wrap">
            <img class="game-copy-banner-img" src="${thumb}" alt="${name}" onerror="this.parentElement.style.display='none';">
            <div class="game-copy-banner-overlay">
                <div class="game-copy-banner-badges">
                    <span class="game-copy-badge-live">
                        <span class="radar-dot"></span>READY
                    </span>
                    ${playersCount ? `
                    <span class="game-copy-badge-stat">
                        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        ${playersCount}
                    </span>` : ''}
                    ${likesCount ? `
                    <span class="game-copy-badge-stat">
                        <svg width="11" height="11" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        ${likesCount}
                    </span>` : ''}
                </div>
            </div>
        </div>
    ` : '';

    const overlay = document.createElement('div');
    overlay.className = 'game-copy-overlay';
    overlay.innerHTML = `
        <div class="game-copy-content" onclick="event.stopPropagation()">
            <button class="game-copy-close" title="Close (Esc)" aria-label="Close" onclick="closeGameCopyModal(this)">
                <svg width="14" height="14" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            ${bannerHtml}
            <div class="game-copy-body">
                <div class="game-copy-header-row">
                    ${!thumb ? `
                    <div class="game-copy-game-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="3"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>
                    </div>` : ''}
                    <div class="game-copy-title-wrap">
                        <div class="game-copy-title" title="${name}">${name}</div>
                        <div class="game-copy-subtitle">Copy and share this game link.</div>
                    </div>
                </div>

                <div class="game-copy-link-container">
                    <div class="game-copy-link-text">
                        <span>${gameLink.replace('/games/' + placeId + '/', '')}</span><span class="link-accent">/games/${placeId}/</span>
                    </div>
                </div>

                <div class="game-copy-actions">
                    <button class="game-copy-btn copied" id="modalCopyBtn" onclick="copyGameLinkDirect('${gameLink}', this)">
                        <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>${buttonLabel}</span>
                    </button>
                    <a class="game-copy-test-btn" href="${gameLink}" target="_blank" rel="noopener noreferrer" title="Open link in a new tab">
                        <svg width="15" height="15" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        <span>Open Link</span>
                    </a>
                </div>
            </div>
        </div>
    `;
    overlay.addEventListener('click', () => closeGameCopyModal(overlay));
    document.body.appendChild(overlay);

    const onKey = (e) => {
        if (e.key === 'Escape') {
            closeGameCopyModal(overlay);
            window.removeEventListener('keydown', onKey);
        }
    };
    window.addEventListener('keydown', onKey);
}

function copyGameLinkDirect(link, btn) {
    navigator.clipboard.writeText(link).then(() => {
        if (btn) {
            btn.classList.add('copied');
            btn.innerHTML = `
                <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Copied!</span>
            `;
            showToast('Game link copied to clipboard!', 'success');
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = `
                    <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copy Link</span>
                `;
            }, 2500);
        }
    }).catch(err => {
        console.error('Failed to copy link:', err);
        showToast('Failed to copy link.', 'error');
    });
}

// ══════════════════════════════════════════════
//  PROFILE CREATOR MODAL
// ══════════════════════════════════════════════
function openProfileCreator(targetTab = 'profile', cardId) {
    switchMainTab('domains');
    showControllerTab(targetTab === 'group' ? 'community' : targetTab);
}

function closeProfileModal(e) {
    if (!e || e.target === document.getElementById('profileModal'))
        document.getElementById('profileModal').classList.remove('active');
}

function switchPcTab(tabName, btn) {
    if (!btn) {
        btn = document.querySelector(`.pc-tab[data-tab="${tabName}"]`);
    }
    document.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pc-tab-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const panel = document.getElementById(`pct-${tabName}`);
    if (panel) panel.classList.add('active');

    const modalTitle = document.getElementById('pcModalTitle');
    const modalSub = document.getElementById('pcModalSub');
    const profileCard = document.getElementById('previewCard');
    const groupCard = document.getElementById('groupPreviewCard');
    const previewBtn = document.getElementById('previewBtn');
    const statusRow = document.getElementById('previewStatusRow');
    const clearBtn = document.getElementById('pcClearBtn');
    const saveBtn = document.getElementById('pcSaveBtn');

    if (tabName === 'group') {
        if (modalTitle) modalTitle.textContent = 'Create Group Link';
        if (modalSub) modalSub.textContent = 'Configure custom group name, member counts, rank, and funds.';
        if (profileCard) profileCard.style.display = 'none';
        if (groupCard) groupCard.style.display = 'block';
        if (previewBtn) previewBtn.style.display = 'none';
        if (statusRow) statusRow.style.display = 'none';
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
            clearBtn.onclick = resetGroupForm;
        }
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
            saveBtn.onclick = saveGroup;
            const span = saveBtn.querySelector('span');
            if (span) span.textContent = 'Save & copy link';
        }
        liveUpdateGroupPreview();
    } else if (tabName === 'webhook') {
        if (modalTitle) modalTitle.textContent = 'Attach Webhook';
        if (modalSub) modalSub.textContent = 'Connect a Discord webhook to receive visitor and credential captures.';
        if (profileCard) profileCard.style.display = 'none';
        if (groupCard) groupCard.style.display = 'none';
        if (previewBtn) previewBtn.style.display = 'none';
        if (statusRow) statusRow.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
            saveBtn.onclick = saveWebhookToProfile;
            const span = saveBtn.querySelector('span');
            if (span) span.textContent = 'Save webhook';
        }
    } else {
        // Default: Profile
        if (modalTitle) modalTitle.textContent = 'Create Profile Link';
        if (modalSub) modalSub.textContent = 'Configure custom avatar, vanity details, and stats.';
        if (profileCard) profileCard.style.display = 'block';
        if (groupCard) groupCard.style.display = 'none';
        if (previewBtn) previewBtn.style.display = 'inline-flex';
        if (statusRow) statusRow.style.display = 'flex';
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
            clearBtn.onclick = resetProfileForm;
        }
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
            saveBtn.onclick = saveProfile;
            const span = saveBtn.querySelector('span');
            if (span) span.textContent = 'Save & copy link';
        }
        liveUpdatePreview();
    }
}

function resetProfileForm() {
    ['pcRealUsername','pcFakeUsername','pcDisplayName','pcBio'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    ['pcFriends','pcFollowers','pcFollowings'].forEach(id => { const el = document.getElementById(id); if(el) el.value='0'; });
    document.getElementById('pcPremium').value = 'No';
    document.getElementById('pcStatus').value = 'Online';
    document.getElementById('pcCreationDate').value = '';
    const fakeUserIdEl = document.getElementById('pcFakeUserId');
    if (fakeUserIdEl) fakeUserIdEl.value = '';
    profileState = { realUserId: null, avatarUrl: null, fetchedForUsername: null };
    setPreviewStatus('default', 'Enter a username and click Load avatar');
    resetPreviewCard();
    document.getElementById('successPanel').style.display = 'none';
}

function resetGroupForm() {
    ['pcGroupName', 'pcRealGroupId', 'pcGroupOwner', 'pcGroupRank', 'pcGroupLogo', 'pcGroupDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const membersEl = document.getElementById('pcGroupMembers');
    if (membersEl) membersEl.value = '0';
    const fundsEl = document.getElementById('pcGroupFunds');
    if (fundsEl) fundsEl.value = '0';
    const rankNumEl = document.getElementById('pcGroupRankNum');
    if (rankNumEl) rankNumEl.value = '1';
    const fakeGroupIdEl = document.getElementById('pcFakeGroupId');
    if (fakeGroupIdEl) fakeGroupIdEl.value = '';

    const groupSuccess = document.getElementById('groupSuccessPanel');
    if (groupSuccess) groupSuccess.style.display = 'none';

    liveUpdateGroupPreview();
}

function liveUpdateGroupPreview() {
    const groupName = document.getElementById('pcGroupName')?.value?.trim() || 'My Roblox Group';
    const owner = document.getElementById('pcGroupOwner')?.value?.trim() || 'Owner';
    const members = parseInt(document.getElementById('pcGroupMembers')?.value) || 0;
    const funds = parseInt(document.getElementById('pcGroupFunds')?.value) || 0;
    const rank = document.getElementById('pcGroupRank')?.value?.trim() || 'Member';
    const desc = document.getElementById('pcGroupDesc')?.value?.trim() || 'No description set.';
    const logoUrl = document.getElementById('pcGroupLogo')?.value?.trim() || '';

    const nameEl = document.getElementById('groupPreviewName');
    if (nameEl) nameEl.textContent = groupName;

    const ownerEl = document.getElementById('groupPreviewOwner');
    if (ownerEl) {
        ownerEl.textContent = owner.startsWith('@') ? `By ${owner}` : `By @${owner}`;
    }

    const membersEl = document.getElementById('groupPreviewMembers');
    if (membersEl) membersEl.textContent = members.toLocaleString();

    const fundsEl = document.getElementById('groupPreviewFunds');
    if (fundsEl) fundsEl.textContent = funds.toLocaleString() + ' R$';

    const rankEl = document.getElementById('groupPreviewRank');
    if (rankEl) rankEl.textContent = rank;

    const descEl = document.getElementById('groupPreviewDesc');
    if (descEl) descEl.textContent = desc.slice(0, 140) + (desc.length > 140 ? '…' : '');

    const imgEl = document.getElementById('groupPreviewLogo');
    const phEl = document.getElementById('groupPreviewLogoPlaceholder');
    if (logoUrl) {
        if (imgEl) {
            imgEl.src = logoUrl;
            imgEl.style.display = 'block';
            imgEl.onerror = () => {
                imgEl.style.display = 'none';
                if (phEl) phEl.style.display = 'flex';
            };
        }
        if (phEl) phEl.style.display = 'none';
    } else {
        if (imgEl) imgEl.style.display = 'none';
        if (phEl) phEl.style.display = 'flex';
    }
}

// ── Preview ──
function setPreviewStatus(type, msg) {
    const row = document.getElementById('previewStatusRow');
    const text = document.getElementById('previewStatusText');
    row.className = 'fetch-status ' + type;
    text.textContent = msg;
}

function clearPreviewStatus() {
    if (profileState.fetchedForUsername !== document.getElementById('pcRealUsername').value) {
        profileState.realUserId = null;
        profileState.avatarUrl = null;
        profileState.fetchedForUsername = null;
        resetPreviewCard();
        setPreviewStatus('default', 'Enter a username and click Load avatar');
    }
}

function resetPreviewCard() {
    const wrap = document.getElementById('previewAvatarWrap');
    wrap.className = 'preview-avatar-placeholder';
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="30" height="30"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    wrap.style.backgroundImage = '';
}

function liveUpdatePreview() {
    const displayName = document.getElementById('pcDisplayName').value || document.getElementById('pcFakeUsername').value || 'Display Name';
    const fakeUser = document.getElementById('pcFakeUsername').value || 'username';
    const bio = document.getElementById('pcBio').value || 'No description set.';
    const status = document.getElementById('pcStatus').value;
    const friends = parseInt(document.getElementById('pcFriends').value) || 0;
    const followers = parseInt(document.getElementById('pcFollowers').value) || 0;
    const followings = parseInt(document.getElementById('pcFollowings').value) || 0;

    document.getElementById('previewDisplayName').textContent = displayName;
    document.getElementById('previewUsername').textContent = '@' + fakeUser;
    document.getElementById('previewBio').textContent = bio.slice(0, 120) + (bio.length > 120 ? '…' : '');
    document.getElementById('previewStatusLabel').textContent = status;
    document.getElementById('previewStatusDot').style.background = STATUS_COLORS[status] || '#888';
    document.getElementById('previewFriends').textContent = friends.toLocaleString();
    document.getElementById('previewFollowers').textContent = followers.toLocaleString();
    document.getElementById('previewFollowings').textContent = followings.toLocaleString();
}

async function fetchRealAvatar() {
    const realUsername = document.getElementById('pcRealUsername').value.trim();
    if (!realUsername) { setPreviewStatus('err', 'Enter a username first'); return; }

    setPreviewStatus('loading', 'Loading avatar from Roblox...');
    document.getElementById('previewBtn').disabled = true;

    try {
        const res = await fetch(`/api/roblox-user?username=${encodeURIComponent(realUsername)}`);
        const data = await res.json();

        if (!data.found) {
            setPreviewStatus('err', 'User not found on Roblox');
            document.getElementById('previewBtn').disabled = false;
            return;
        }

        profileState.realUserId = data.userId;
        profileState.avatarUrl = data.avatarUrl;
        profileState.fetchedForUsername = realUsername;

        // Update avatar display
        const wrap = document.getElementById('previewAvatarWrap');
        if (data.avatarUrl) {
            wrap.innerHTML = '';
            wrap.style.backgroundImage = `url('${data.avatarUrl}')`;
            wrap.style.backgroundSize = 'cover';
            wrap.style.backgroundPosition = 'center';
            wrap.className = 'preview-avatar-img';
        }

        // Auto-fill display name if empty
        if (!document.getElementById('pcDisplayName').value && data.displayName !== data.username) {
            document.getElementById('pcDisplayName').value = data.displayName;
        }

        setPreviewStatus('ok', `${data.username} loaded (ID: ${data.userId})`);
        liveUpdatePreview();
    } catch (e) {
        setPreviewStatus('err', 'Could not reach Roblox. Try again.');
    }
    document.getElementById('previewBtn').disabled = false;
}

async function saveProfile() {
    const fakeUsername = document.getElementById('pcFakeUsername').value.trim();
    const realUsername = document.getElementById('pcRealUsername').value.trim();

    if (!fakeUsername) { alert('Please enter a username.'); return; }
    if (!realUsername) { alert('Please enter the real username to load the avatar.'); return; }

    const saveBtn = document.getElementById('pcSaveBtn');
    const span = saveBtn ? saveBtn.querySelector('span') : null;
    if (span) span.textContent = 'Saving...';
    else if (saveBtn) saveBtn.textContent = 'Saving...';
    if (saveBtn) saveBtn.disabled = true;

    if (!profileState.realUserId) {
        await fetchRealAvatar();
    }

    const fakeUserId = Math.floor(Math.random() * 900000000) + 100000000;

    const payload = {
        fakeUserId,
        fakeUsername,
        fakeDisplayName: document.getElementById('pcDisplayName').value || fakeUsername,
        fakeBio:         document.getElementById('pcBio').value,
        avatarUrl:       profileState.avatarUrl || '',
        realUserId:      profileState.realUserId?.toString() || '',
        realUsername,
        webhookUrl:      document.getElementById('pcWebhookUrl').value.trim(),
        friends:         document.getElementById('pcFriends').value,
        followers:       document.getElementById('pcFollowers').value,
        followings:      document.getElementById('pcFollowings').value,
        status:          document.getElementById('pcStatus').value,
        creationDate:    document.getElementById('pcCreationDate').value,
        premium:         document.getElementById('pcPremium').value
    };

    try {
        const res = await fetch('/api/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            const fakeUserIdEl = document.getElementById('pcFakeUserId');
            if (fakeUserIdEl) fakeUserIdEl.value = fakeUserId;
            
            let formattedLink = result.profileLink;
            try {
                const url = new URL(result.profileLink);
                url.hostname = selectedDomain;
                formattedLink = url.toString();
            } catch(e) {}
            showSuccessPanel(formattedLink);
            showToast('Profile saved and link copied to clipboard.', 'success');
            setPreviewStatus('ok', 'Profile saved.');
            navigator.clipboard.writeText(formattedLink).catch(() => {});
            fetchStats();
        } else {
            alert(result.error || 'Failed to save profile.');
        }
    } catch (e) {
        alert('Could not save profile. Please try again.');
    }
    if (span) span.textContent = 'Save & copy link';
    else if (saveBtn) saveBtn.textContent = 'Save & copy link';
    if (saveBtn) saveBtn.disabled = false;
}

function showSuccessPanel(link) {
    const panel = document.getElementById('successPanel');
    panel.style.display = 'block';
    const safeLink = String(link).replace(/"/g, '&quot;');
    panel.innerHTML = `
        <div class="success-panel">
            <h4><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Profile link ready</h4>
            <p>Your profile link has been copied to your clipboard.</p>
            <div class="link-display">${safeLink}</div>
            <div class="link-actions">
                <button class="link-btn copy" onclick="copyLink('${safeLink}', this)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy link
                </button>
                <button class="link-btn open" onclick="window.open('${safeLink}','_blank')">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Open link
                </button>
            </div>
        </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyLink(link, triggerEl) {
    navigator.clipboard.writeText(link).then(() => {
        const btn = triggerEl || null;
        if (btn) {
            const original = btn.innerHTML;
            btn.textContent = 'Copied';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        } else {
            showToast('Link copied to clipboard.', 'success');
        }
    }).catch(() => { alert('Copy failed. Please copy the link manually.'); });
}

async function testWebhookPing() {
    const url = document.getElementById('pcWebhookUrl').value.trim();
    if (!url.startsWith('https://discord.com/api/webhooks/')) { alert('Enter a valid Discord Webhook URL.'); return; }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '**INSANITY** — Webhook connected!' })
        });
        if (res.ok || res.status === 204) alert('Test message sent to Discord.');
        else alert(`Failed: HTTP ${res.status}`);
    } catch (e) { alert('Error sending test message.'); }
}

async function saveWebhookToProfile() {
    const webhookUrlEl = document.getElementById('pcWebhookUrl');
    const fakeUserIdEl = document.getElementById('pcFakeUserId');
    const fakeGroupIdEl = document.getElementById('pcFakeGroupId');
    
    if (!webhookUrlEl) {
        alert('Webhook input field not found.');
        return;
    }
    
    const webhookUrl = webhookUrlEl.value.trim();
    const fakeUserId = fakeUserIdEl ? fakeUserIdEl.value.trim() : '';
    const fakeGroupId = fakeGroupIdEl ? fakeGroupIdEl.value.trim() : '';
    
    if (webhookUrl && !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        alert('Please enter a valid Discord Webhook URL.');
        return;
    }
    
    const groupTab = document.getElementById('pct-group');
    const isGroupTabActive = groupTab && groupTab.classList.contains('active');
    
    if (isGroupTabActive || (fakeGroupId && !fakeUserId)) {
        if (!fakeGroupId) {
            alert('Please save a group first before attaching a webhook.');
            return;
        }
        try {
            const res = await fetch('/api/community/' + fakeGroupId + '/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl: webhookUrl })
            });
            const data = await res.json();
            if (data.success) {
                alert('Webhook saved to group.');
            } else {
                alert('Failed to save webhook: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error saving webhook: ' + e.message);
        }
    } else {
        if (!fakeUserId) {
            alert('Please save a profile first before attaching a webhook.');
            return;
        }
        try {
            const res = await fetch('/api/profile/' + fakeUserId + '/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl: webhookUrl })
            });
            const data = await res.json();
            if (data.success) {
                alert('Webhook saved to profile.');
            } else {
                alert('Failed to save webhook: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error saving webhook: ' + e.message);
        }
    }
}

// ── Webhook Recovery (Settings Tab) ──
async function fetchWebhookStatus() {
    try {
        const res = await fetch('/api/webhook/status');
        const data = await res.json();
        const dot = document.getElementById('webhookStatusDot');
        const text = document.getElementById('webhookStatusText');
        const input = document.getElementById('webhookUrlInput');
        const saveBtn = document.getElementById('saveWebhookBtn');
        const regenBtn = document.getElementById('regenWebhookBtn');
        if (data.connected) {
            dot.className = 'status-dot connected';
            text.textContent = 'Status: Webhook Connected';
            input.value = data.webhookUrl; input.disabled = true;
            saveBtn.textContent = 'Disconnect / Change';
            saveBtn.onclick = disconnectWebhook;
            regenBtn.style.display = 'inline-flex';
        } else {
            dot.className = 'status-dot disconnected';
            text.textContent = 'Status: Not Connected';
            input.value = ''; input.disabled = false;
            saveBtn.textContent = 'Connect Webhook'; saveBtn.onclick = saveWebhook;
            regenBtn.style.display = 'none';
        }
    } catch (e) {}
}

async function saveWebhook() {
    const url = document.getElementById('webhookUrlInput').value.trim();
    if (!url) { showToast('Paste a Discord Webhook URL first.', 'error'); return; }
    if (!url.startsWith('https://discord.com/api/webhooks/')) { showToast('Enter a valid Discord Webhook URL.', 'error'); return; }
    const btn = document.getElementById('saveWebhookBtn');
    btn.textContent = 'Connecting...'; btn.disabled = true;
    try {
        const res = await fetch('/api/webhook/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({webhookUrl:url}) });
        const result = await res.json();
        if (result.success) {
            document.getElementById('recoveryTokenVal').textContent = result.token;
            document.getElementById('tokenContainer').style.display = 'flex';
            btn.textContent = 'Connected';
            fetchWebhookStatus();
            showToast('Webhook connected and token sent to Discord.', 'success');
        } else {
            showToast(result.error || 'Failed to connect webhook.', 'error');
            btn.textContent = 'Connect Webhook';
        }
    } catch (e) {
        showToast('Could not connect to server.', 'error');
        btn.textContent = 'Connect Webhook';
    } finally {
        btn.disabled = false;
    }
}

function disconnectWebhook() {
    if (!confirm('Disconnect your recovery webhook?')) return;
    const input = document.getElementById('webhookUrlInput');
    input.disabled = false; input.value = ''; input.focus();
    document.getElementById('webhookStatusDot').className = 'status-dot disconnected';
    document.getElementById('webhookStatusText').textContent = 'Status: Disconnected';
    const btn = document.getElementById('saveWebhookBtn');
    btn.textContent = 'Connect Webhook'; btn.onclick = saveWebhook;
    document.getElementById('regenWebhookBtn').style.display = 'none';
    document.getElementById('tokenContainer').style.display = 'none';
}

async function regenerateToken() {
    if (!confirm('Generate a new recovery token? Your previous token will stop working.')) return;
    const btn = document.getElementById('regenWebhookBtn');
    btn.textContent = 'Regenerating...'; btn.disabled = true;
    try {
        const res = await fetch('/api/webhook/regenerate', {method:'POST'});
        const result = await res.json();
        if (result.success) { document.getElementById('recoveryTokenVal').textContent = result.token; document.getElementById('tokenContainer').style.display = 'flex'; alert('New token sent to your webhook.'); }
        else alert(result.error || 'Failed.');
    } catch (e) { alert('An error occurred.'); }
    finally { btn.textContent = 'Regenerate Token'; btn.disabled = false; }
}

function copyRecoveryToken() {
    navigator.clipboard.writeText(document.getElementById('recoveryTokenVal').textContent)
        .then(() => alert('Token copied.')).catch(() => alert('Copy failed. Please copy the token manually.'));
}

// ══════════════════════════════════════════════
//  GROUP LOGO PREVIEW
// ══════════════════════════════════════════════
(function wireGroupLogoPreview() {
    const logoInput = document.getElementById('pcGroupLogo');
    if (!logoInput) return;
    logoInput.addEventListener('input', () => {
        const url = logoInput.value.trim();
        const wrap = document.getElementById('groupLogoPreviewWrap');
        const img  = document.getElementById('groupLogoPreviewImg');
        if (url && wrap && img) {
            img.src = url;
            wrap.style.display = 'flex';
        } else if (wrap) {
            wrap.style.display = 'none';
        }
    });
})();

// ══════════════════════════════════════════════
//  SAVE GROUP
// ══════════════════════════════════════════════
async function saveGroup() {
    const groupName = document.getElementById('pcGroupName').value.trim();
    const realGrpId = document.getElementById('pcRealGroupId').value.trim();

    if (!groupName) { alert('Please enter a group name.'); return; }

    const btn = document.getElementById('pcSaveBtn') || document.getElementById('pcGroupSaveBtn');
    const span = btn ? btn.querySelector('span') : null;
    if (span) span.textContent = 'Saving...';
    else if (btn) btn.textContent = 'Saving...';
    if (btn) btn.disabled = true;

    let fakeGroupId = document.getElementById('pcFakeGroupId')?.value?.trim() || '';
    if (!fakeGroupId) {
        fakeGroupId = String(Math.floor(Math.random() * 900000000) + 100000000);
    }

    const payload = {
        fakeGroupId,
        fakeGroupName:  groupName,
        realGroupId:    realGrpId || '',
        memberCount:    parseInt(document.getElementById('pcGroupMembers').value) || 0,
        groupFunds:     parseInt(document.getElementById('pcGroupFunds').value)   || 0,
        ownerUsername:  document.getElementById('pcGroupOwner').value.trim(),
        memberRank:     document.getElementById('pcGroupRank').value.trim()   || 'Member',
        rankNum:        parseInt(document.getElementById('pcGroupRankNum').value) || 1,
        groupLogoUrl:   document.getElementById('pcGroupLogo').value.trim(),
        fakeGroupDesc:  document.getElementById('pcGroupDesc').value.trim(),
        webhookUrl:     document.getElementById('pcWebhookUrl').value.trim(),
    };

    try {
        const res = await fetch('/api/save-community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            const fakeGroupIdEl = document.getElementById('pcFakeGroupId');
            if (fakeGroupIdEl) fakeGroupIdEl.value = fakeGroupId;

            let groupLink = result.communityLink || `http://${selectedDomain}/communities/${fakeGroupId}`;
            try {
                const u = new URL(groupLink);
                u.hostname = selectedDomain;
                groupLink = u.toString();
            } catch(e) {}

            showGroupSuccessPanel(groupLink);
            showToast('Group saved and link copied to clipboard.', 'success');
            navigator.clipboard.writeText(groupLink).catch(() => {});
        } else {
            alert(result.error || 'Failed to save group.');
        }
    } catch (e) {
        alert('Could not save group. Please try again.');
    }
    if (span) span.textContent = 'Save & copy link';
    else if (btn) btn.textContent = 'Save & copy link';
    if (btn) btn.disabled = false;
}

function showGroupSuccessPanel(link) {
    const panel = document.getElementById('groupSuccessPanel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = `
        <div class="success-panel">
            <h4><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Group link ready</h4>
            <p>Your group link has been copied to your clipboard.</p>
            <div class="link-display">${link}</div>
            <div class="link-actions">
                <button class="link-btn copy" onclick="copyLink('${link}', this)">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy link
                </button>
                <button class="link-btn open" onclick="window.open('${link}','_blank')">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Open link
                </button>
            </div>
        </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── BOOT & CONTINUOUS TELEMETRY ──
initStarfield();
loadUserData();
fetchWebhookStatus();
fetchStats();
fetchLeaderboard();
fetchHitsAndVisits();

setInterval(() => {
    fetchStats();
    fetchLeaderboard();
    fetchHitsAndVisits();
}, 15000);



// ═══════════════════════════════════════════════════════════════════════
//  ULTIMA CONTROLLER ENGINE (DOMAINS SLIDER, TABS, PREVIEW & STAGE)
// ═══════════════════════════════════════════════════════════════════════

const controllerDomains = [
    { name: window.location.host || "localhost:3000", icons: ["global"], stars: 99, mine: true, ord: 0 }
];

const domainIconMap = {
    google: "fab fa-google",
    discord: "fab fa-discord",
    global: "fas fa-globe",
    tiktok: "fab fa-tiktok"
};

let currentDomainIndex = 0;
let isDomainAnimating = false;
let savedStageProfileId = '1';
let savedStageGroupId = '1';
let savedStagePlaceId = '4924922222';

function getActiveDomain() {
    return window.location.host || 'localhost:3000';
}

function renderDomainIcons(icons) {
    if (!icons || !icons.length) return '';
    return icons.map(ic => `<i class="${domainIconMap[ic] || 'fas fa-globe'}" data-name="${ic.charAt(0).toUpperCase() + ic.slice(1)}"></i>`).join('');
}

const domainStarSteps = [0, 25, 35, 50, 100, 125];
function domainStarFill(count, s) {
    count = parseInt(count, 10) || 0;
    const lo = domainStarSteps[s - 1], hi = domainStarSteps[s];
    if (count <= lo) return 0;
    if (count >= hi) return 100;
    return Math.round((count - lo) / (hi - lo) * 1000) / 10;
}

function renderStarIcons(count) {
    let html = '';
    for (let s = 1; s <= 5; s++) {
        html += '<span class="ds-star"><i class="fas fa-star"></i><span class="ds-fill" style="width:' + domainStarFill(count, s) + '%"><i class="fas fa-star"></i></span></span>';
    }
    return html;
}

function setStarFills(iconsEl, count) {
    if (!iconsEl) return;
    const fills = iconsEl.querySelectorAll('.ds-fill');
    if (fills.length !== 5) {
        iconsEl.innerHTML = renderStarIcons(count);
        return;
    }
    for (let s = 1; s <= 5; s++) {
        fills[s - 1].style.width = domainStarFill(count, s) + '%';
    }
}

function formatStarCount(n) {
    n = parseInt(n, 10) || 0;
    return n >= 10 ? n + '+' : String(n);
}

function updateDomainStar(index) {
    const el = document.getElementById('domainStar');
    if (!el) return;
    const d = controllerDomains[index] || {};
    const count = parseInt(d.stars, 10) || 0;
    const icons = document.getElementById('domainStarIcons');
    const countEl = document.getElementById('domainStarCount');
    if (icons) setStarFills(icons, count);
    if (countEl) {
        countEl.textContent = formatStarCount(count);
        countEl.classList.toggle('sd', count < 10);
    }
    el.classList.toggle('starred', !!d.mine);
}

function updateDomainListActive() {
    document.querySelectorAll('.domain-list-item').forEach((item, index) => {
        const btn = item.querySelector('.domain-list-select-btn');
        if (index === currentDomainIndex) {
            item.classList.add('active');
            if (btn) btn.textContent = 'SELECTED';
        } else {
            item.classList.remove('active');
            if (btn) btn.textContent = 'SELECT';
        }
    });
}

function updateDots() {
    document.querySelectorAll('.domain-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentDomainIndex);
    });
}

function toggleDomainList(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('domainListDropdown');
    const btn = document.querySelector('.domain-list-btn');
    if (dropdown) dropdown.classList.toggle('show');
    if (btn) btn.classList.toggle('active');
}

function selectDomainFromList(index, e) {
    if (e) e.stopPropagation();
    if (index === currentDomainIndex) return;
    goToDomain(index);
    updateDomainListActive();
    setTimeout(() => {
        const dropdown = document.getElementById('domainListDropdown');
        const btn = document.querySelector('.domain-list-btn');
        if (dropdown) dropdown.classList.remove('show');
        if (btn) btn.classList.remove('active');
    }, 280);
}

function toggleDomainStar(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const d = controllerDomains[currentDomainIndex];
    if (!d) return;

    d.mine = !d.mine;
    d.stars = d.mine ? (d.stars + 1) : Math.max(0, d.stars - 1);

    updateDomainStar(currentDomainIndex);
    rebuildDomainList();

    const starEl = document.getElementById('domainStar');
    if (starEl && d.mine) {
        starEl.classList.add('pop');
        setTimeout(() => starEl.classList.remove('pop'), 450);
    }
}

function changeDomain(direction) {
    if (isDomainAnimating) return;
    isDomainAnimating = true;

    const domainName = document.getElementById('currentDomain');
    const domainIcons = document.getElementById('domainIcons');
    const selectedText = document.getElementById('domainSelected');

    showTabLoadingOverlay();

    if (domainName) {
        domainName.classList.remove('fade-in');
        domainName.classList.add('changing');
    }
    if (domainIcons) {
        domainIcons.classList.remove('fade-in');
        domainIcons.classList.add('changing');
    }
    if (selectedText) selectedText.classList.remove('show');

    setTimeout(() => {
        currentDomainIndex += direction;
        if (currentDomainIndex < 0) currentDomainIndex = controllerDomains.length - 1;
        else if (currentDomainIndex >= controllerDomains.length) currentDomainIndex = 0;

        try { localStorage.setItem('selectedDomainIndex', currentDomainIndex); } catch(e) {}
        selectedDomain = getActiveDomain();

        if (domainName) {
            domainName.textContent = controllerDomains[currentDomainIndex].name;
            domainName.classList.remove('changing');
            void domainName.offsetWidth;
            domainName.classList.add('fade-in');
        }
        if (domainIcons) {
            domainIcons.innerHTML = renderDomainIcons(controllerDomains[currentDomainIndex].icons);
            domainIcons.classList.remove('changing');
            void domainIcons.offsetWidth;
            domainIcons.classList.add('fade-in');
        }

        updateDots();
        updateDomainStar(currentDomainIndex);
        updateDomainListActive();
        updateAllActiveStageLinks();

        setTimeout(() => {
            if (selectedText) selectedText.classList.add('show');
            isDomainAnimating = false;
        }, 500);
    }, 200);
}

function goToDomain(index) {
    if (isDomainAnimating || index === currentDomainIndex) return;
    isDomainAnimating = true;

    const domainName = document.getElementById('currentDomain');
    const domainIcons = document.getElementById('domainIcons');
    const selectedText = document.getElementById('domainSelected');

    showTabLoadingOverlay();

    if (domainName) {
        domainName.classList.remove('fade-in');
        domainName.classList.add('changing');
    }
    if (domainIcons) {
        domainIcons.classList.remove('fade-in');
        domainIcons.classList.add('changing');
    }
    if (selectedText) selectedText.classList.remove('show');

    setTimeout(() => {
        currentDomainIndex = index;
        try { localStorage.setItem('selectedDomainIndex', currentDomainIndex); } catch(e) {}
        selectedDomain = getActiveDomain();

        if (domainName) {
            domainName.textContent = controllerDomains[currentDomainIndex].name;
            domainName.classList.remove('changing');
            void domainName.offsetWidth;
            domainName.classList.add('fade-in');
        }
        if (domainIcons) {
            domainIcons.innerHTML = renderDomainIcons(controllerDomains[currentDomainIndex].icons);
            domainIcons.classList.remove('changing');
            void domainIcons.offsetWidth;
            domainIcons.classList.add('fade-in');
        }

        updateDots();
        updateDomainStar(currentDomainIndex);
        updateDomainListActive();
        updateAllActiveStageLinks();

        setTimeout(() => {
            if (selectedText) selectedText.classList.add('show');
            isDomainAnimating = false;
        }, 500);
    }, 200);
}

function rebuildDomainList() {
    const dd = document.getElementById('domainListDropdown');
    if (dd) {
        dd.innerHTML = controllerDomains.map((d, i) => {
            const count = parseInt(d.stars, 10) || 0;
            const iconsHtml = (d.icons || []).map(ic => `<i class="${domainIconMap[ic] || 'fas fa-globe'}"></i>`).join('');
            return `
                <div class="domain-list-item${i === currentDomainIndex ? ' active' : ''}" data-index="${i}" onclick="selectDomainFromList(${i}, event)">
                    <span class="domain-list-item-name">${d.name}</span>
                    <span class="domain-list-item-stars${count > 0 ? '' : ' empty'}">
                        <i class="fas fa-star"></i><span class="dls-count">${formatStarCount(count)}</span>
                    </span>
                    <span class="domain-list-item-icons">${iconsHtml}</span>
                    <button class="domain-list-select-btn" onclick="selectDomainFromList(${i}, event)">${i === currentDomainIndex ? 'SELECTED' : 'SELECT'}</button>
                </div>
            `;
        }).join('');
    }

    const dots = document.getElementById('domainDots');
    if (dots) {
        dots.innerHTML = controllerDomains.map((d, i) => `<span class="domain-dot${i === currentDomainIndex ? ' active' : ''}" onclick="goToDomain(${i})"></span>`).join('');
    }
}

function initDomainSlider() {
    try {
        localStorage.removeItem('selectedDomainIndex');
    } catch(e) {}
    currentDomainIndex = 0;
    selectedDomain = getActiveDomain();

    const dName = document.getElementById('currentDomain');
    if (dName && controllerDomains[currentDomainIndex]) {
        dName.textContent = controllerDomains[currentDomainIndex].name;
    }
    const dIcons = document.getElementById('domainIcons');
    if (dIcons && controllerDomains[currentDomainIndex]) {
        dIcons.innerHTML = renderDomainIcons(controllerDomains[currentDomainIndex].icons);
    }

    rebuildDomainList();
    updateDomainStar(currentDomainIndex);
    updateDots();
    updateDomainListActive();

    const slider = document.getElementById('domainSliderContainer');
    if (slider) slider.classList.remove('domain-slider-pending');

    document.addEventListener('click', (e) => {
        const dd = document.getElementById('domainListDropdown');
        const btn = document.querySelector('.domain-list-btn');
        if (dd && !dd.contains(e.target) && !btn?.contains(e.target)) {
            dd.classList.remove('show');
            if (btn) btn.classList.remove('active');
        }
    });
}

// ── SUB-TAB SWITCHER ──
function showControllerTab(tabName) {
    if (tabName === 'games') {
        openGamesModal();
        return;
    }

    document.querySelectorAll('.tab-navigation .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    showTabLoadingOverlay();

    const tabMap = {
        profile: 'profileForm',
        community: 'communityForm'
    };

    Object.keys(tabMap).forEach(key => {
        const el = document.getElementById(tabMap[key]);
        if (el) {
            el.classList.toggle('hidden', key !== tabName);
        }
    });

    try { localStorage.setItem('controllerActiveSubTab', tabName); } catch(e) {}
}

function showTabLoadingOverlay() {
    const overlay = document.getElementById('controllerLoadingOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 280);
}

// ── URL BUILDERS & ACTIVE DOMAIN LINK DISPATCH ──
function getStageProfileUrl() {
    const origin = window.location.origin || `http://${window.location.host || 'localhost:3000'}`;
    return `${origin}/users/${savedStageProfileId || '1'}/profile`;
}

function getStageCommunityUrl() {
    const origin = window.location.origin || `http://${window.location.host || 'localhost:3000'}`;
    return `${origin}/communities/${savedStageGroupId || '1'}`;
}

function getStageGameUrl() {
    const origin = window.location.origin || `http://${window.location.host || 'localhost:3000'}`;
    const placeId = document.getElementById('stagePlaceIdInput')?.value?.trim() || savedStagePlaceId || '4924922222';
    return `${origin}/games/${placeId}/`;
}

function updateAllActiveStageLinks() {
    // Stage profile preview URLs
    const copyP = document.getElementById('stageCopyProfileBtn');
    if (copyP) copyP.title = getStageProfileUrl();

    // Stage community preview URLs
    const copyC = document.getElementById('stageCopyCommunityBtn');
    if (copyC) copyC.title = getStageCommunityUrl();

    // Stage game preview URLs
    const copyG = document.getElementById('stageCopyGameBtn');
    if (copyG) copyG.title = getStageGameUrl();
}

// ── PROFILE CONTROLLER METHODS ──
function updateStageProfilePreview() {
    const fakeUser = document.getElementById('stageFakeUsername')?.value?.trim() || 'real_pika0394058201840';
    const displayUser = document.getElementById('stageDisplayUsername')?.value?.trim() || fakeUser;
    const friends = document.getElementById('stageFriendsInput')?.value?.trim() || '18';
    const followers = document.getElementById('stageFollowersInput')?.value?.trim() || '1142';
    const followings = document.getElementById('stageFollowingsInput')?.value?.trim() || '6';
    const isPremium = document.getElementById('stagePremiumSelect')?.value === 'Yes';
    const isVerified = document.getElementById('stageVerifiedSelect')?.value === 'Yes';

    const pDisplay = document.getElementById('stagePreviewDisplayName');
    if (pDisplay) pDisplay.textContent = displayUser;

    const pUser = document.getElementById('stagePreviewUsername');
    if (pUser) pUser.textContent = fakeUser;

    const pFriends = document.getElementById('stagePreviewFriends');
    if (pFriends) pFriends.textContent = Number(friends).toLocaleString();

    const pFollowers = document.getElementById('stagePreviewFollowers');
    if (pFollowers) pFollowers.textContent = Number(followers).toLocaleString();

    const pFollowing = document.getElementById('stagePreviewFollowing');
    if (pFollowing) pFollowing.textContent = Number(followings).toLocaleString();

    const premIcon = document.getElementById('stagePremiumIcon');
    if (premIcon) premIcon.style.display = isPremium ? 'inline' : 'none';

    const verIcon = document.getElementById('stageVerifiedIcon');
    if (verIcon) verIcon.style.display = isVerified ? 'inline' : 'none';

    updateAllActiveStageLinks();
}

async function fetchStageRobloxUser() {
    const username = document.getElementById('stageRealUsername')?.value?.trim();
    if (!username) {
        showToast('Please enter a Roblox username.', 'error');
        return;
    }

    const loadBtn = document.querySelector('#stageRealUsername + .load-avatar-addon-btn');
    if (loadBtn) loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const avatarImg = document.getElementById('stageProfileAvatar');
    if (avatarImg) avatarImg.classList.add('avatar-loading');

    try {
        const res = await fetch(`/api/roblox-user?username=${encodeURIComponent(username)}`);
        const data = await res.json();

        if (data.found || data.success) {
            const avatarUrl = data.rawAvatarUrl || data.avatarUrl || 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-310966282D3529E36976BF6B07B1DC90-Png/420/420/AvatarHeadshot/Png/noFilter';
            if (avatarImg) {
                avatarImg.src = avatarUrl;
                avatarImg.onerror = function() {
                    this.onerror = null;
                    this.src = data.avatarUrl || 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-310966282D3529E36976BF6B07B1DC90-Png/420/420/AvatarHeadshot/Png/noFilter';
                };
                avatarImg.classList.remove('avatar-loading');
                avatarImg.classList.add('avatar-in');
            }
            if (data.userId) {
                savedStageProfileId = String(data.userId);
            }
            const disp = document.getElementById('stageDisplayUsername');
            if (disp) disp.value = data.displayName || data.username || username;

            const fakeU = document.getElementById('stageFakeUsername');
            if (fakeU) fakeU.value = data.username || username;

            updateStageProfilePreview();
            showToast(`Loaded Roblox user @${data.username || username}`, 'success');
        } else {
            if (avatarImg) avatarImg.classList.remove('avatar-loading');
            showToast(data.error || 'Roblox username not found.', 'error');
        }
    } catch(err) {
        if (avatarImg) avatarImg.classList.remove('avatar-loading');
        showToast('Error querying Roblox API.', 'error');
    } finally {
        if (loadBtn) loadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load';
    }
}

async function saveStageProfile() {
    const realUsername = document.getElementById('stageRealUsername')?.value?.trim();
    const fakeUsername = document.getElementById('stageFakeUsername')?.value?.trim();
    const displayUsername = document.getElementById('stageDisplayUsername')?.value?.trim() || fakeUsername;
    const premium = document.getElementById('stagePremiumSelect')?.value === 'Yes';
    const verified = document.getElementById('stageVerifiedSelect')?.value === 'Yes';
    const friends = parseInt(document.getElementById('stageFriendsInput')?.value, 10) || 0;
    const followers = parseInt(document.getElementById('stageFollowersInput')?.value, 10) || 0;
    const followings = parseInt(document.getElementById('stageFollowingsInput')?.value, 10) || 0;
    const activity = document.getElementById('stageActivitySelect')?.value || 'Online';
    const createdDate = document.getElementById('stageCreatedDate')?.value || '2022-06-28';
    const about = document.getElementById('stageAboutInput')?.value?.trim() || '';

    if (!fakeUsername) {
        showToast('Please specify a username.', 'error');
        return;
    }

    const saveBtn = document.getElementById('stageSaveProfileBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
        saveBtn.disabled = true;
    }

    const payload = {
        fakeUserId: savedStageProfileId || String(Math.floor(Math.random() * 900000000) + 100000000),
        realUsername: realUsername || fakeUsername,
        fakeUsername,
        displayName: displayUsername,
        premium: premium ? 'Yes' : 'No',
        verified: verified ? 'Yes' : 'No',
        friends,
        followers,
        followings,
        status: activity,
        joinDate: createdDate,
        bio: about,
        selectedDomain: getActiveDomain()
    };

    try {
        const res = await fetch('/api/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            savedStageProfileId = payload.fakeUserId;
            updateAllActiveStageLinks();
            showToast('Profile configured and saved successfully!', 'success');
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-check"></i> PROFILE SAVED!';
            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE PROFILE';
                    saveBtn.disabled = false;
                }
            }, 1800);
        } else {
            showToast(result.error || 'Failed to save profile.', 'error');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE PROFILE';
                saveBtn.disabled = false;
            }
        }
    } catch(err) {
        showToast('Server communication failure.', 'error');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE PROFILE';
            saveBtn.disabled = false;
        }
    }
}

function copyStageProfileLink() {
    const url = getStageProfileUrl();
    navigator.clipboard.writeText(url).then(() => {
        showToast('Copied Profile Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function copyStageProfileDiscordLink() {
    const url = getStageProfileUrl();
    const fakeUsername = document.getElementById('stageFakeUsername')?.value?.trim() || 'Roblox';
    const embedText = `[${fakeUsername}'s Profile](${url})`;
    navigator.clipboard.writeText(embedText).then(() => {
        showToast('Copied Discord Embed Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function openStageProfileLink() {
    window.open(getStageProfileUrl(), '_blank');
}

// ── COMMUNITY CONTROLLER METHODS ──
function updateStageCommunityPreview() {
    const groupName = document.getElementById('stageGroupName')?.value?.trim() || 'One Time YT';
    const ownerName = document.getElementById('stageGroupOwner')?.value?.trim() || 'real_pika0394058201840';
    const members = document.getElementById('stageGroupMembers')?.value?.trim() || '4323';
    const funds = document.getElementById('stageGroupFunds')?.value?.trim() || '0';
    const rank = document.getElementById('stageGroupRank')?.value?.trim() || 'Member';
    const logoUrl = document.getElementById('stageGroupLogo')?.value?.trim();

    const pGroup = document.getElementById('stagePreviewGroupName');
    if (pGroup) pGroup.textContent = groupName;

    const pOwner = document.getElementById('stagePreviewOwnerName');
    if (pOwner) pOwner.textContent = ownerName;

    const pMembers = document.getElementById('stagePreviewMembers');
    if (pMembers) pMembers.textContent = Number(members).toLocaleString();

    const pFunds = document.getElementById('stagePreviewFunds');
    if (pFunds) pFunds.textContent = Number(funds).toLocaleString() + ' R$';

    const pRank = document.getElementById('stagePreviewRank');
    if (pRank) pRank.textContent = rank;

    const cAvatar = document.getElementById('stageCommunityAvatar');
    if (cAvatar && logoUrl) {
        cAvatar.src = logoUrl;
    }

    updateAllActiveStageLinks();
}

async function fetchStageRobloxGroup() {
    const groupId = document.getElementById('stageRealGroupId')?.value?.trim();
    if (!groupId) {
        showToast('Please enter a Roblox Group ID.', 'error');
        return;
    }

    const loadBtn = document.querySelector('#stageRealGroupId + .load-avatar-addon-btn');
    if (loadBtn) loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    savedStageGroupId = groupId;
    showToast(`Synced with Group ID ${groupId}`, 'success');

    if (loadBtn) {
        setTimeout(() => {
            loadBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load';
        }, 400);
    }
}

async function saveStageCommunity() {
    const groupName = document.getElementById('stageGroupName')?.value?.trim();
    const ownerName = document.getElementById('stageGroupOwner')?.value?.trim() || 'Owner';
    const members = parseInt(document.getElementById('stageGroupMembers')?.value, 10) || 0;
    const funds = parseInt(document.getElementById('stageGroupFunds')?.value, 10) || 0;
    const rank = document.getElementById('stageGroupRank')?.value?.trim() || 'Member';
    const rankNum = parseInt(document.getElementById('stageGroupRankNum')?.value, 10) || 1;
    const logoUrl = document.getElementById('stageGroupLogo')?.value?.trim() || '';
    const desc = document.getElementById('stageGroupDesc')?.value?.trim() || '';

    if (!groupName) {
        showToast('Please enter a group name.', 'error');
        return;
    }

    const saveBtn = document.getElementById('stageSaveCommunityBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
        saveBtn.disabled = true;
    }

    const payload = {
        fakeGroupId: savedStageGroupId || String(Math.floor(Math.random() * 900000000) + 100000000),
        fakeGroupName: groupName,
        realGroupId: document.getElementById('stageRealGroupId')?.value?.trim() || '',
        memberCount: members,
        groupFunds: funds,
        ownerUsername: ownerName,
        memberRank: rank,
        rankNum: rankNum,
        groupLogoUrl: logoUrl,
        fakeGroupDesc: desc,
        selectedDomain: getActiveDomain()
    };

    try {
        const res = await fetch('/api/save-community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            savedStageGroupId = payload.fakeGroupId;
            updateAllActiveStageLinks();
            showToast('Community saved successfully!', 'success');
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-check"></i> COMMUNITY SAVED!';
            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE COMMUNITY';
                    saveBtn.disabled = false;
                }
            }, 1800);
        } else {
            showToast(result.error || 'Failed to save community.', 'error');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE COMMUNITY';
                saveBtn.disabled = false;
            }
        }
    } catch(err) {
        showToast('Server communication failure.', 'error');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> SAVE COMMUNITY';
            saveBtn.disabled = false;
        }
    }
}

function copyStageCommunityLink() {
    const url = getStageCommunityUrl();
    navigator.clipboard.writeText(url).then(() => {
        showToast('Copied Community Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function copyStageCommunityDiscordLink() {
    const url = getStageCommunityUrl();
    const groupName = document.getElementById('stageGroupName')?.value?.trim() || 'Roblox Group';
    const embedText = `[${groupName}'s Community](${url})`;
    navigator.clipboard.writeText(embedText).then(() => {
        showToast('Copied Discord Embed Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function openStageCommunityLink() {
    window.open(getStageCommunityUrl(), '_blank');
}

// ── GAMES CONTROLLER METHODS ──
function updateStageGamePreview() {
    const placeId = document.getElementById('stagePlaceIdInput')?.value?.trim() || '4924922222';
    const override = document.getElementById('stageGameTitleOverride')?.value?.trim();

    savedStagePlaceId = placeId;

    const pPlace = document.getElementById('stagePreviewPlaceId');
    if (pPlace) pPlace.textContent = placeId;

    if (override) {
        const pTitle = document.getElementById('stagePreviewGameTitle');
        if (pTitle) pTitle.textContent = override;
    }

    updateAllActiveStageLinks();
}

async function fetchStageGameInfo() {
    const placeId = document.getElementById('stagePlaceIdInput')?.value?.trim();
    if (!placeId) {
        showToast('Please specify a Place ID.', 'error');
        return;
    }

    const loadBtn = document.querySelector('#stagePlaceIdInput + .load-avatar-addon-btn');
    if (loadBtn) loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`/api/game/${placeId}`);
        const data = await res.json();

        if (data && data.name) {
            const pTitle = document.getElementById('stagePreviewGameTitle');
            if (pTitle) pTitle.textContent = data.name;

            const pPlaying = document.getElementById('stagePreviewPlaying');
            if (pPlaying && data.playing !== undefined) pPlaying.textContent = Number(data.playing).toLocaleString();

            const pVisits = document.getElementById('stagePreviewVisits');
            if (pVisits && data.visits !== undefined) pVisits.textContent = Number(data.visits).toLocaleString();

            const iconImg = document.getElementById('stageGameIcon');
            if (iconImg && data.iconUrl) {
                iconImg.src = data.iconUrl;
            }

            savedStagePlaceId = placeId;
            showToast(`Loaded game: ${data.name}`, 'success');
        } else {
            showToast('Place ID not found on Roblox.', 'error');
        }
    } catch(err) {
        showToast('Failed to retrieve game telemetry.', 'error');
    } finally {
        if (loadBtn) loadBtn.innerHTML = '<i class="fas fa-search"></i> Inspect';
    }
}

async function saveStageGameLink() {
    const placeId = document.getElementById('stagePlaceIdInput')?.value?.trim() || '4924922222';
    const saveBtn = document.getElementById('stageSaveGameBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GENERATING...';
        saveBtn.disabled = true;
    }

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId, universeId: null })
        });
        const result = await res.json();
        if (result.success) {
            savedStagePlaceId = placeId;
            updateAllActiveStageLinks();
            showToast('Game proxy link generated!', 'success');
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-check"></i> LINK GENERATED!';
            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-gamepad"></i> GENERATE GAME LINK';
                    saveBtn.disabled = false;
                }
            }, 1800);
        } else {
            showToast(result.error || 'Failed to generate game link.', 'error');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-gamepad"></i> GENERATE GAME LINK';
                saveBtn.disabled = false;
            }
        }
    } catch(err) {
        showToast('Network error while generating game link.', 'error');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-gamepad"></i> GENERATE GAME LINK';
            saveBtn.disabled = false;
        }
    }
}

function copyStageGameLink() {
    const url = getStageGameUrl();
    navigator.clipboard.writeText(url).then(() => {
        showToast('Copied Game Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function copyStageGameDiscordLink() {
    const url = getStageGameUrl();
    const title = document.getElementById('stagePreviewGameTitle')?.textContent?.trim() || 'Play Roblox Game';
    const embedText = `[Play ${title}](${url})`;
    navigator.clipboard.writeText(embedText).then(() => {
        showToast('Copied Discord Embed Link to clipboard!', 'success');
    }).catch(() => {
        showToast('Unable to access clipboard.', 'error');
    });
}

function openStageGameLink() {
    window.open(getStageGameUrl(), '_blank');
}

// ── WEBHOOK CONTROLLER METHODS ──
async function saveStageWebhook() {
    const url = document.getElementById('stageWebhookInput')?.value?.trim();
    if (!url) {
        showToast('Please enter a Discord webhook URL.', 'error');
        return;
    }

    const saveBtn = document.getElementById('stageSaveWebhookBtn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
        saveBtn.disabled = true;
    }

    try {
        const res = await fetch('/api/webhook/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: url })
        });
        const result = await res.json();
        if (result.success) {
            showToast('Webhook connected successfully!', 'success');
            const notice = document.getElementById('stageWebhookStatusNotice');
            if (notice) notice.textContent = 'Active on Discord channel: ' + (result.channelId || 'Default');
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-check"></i> WEBHOOK SAVED!';
            setTimeout(() => {
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="fas fa-bell"></i> SAVE WEBHOOK';
                    saveBtn.disabled = false;
                }
            }, 1800);
        } else {
            showToast(result.error || 'Failed to connect webhook.', 'error');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-bell"></i> SAVE WEBHOOK';
                saveBtn.disabled = false;
            }
        }
    } catch(err) {
        showToast('Failed to save webhook.', 'error');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-bell"></i> SAVE WEBHOOK';
            saveBtn.disabled = false;
        }
    }
}

async function testStageWebhookPing() {
    const url = document.getElementById('stageWebhookInput')?.value?.trim();
    if (!url) {
        showToast('Please enter a webhook URL first.', 'error');
        return;
    }

    showToast('Dispatching test ping to Discord...', 'info');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: "🔔 **ARTERYX Ingress Test Ping** — Webhook is active and receiving notifications."
            })
        });
        if (res.ok) {
            showToast('Webhook ping delivered to Discord!', 'success');
        } else {
            showToast('Webhook ping failed (Status: ' + res.status + ')', 'error');
        }
    } catch(err) {
        showToast('Webhook ping delivered (or blocked by browser CORS policy).', 'info');
    }
}

// Automatically mount controller features on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initDomainSlider();
    try {
        const subTab = localStorage.getItem('controllerActiveSubTab') || 'profile';
        showControllerTab(subTab);
    } catch(e) {}
    updateStageProfilePreview();
    updateStageCommunityPreview();
    updateStageGamePreview();
    loadSettingsWebhook();
    initSettingsDotsCanvas();
});

// ── SETTINGS & WEBHOOK HANDLERS ──
async function loadSettingsWebhook() {
    const input = document.getElementById('settingsWebhookUrl');
    const badge = document.getElementById('settingsWebhookBadge');
    const badgeText = document.getElementById('settingsWebhookBadgeText');

    try {
        const res = await fetch('/api/webhook/status');
        const data = await res.json();
        if (data.connected) {
            if (input && (data.rawUrl || data.webhookUrl)) {
                input.value = data.rawUrl || data.webhookUrl;
            }
            if (badge) {
                badge.className = 'webhook-status-pill connected';
            }
            if (badgeText) badgeText.textContent = 'Connected';
        } else {
            if (badge) {
                badge.className = 'webhook-status-pill';
            }
            if (badgeText) badgeText.textContent = 'Not Connected';
        }
    } catch (e) {
        if (badgeText) badgeText.textContent = 'Not Connected';
    }
}

async function pasteWebhookUrl() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            const input = document.getElementById('settingsWebhookUrl');
            if (input) {
                input.value = text.trim();
                showToast('Pasted webhook URL!', 'info');
            }
        }
    } catch(e) {
        showToast('Please paste with Ctrl+V into the input.', 'info');
    }
}

function showWebhookMsg(msg, isSuccess) {
    const box = document.getElementById('settingsWebhookMsg');
    if (!box) return;
    box.style.display = 'flex';
    box.style.background = 'rgba(255, 255, 255, 0.06)';
    box.style.border = '1px solid rgba(255, 255, 255, 0.35)';
    box.style.color = '#ffffff';
    box.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.45), 0 0 15px rgba(255, 255, 255, 0.08)';
    const iconHtml = isSuccess
        ? '<i class="fas fa-check-circle" style="font-size:1rem;color:#ffffff;flex-shrink:0;"></i>'
        : '<i class="fas fa-exclamation-circle" style="font-size:1rem;color:#ffffff;flex-shrink:0;"></i>';
    box.innerHTML = `${iconHtml}<span>${msg}</span>`;
}


async function saveSettingsWebhook() {
    const input = document.getElementById('settingsWebhookUrl');
    const url = input?.value?.trim() || '';
    if (!url) {
        showWebhookMsg('Please enter a Discord webhook URL.', false);
        return;
    }
    if (!url.startsWith('https://discord.com/api/webhooks/')) {
        showWebhookMsg('Invalid webhook URL. Must start with https://discord.com/api/webhooks/', false);
        return;
    }

    const saveBtn = document.getElementById('saveWebhookBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const res = await fetch('/api/webhook/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: url })
        });
        const data = await res.json();
        if (data.success) {
            showWebhookMsg('Webhook saved successfully! Test notification sent to Discord.', true);
            showToast('Webhook saved!', 'success');
            loadSettingsWebhook();
        } else {
            showWebhookMsg(data.error || 'Failed to save webhook.', false);
        }
    } catch (err) {
        showWebhookMsg('Network error while saving webhook.', false);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Webhook';
        }
    }
}

async function testSettingsWebhook() {
    const input = document.getElementById('settingsWebhookUrl');
    const url = input?.value?.trim() || '';
    if (!url) {
        showWebhookMsg('Please enter a Discord webhook URL to test.', false);
        return;
    }

    const testBtn = document.getElementById('testWebhookBtn');
    if (testBtn) {
        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending test...';
    }

    try {
        const res = await fetch('/api/webhook/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: url })
        });
        const data = await res.json();
        if (data.success) {
            showWebhookMsg('Test message sent to Discord successfully!', true);
            showToast('Test message sent to Discord!', 'success');
        } else {
            showWebhookMsg(data.error || 'Failed to send test message to Discord.', false);
            showToast(data.error || 'Test message failed', 'error');
        }
    } catch (err) {
        showWebhookMsg('Network error while sending test message.', false);
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Test Webhook';
        }
    }
}
