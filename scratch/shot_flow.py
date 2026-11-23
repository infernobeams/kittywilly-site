import json
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000/login"
OUT = r"C:\Users\acedi\OneDrive\Desktop\New folder\scratch\shot-flow-{}.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(BASE, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)

    # Locate the real login inputs
    user = page.query_selector('input#login-username, input[name="username"], input[name="cvalue"]')
    pw = page.query_selector('input#login-password, input[name="password"]')
    btn = page.query_selector('#login-button, [data-testid="login-button"], button[type="submit"]')
    print("user found:", bool(user), "pass found:", bool(pw), "button found:", bool(btn))

    user.fill("definitely_not_a_real_user_zzz")
    pw.fill("wrongpass123")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT.format("filled"))
    print("shot: filled")

    btn.click()
    for label, delay in (("t300", 300), ("t1200", 900), ("t4000", 2800)):
        page.wait_for_timeout(delay)
        state = page.evaluate("""() => {
            const loader = document.getElementById('rbx2fa-loader');
            const btn = document.getElementById('login-button') || document.querySelector('[data-testid="login-button"]');
            const err = document.getElementById('rbx2fa-page-error');
            return {
                loaderVisible: !!loader,
                loaderHTML: loader ? loader.outerHTML.slice(0,120) : null,
                btnVisible: btn ? getComputedStyle(btn).display : null,
                btnText: btn ? btn.textContent.trim() : null,
                pageError: err ? err.textContent.trim() : null,
                modalOpen: !!document.querySelector('.rbx2fa-scrim')
            };
        }""")
        print(label, json.dumps(state))
        page.screenshot(path=OUT.format(label))
        print("shot:", label)

    browser.close()
