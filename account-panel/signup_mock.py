# language: Python, file: signup_mock.py, target: local FastAPI on 127.0.0.1:8000
# stand-in signup surface: 8-char handle + photo in, created account out, logout link back.
# field shapes match config.json, so the panel has a real target to drive.
from __future__ import annotations

import re
import sqlite3
import time
import uuid
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse

ROOT = Path(__file__).resolve().parent
DB = ROOT / "mock_accounts.db"
UPLOADS = ROOT / "mock_uploads"
UPLOADS.mkdir(exist_ok=True)

HANDLE_RE = re.compile(r"^[A-Za-z0-9]{8}$")
MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {"image/png", "image/jpeg", "image/webp"}

app = FastAPI(title="signup mock")


def connect() -> sqlite3.Connection:
    return sqlite3.connect(DB, timeout=5)


def init_db() -> None:
    with connect() as cx:
        cx.execute(
            """CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                handle TEXT UNIQUE NOT NULL,
                photo TEXT NOT NULL,
                created_at REAL NOT NULL)"""
        )


init_db()

STYLE = """
:root{color-scheme:dark}
*{box-sizing:border-box}
body{background:#0c0d10;color:#e6e6e6;font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;display:grid;place-items:center;min-height:100vh;margin:0}
form,.panel{background:#14161a;border:1px solid #24262c;border-radius:10px;padding:28px;width:340px}
h1{font-size:16px;margin:0 0 20px;letter-spacing:.05em;text-transform:uppercase;color:#9aa0aa}
label{display:block;font-size:12px;color:#7d838d;margin:14px 0 6px}
input{width:100%;background:#0c0d10;border:1px solid #2a2d34;border-radius:6px;color:#e6e6e6;padding:9px 10px;font:inherit}
button{margin-top:20px;width:100%;padding:10px;background:#e6e6e6;color:#0c0d10;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer}
.flash{padding:10px;border-radius:6px;font-size:13px;margin-bottom:16px}
.error{background:#301216;border:1px solid #5c1f28;color:#e08f8f}
.handle{font-size:20px;color:#f0f1f3;margin:0 0 4px}
.meta{font-size:12px;color:#6b7280;margin:0 0 18px}
a{color:#8fb6ff;text-decoration:none;font-size:13px}
a:hover{text-decoration:underline}
"""

FORM = (
    """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>signup mock</title>
<style>"""
    + STYLE
    + """</style></head><body>
<form method="post" action="/gen/enter" enctype="multipart/form-data">
  <h1>create account</h1>
  __FLASH__
  <label for="handle">handle — 8 characters</label>
  <input id="handle" name="handle" maxlength="8" autocomplete="off" required>
  <label for="photo">photo</label>
  <input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" required>
  <button type="submit">submit</button>
</form></body></html>"""
)

SUCCESS = (
    """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>created</title>
<style>"""
    + STYLE
    + """</style></head><body>
<div class="panel" id="account-created">
  <h1>account created</h1>
  <p class="handle">__HANDLE__</p>
  <p class="meta">row committed to mock_accounts.db</p>
  <a href="/logout">log out</a>
</div></body></html>"""
)

SIGNED_OUT = (
    """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>signed out</title>
<style>"""
    + STYLE
    + """</style></head><body>
<div class="panel" id="signed-out">
  <h1>signed out</h1>
  <p class="meta">session cleared</p>
  <a href="/gen/enter">back to signup</a>
</div></body></html>"""
)


def reject(message: str) -> HTMLResponse:
    body = FORM.replace("__FLASH__", f'<div class="error flash">{message}</div>')
    return HTMLResponse(body, status_code=400)


@app.get("/")
async def root() -> RedirectResponse:
    return RedirectResponse("/gen/enter")


@app.get("/gen/enter", response_class=HTMLResponse)
async def form() -> HTMLResponse:
    return HTMLResponse(FORM.replace("__FLASH__", ""))


@app.post("/gen/enter", response_class=HTMLResponse)
async def create(handle: str = Form(""), photo: UploadFile = File(None)) -> HTMLResponse:
    clean = handle.strip()
    if not HANDLE_RE.match(clean):
        return reject("handle must be exactly 8 letters or digits")
    if photo is None or not photo.filename:
        return reject("photo required")
    if photo.content_type not in ALLOWED:
        return reject("photo must be png, jpeg or webp")

    blob = await photo.read()
    if not blob or len(blob) > MAX_BYTES:
        return reject("photo is empty or over 5 MB")

    stored = f"{uuid.uuid4().hex}{Path(photo.filename).suffix.lower()}"
    (UPLOADS / stored).write_bytes(blob)

    cx = connect()
    try:
        cx.execute(
            "INSERT INTO accounts (handle, photo, created_at) VALUES (?,?,?)",
            (clean, stored, time.time()),
        )
        cx.commit()
    except sqlite3.IntegrityError:
        (UPLOADS / stored).unlink(missing_ok=True)
        return HTMLResponse(
            FORM.replace(
                "__FLASH__", '<div class="error flash">handle already taken</div>'
            ),
            status_code=409,
        )
    finally:
        cx.close()

    return HTMLResponse(SUCCESS.replace("__HANDLE__", clean))


@app.get("/logout", response_class=HTMLResponse)
async def logout() -> HTMLResponse:
    return HTMLResponse(SIGNED_OUT)


@app.get("/api/stats")
async def stats() -> dict:
    cx = connect()
    try:
        total = cx.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        recent = [
            row[0]
            for row in cx.execute(
                "SELECT handle FROM accounts ORDER BY id DESC LIMIT 10"
            ).fetchall()
        ]
    finally:
        cx.close()
    return {"accounts": total, "recent": recent}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
