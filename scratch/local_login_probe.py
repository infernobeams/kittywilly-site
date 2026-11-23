"""
Real-account browser test against the local replica.

Opens the site's own login page, types the real credentials, clicks submit, and
watches what the page does while the proxy clears Roblox's CSRF and proof-of-work
gates. Reports whether the browser ends up holding a .ROBLOSECURITY cookie, which
is the only thing that proves the login actually went through.

    python scratch/local_login_probe.py <username> <password>
"""

import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
USER = sys.argv[1] if len(sys.argv) > 1 else "indefinitetesting"
PASS = sys.argv[2] if len(sys.argv) > 2 else "charizardx"

hops = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 860})
        page = ctx.new_page()

        def on_response(r):
            u = r.url
            if "/proxy/roblox" in u or "/capture" in u or "/rblx-auth" in u:
                hops.append(f"{r.status} {r.request.method} {u.split('?')[0][:120]}")

        page.on("response", on_response)

        print(f"opening {BASE}/login …")
        page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)

        print("form check:")
        for sel in ("#login-username", "#login-password", "#login-button"):
            print(f"  {sel}: {page.locator(sel).count()}")

        page.fill("#login-username", USER)
        page.fill("#login-password", PASS)
        page.wait_for_timeout(400)

        print("submitting — proxy has a ~7s proof-of-work to clear …")
        started = time.time()
        page.click("#login-button")

        found = None
        for i in range(16):
            page.wait_for_timeout(4000)
            elapsed = int(time.time() - started)
            cookies = ctx.cookies()
            session = [c for c in cookies if c["name"] == ".ROBLOSECURITY"]
            print(f"  +{elapsed}s  url={page.url}  .ROBLOSECURITY={'yes' if session else 'no'}")
            if session:
                found = session[0]
                break

        print("\nproxy hops:")
        for h in hops:
            print(f"  {h}")

        if found:
            print(f"\nSESSION HELD IN BROWSER — {len(found['value'])} chars")
            print(f"  preview {found['value'][:45]}…{found['value'][-8:]}")
        else:
            print("\nno session cookie in the browser")

        page.screenshot(path="scratch/local_login_result.png")
        print("\nvisible text:")
        try:
            print(page.locator("body").inner_text()[:700])
        except Exception as e:
            print("  (none)", e)

        print("\nscreenshot: scratch/local_login_result.png")
        browser.close()


if __name__ == "__main__":
    main()
