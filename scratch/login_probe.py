"""Headless probe for the local login replica.

Checks that the page renders its form, that client-side bundles resolve,
and that a submit reaches the capture path instead of dying on a 404.
No real credentials are used.
"""

import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
USER = "bench_probe_user"
PASS = "ProbePass!123"

report = {"console": [], "failed": [], "requests": [], "form": {}, "submit": {}}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 860})

        page.on("console", lambda m: report["console"].append(f"{m.type}: {m.text}"[:300]))
        page.on("requestfailed", lambda r: report["failed"].append(f"{r.method} {r.url} :: {r.failure}"[:300]))

        def on_response(r):
            u = r.url
            if r.status >= 400:
                report.setdefault("errors", []).append(f"{r.status} {r.request.method} {u}"[:240])
            if any(k in u for k in ("/rblx-auth", "/api/auth", "/capture", "/proxy/roblox")):
                report["requests"].append(f"{r.status} {r.request.method} {u}"[:300])

        page.on("response", on_response)

        page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)

        report["form"]["title"] = page.title()
        for sel in ("#login-username", "#login-password", "input[name='username']", "input[name='password']", "button#login-button"):
            report["form"][sel] = page.locator(sel).count()

        report["form"]["visible_password"] = page.locator("#login-password").first.is_visible() if page.locator("#login-password").count() else False

        page.screenshot(path="scratch/login_page.png", full_page=False)

        if page.locator("#login-username").count():
            page.fill("#login-username", USER)
            if page.locator("#login-password").count():
                page.fill("#login-password", PASS)

            clicked = False
            for sel in ("#login-button", "button[type='submit']", "button[type='button']"):
                if page.locator(sel).count():
                    try:
                        page.locator(sel).first.click(timeout=5000)
                        clicked = True
                        break
                    except Exception:
                        continue
            if not clicked:
                page.keyboard.press("Enter")

            page.wait_for_timeout(6000)
            report["submit"]["clicked"] = clicked
            report["submit"]["url"] = page.url

        page.screenshot(path="scratch/login_after_submit.png", full_page=False)
        browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        report["fatal"] = f"{type(exc).__name__}: {exc}"
    with open("scratch/probe_report.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(json.dumps({"errors": len(report.get("errors", [])), "capture_calls": len(report.get("requests", []))}))
