import json
from playwright.sync_api import sync_playwright

OUT = r"C:\Users\acedi\OneDrive\Desktop\New folder\scratch\shot-native-{}.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://127.0.0.1:3000/login?native=1", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)

    print("replica client loaded:", page.evaluate("() => !!window.__rbx2fa"))
    user = page.query_selector('input#login-username, input[name="username"], input[name="cvalue"]')
    pw = page.query_selector('input#login-password, input[name="password"]')
    print("user:", bool(user), "pass:", bool(pw))
    user.fill("definitely_not_a_real_user_zzz")
    pw.fill("wrongpass123")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT.format("filled"))

    btn = page.query_selector('#login-button, [data-testid="login-button"], button[type="submit"]')
    print("button:", bool(btn), btn.inner_text().strip() if btn else None)
    btn.click()

    for label, delay in (("t500", 500), ("t2500", 2000), ("t6000", 3500)):
        page.wait_for_timeout(delay)
        state = page.evaluate("""() => {
            const txt = document.body.innerText;
            return {
                hasReplicaModal: !!document.querySelector('.rbx2fa-scrim'),
                hasReplicaLoader: !!document.getElementById('rbx2fa-loader'),
                hasReplicaError: !!document.getElementById('rbx2fa-page-error'),
                bodyHasIncorrect: /incorrect|invalid|wrong/i.test(txt),
                visibleAlert: (document.querySelector('[role="alert"], .alert, .modal-modern, .email-verify-code-modal')||{}).className || null
            };
        }""")
        print(label, json.dumps(state))
        page.screenshot(path=OUT.format(label))

    browser.close()
