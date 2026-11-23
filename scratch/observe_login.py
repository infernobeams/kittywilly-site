"""
Watch a real Roblox login to learn the challenge retry shape.

Drives https://www.roblox.com/login directly (not through the local proxy) and
prints every hop that touches auth, the proof-of-work service or the login page:
the request headers the client sends and the challenge headers the server returns.
Whatever the winning retry looks like is the spec the proxy has to reproduce.

    python scratch/observe_login.py <username> <password>
"""

import json
import sys
import time

from playwright.sync_api import sync_playwright

USER = sys.argv[1] if len(sys.argv) > 1 else "indefinitetesting"
PASS = sys.argv[2] if len(sys.argv) > 2 else "charizardx"

INTERESTING_HOSTS = ("auth.roblox.com", "apis.roblox.com", "roblox.com")
REQ_HEADERS = (
    "x-csrf-token",
    "rblx-challenge-id",
    "rblx-challenge-type",
    "rblx-challenge-metadata",
    "content-type",
    "origin",
)
RES_HEADERS = (
    "x-csrf-token",
    "rblx-challenge-id",
    "rblx-challenge-type",
    "rblx-challenge-metadata",
    "set-cookie",
)

seq = 0


def short(url: str) -> str:
    return url.split("?", 1)[0]


def on_request(req):
    global seq
    url = req.url
    if not any(h in url for h in INTERESTING_HOSTS):
        return
    # only the calls that matter: auth, pow, challenge
    if not any(k in url for k in ("auth.roblox.com", "proof-of-work", "/challenge", "challenge")):
        return
    seq += 1
    print(f"\n[{seq}] REQ {req.method} {short(url)}")
    q = url.split("?", 1)[1] if "?" in url else ""
    if q:
        print(f"     query: {q[:200]}")
    for h in REQ_HEADERS:
        v = req.headers.get(h)
        if v:
            if h == "rblx-challenge-metadata":
                try:
                    decoded = json.loads(__import__("base64").b64decode(v + "=="))
                    print(f"     {h}: {json.dumps(decoded)[:400]}")
                except Exception:
                    print(f"     {h}: {v[:200]}")
            else:
                print(f"     {h}: {v[:260]}")
    body = req.post_data
    if body:
        print(f"     body: {body[:400]}")


def on_response(res):
    url = res.url
    if not any(h in url for h in INTERESTING_HOSTS):
        return
    if not any(k in url for k in ("auth.roblox.com", "proof-of-work", "challenge")):
        return
    ct = res.headers.get("rblx-challenge-type")
    sc = res.headers.get("set-cookie") or ""
    interesting = ct or ".ROBLOSECURITY" in sc or res.status not in (200, 204)
    if not interesting:
        return
    print(f"  <- RES {res.status} {short(url)}")
    for h in RES_HEADERS:
        v = res.headers.get(h)
        if v:
            if h == "set-cookie":
                names = [c.split(";")[0].split("=")[0] for c in v.split(", ")]
                print(f"     set-cookie: {', '.join(names)}")
                if ".ROBLOSECURITY" in v:
                    print("     *** .ROBLOSECURITY ISSUED ***")
            elif h == "rblx-challenge-metadata":
                try:
                    decoded = json.loads(__import__("base64").b64decode(v + "=="))
                    print(f"     {h}: {json.dumps(decoded)[:400]}")
                except Exception:
                    print(f"     {h}: {v[:200]}")
            else:
                print(f"     {h}: {v[:260]}")
    try:
        if res.status >= 400:
            print(f"     body: {res.text()[:300]}")
    except Exception:
        pass


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        locale="en-US",
    )
    page = ctx.new_page()
    page.on("request", on_request)
    page.on("response", on_response)

    print("opening login page…")
    page.goto("https://www.roblox.com/login", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(6000)

    print(f"\npage title: {page.title()}")
    for sel in ("#login-username", "input[name='username']", "#login-password", "#login-button"):
        print(f"  {sel}: {page.locator(sel).count()}")

    print("\nfilling…")
    page.fill("#login-username", USER)
    page.fill("#login-password", PASS)
    page.wait_for_timeout(400)
    print("submitting…")
    page.click("#login-button")

    # watch for a while: challenge solve plus 2FA window
    for i in range(12):
        page.wait_for_timeout(5000)
        cookies = ctx.cookies()
        has = [c for c in cookies if c["name"] == ".ROBLOSECURITY"]
        print(f"\n[+{(i + 1) * 5}s] url={page.url}  .ROBLOSECURITY={'yes' if has else 'no'}")
        if has:
            print(f"     cookie length: {len(has[0]['value'])}")
            break

    print("\nvisible text sample:")
    try:
        txt = page.locator("body").inner_text()[:900]
        print(txt)
    except Exception as e:
        print("  (no text)", e)

    page.screenshot(path="scratch/real_client_login.png", full_page=False)
    print("\nscreenshot: scratch/real_client_login.png")
    browser.close()
