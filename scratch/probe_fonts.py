"""What fonts does the login page actually load, and do they succeed?"""
import json
from playwright.sync_api import sync_playwright

URL = "http://localhost:3000/login.php"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 900, "height": 800})
    page = ctx.new_page()
    fonts, failed = [], []
    page.on("response", lambda r: fonts.append((r.status, r.url)) if r.request.resource_type == "font" else None)
    page.on("requestfailed", lambda r: failed.append(f"{r.resource_type} {r.url}"))

    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1200)

    family = page.evaluate("""() => {
      const h = [...document.querySelectorAll('h1,h2')].find(e => /Login to Roblox/i.test(e.textContent));
      if (!h) return null;
      const cs = getComputedStyle(h);
      return { text: h.textContent.trim(), font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight };
    }""")
    print("heading:", json.dumps(family))
    print("fonts loaded:", json.dumps(fonts[:8], indent=1))
    print("failed reqs:", json.dumps(failed[:8], indent=1))
    b.close()
