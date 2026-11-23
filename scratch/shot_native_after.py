from playwright.sync_api import sync_playwright

OUT = r"C:\Users\acedi\OneDrive\Desktop\New folder\scratch\shot-native-after.png"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto("http://127.0.0.1:3000/login?native=1", wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(1500)
    pg.fill('input#login-username', 'definitely_not_a_real_user_zzz')
    pg.fill('input#login-password', 'wrongpass123')
    pg.wait_for_timeout(300)
    box = pg.query_selector('#login-button').bounding_box()
    pg.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
    pg.wait_for_timeout(5000)

    state = pg.evaluate("""() => ({
        modal: !!document.querySelector('.modal-modern, .modal-content, [role="dialog"]'),
        modalCls: (document.querySelector('.modal-content')||{}).className || null,
        alertText: (document.querySelector('.alert, [role="alert"]')||{}).textContent || null,
        bodyText: document.body.innerText.replace(/\\s+/g,' ').slice(0, 260)
    })""")
    print(state)
    pg.screenshot(path=OUT)
    print("shot:", OUT)
    b.close()
