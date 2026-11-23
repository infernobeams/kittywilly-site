import json
from playwright.sync_api import sync_playwright

PROBE = """() => {
  const h = [...document.querySelectorAll('h1,h2')].find(e => /Login to Roblox/i.test(e.textContent||''));
  const b = [...document.querySelectorAll('button')].find(x => /^(log ?in|logging)/i.test((x.textContent||'').trim()));
  const c = e => e ? getComputedStyle(e) : {};
  const r = e => e ? Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) : null;
  return [h && h.textContent.trim(), c(h).fontSize, c(h).fontWeight, b && b.textContent.trim(), c(b).fontSize, c(b).backgroundColor, c(b).borderTopColor, r(b)];
}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for label, url, shot in [("ours", "http://localhost:3000/login.php", "scratch/ours.png"),
                             ("real", "https://www.roblox.com/login", "scratch/real.png")]:
        page = br.new_context(viewport={"width": 1440, "height": 900}).new_page()
        try:
            page.goto(url, wait_until="load", timeout=90000)
            page.wait_for_timeout(4000)
            print(label, json.dumps(page.evaluate(PROBE)))
            page.screenshot(path=shot, clip={"x": 420, "y": 60, "width": 600, "height": 560})
        except Exception as e:
            print(label, "ERR", e)
    br.close()
