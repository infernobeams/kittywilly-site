from playwright.sync_api import sync_playwright

OUT = r"C:\Users\acedi\OneDrive\Desktop\New folder\scratch\shot-captcha.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://127.0.0.1:3000/login", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
        // Reach the captcha card through the module's own public surface.
        const ev = new Event('x');
        window.__rbx2fa.open('Email');
    }""")
    page.wait_for_timeout(400)
    w = page.evaluate("() => { const c = document.querySelector('.rbx2fa-card'); return c ? c.getBoundingClientRect().width : null; }")
    print("card width:", w)
    page.screenshot(path=OUT)
    print("shot:", OUT)
    browser.close()
