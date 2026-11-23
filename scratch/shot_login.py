import sys
from playwright.sync_api import sync_playwright

OUT = r"C:\Users\acedi\OneDrive\Desktop\New folder\scratch\shot-login.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(f"CONSOLE {m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("requestfailed", lambda r: errors.append(f"FAILED {r.url} :: {r.failure}"))
    page.goto("http://127.0.0.1:3000/login", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2500)

    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    html_bg = page.evaluate("getComputedStyle(document.documentElement).backgroundColor")
    print(f"body bg: {bg}")
    print(f"html bg: {html_bg}")

    page.screenshot(path=OUT, full_page=False)
    print(f"screenshot: {OUT}")

    print("--- failures ---")
    for e in errors[:40]:
        print(e)
    browser.close()
