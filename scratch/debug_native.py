import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
    page.on("pageerror", lambda e: logs.append(f"PAGEERROR: {str(e)[:300]}"))
    reqs = []
    page.on("request", lambda r: reqs.append(f"{r.method} {r.url[:160]}") if "/login" in r.url or "v2/login" in r.url or "challenge" in r.url else None)

    page.goto("http://127.0.0.1:3000/login?native=1", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)

    info = page.evaluate("""() => {
        const inputs = [...document.querySelectorAll('input')].map(i => ({
            id: i.id, name: i.name, type: i.type, ph: i.placeholder
        }));
        const btns = [...document.querySelectorAll('button')].slice(0,8).map(b => ({
            id: b.id, cls: b.className.slice(0,80), txt: (b.textContent||'').trim().slice(0,30),
            disabled: b.disabled, type: b.type
        }));
        return { inputs, btns, hasReact: !!document.querySelector('[data-reactroot],#react-app,#login-base') };
    }""")
    print(json.dumps(info, indent=1)[:1800])

    user = page.query_selector('input#login-username, input[name="username"], input[name="cvalue"]')
    pw = page.query_selector('input#login-password, input[name="password"]')
    user.fill("definitely_not_a_real_user_zzz")
    pw.fill("wrongpass123")
    page.wait_for_timeout(500)

    print("--- requests during fill ---")
    for r in reqs[-10:]:
        print(r)
    reqs.clear()

    btn = page.query_selector('#login-button') or page.query_selector('button[type="submit"]')
    if btn:
        box = btn.bounding_box()
        print("button box:", box)
        page.mouse.click(box["x"] + box["width"]/2, box["y"] + box["height"]/2)
    page.wait_for_timeout(4000)

    print("--- requests after click ---")
    for r in reqs[-15:]:
        print(r)
    print("--- console ---")
    for l in logs[-15:]:
        print(l)

    browser.close()
