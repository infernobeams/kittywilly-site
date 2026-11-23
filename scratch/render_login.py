"""Render our login page in a real browser and report what it looks like."""
import json
from playwright.sync_api import sync_playwright

OUT = "scratch/login_render.png"
URL = "http://localhost:3000/login.php"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)
    page.screenshot(path=OUT, full_page=False)

    info = page.evaluate("""() => {
      const cs = el => el ? getComputedStyle(el) : null;
      const u = document.querySelector('#login-username');
      const t = document.querySelector('h1, .text-title-2xl, [class*=title]');
      return {
        url: location.href,
        hasUsername: !!u,
        hasPassword: !!document.querySelector('#login-password'),
        hasLoginBtn: !!document.querySelector('#login-button'),
        usernamePlaceholder: u && u.placeholder,
        bodyBg: cs(document.body) && cs(document.body).backgroundColor,
        titleText: t && t.textContent.trim().slice(0, 40),
        titleSize: t && cs(t).fontSize,
        interceptor: !!window.__rbx2fa,
        sheets: document.styleSheets.length,
        forms: document.querySelectorAll('form').length
      };
    }""")

    print(json.dumps(info, indent=1))
    print("console errors:", errors[:6])
    b.close()
