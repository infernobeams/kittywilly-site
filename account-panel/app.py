# language: Python, file: app.py, target: local control panel on 127.0.0.1:8100
# drives the signup flow in config.json: fresh browser context per account, photo upload,
# explicit logout, screenshot per hit, live status table, CSV out.
from __future__ import annotations

import base64
import csv
import io
import json
import random
import threading
import time
import uuid
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, Response
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))

SHOT_DIR = ROOT / CFG["run"]["screenshot_dir"]
PHOTO_DIR = ROOT / CFG["photos"]["dir"]
for _d in (ROOT / "out", SHOT_DIR, PHOTO_DIR):
    _d.mkdir(parents=True, exist_ok=True)

PHOTO_EXT = {".png", ".jpg", ".jpeg", ".webp"}

# 1x1 png, written once so the pool is never empty and the run never stubs out
FALLBACK_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

app = FastAPI(title="account panel")

_LOCK = threading.Lock()
_JOBS: dict[str, dict] = {}


def photo_pool() -> list[Path]:
    files = [p for p in PHOTO_DIR.iterdir() if p.suffix.lower() in PHOTO_EXT]
    if files:
        return files
    seed = PHOTO_DIR / "_placeholder.png"
    if not seed.exists():
        seed.write_bytes(FALLBACK_PNG)
    return [seed]


def make_handle() -> str:
    spec = CFG["handle"]
    charset = spec["charset"]
    length = int(spec["length"])
    return "".join(random.choice(charset) for _ in range(length))


def clock() -> str:
    return time.strftime("%H:%M:%S")


def snapshot(job_id: str) -> dict:
    with _LOCK:
        j = _JOBS[job_id]
        return {
            "id": job_id,
            "state": j["state"],
            "total": j["total"],
            "done": j["done"],
            "ok": j["ok"],
            "bad": j["bad"],
            "error": j["error"],
            "rows": [dict(r) for r in j["rows"]],
        }


def mark(row: dict, **kw) -> None:
    with _LOCK:
        row.update(kw)


def bump(job_id: str, key: str) -> None:
    with _LOCK:
        _JOBS[job_id][key] += 1


def worker(job_id: str, count: int) -> None:
    tgt = CFG["target"]
    sel = CFG["selectors"]
    run = CFG["run"]
    timeout = int(run["nav_timeout_ms"])
    signup_url = tgt["base_url"].rstrip("/") + tgt["signup_path"]
    logout_url = tgt["base_url"].rstrip("/") + tgt["logout_path"]
    combined = f"{sel['success_marker']}, {sel['error_marker']}"

    with _LOCK:
        _JOBS[job_id]["state"] = "running"

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=bool(run["headless"]),
                args=list(run.get("launch_args", [])),
            )
            try:
                for i in range(count):
                    with _LOCK:
                        if _JOBS[job_id]["state"] == "stopping":
                            break

                    handle = make_handle()
                    photo = random.choice(photo_pool())
                    row = {
                        "n": i + 1,
                        "handle": handle,
                        "status": "running",
                        "detail": "",
                        "shot": "",
                        "at": clock(),
                    }
                    with _LOCK:
                        _JOBS[job_id]["rows"].append(row)

                    context = browser.new_context()
                    page = context.new_page()
                    page.set_default_timeout(timeout)
                    try:
                        page.goto(signup_url, wait_until="domcontentloaded", timeout=timeout)
                        page.fill(sel["handle_input"], handle)
                        page.set_input_files(sel["photo_input"], str(photo))
                        page.click(sel["submit_button"])
                        page.wait_for_selector(combined, timeout=timeout)

                        if page.query_selector(sel["success_marker"]):
                            shot = SHOT_DIR / f"{job_id[:8]}_{i + 1:03d}_{handle}.png"
                            page.screenshot(path=str(shot), full_page=True)
                            try:
                                page.click(sel["logout_button"], timeout=4000)
                            except PWTimeout:
                                page.goto(logout_url, wait_until="domcontentloaded", timeout=timeout)
                            mark(row, status="created", shot=str(shot.relative_to(ROOT)))
                            bump(job_id, "ok")
                        else:
                            detail = ""
                            el = page.query_selector(sel["error_marker"])
                            if el:
                                detail = " ".join((el.inner_text() or "").split())[:160]
                            mark(row, status="failed", detail=detail or "rejected")
                            bump(job_id, "bad")

                    except PWTimeout as exc:
                        first = str(exc).splitlines()[0][:120]
                        mark(row, status="failed", detail=f"timeout: {first}")
                        bump(job_id, "bad")
                    except Exception as exc:
                        mark(row, status="failed", detail=f"{type(exc).__name__}: {exc}"[:160])
                        bump(job_id, "bad")
                    finally:
                        context.close()
                        with _LOCK:
                            _JOBS[job_id]["done"] = i + 1

                    pause = (int(run["delay_ms"]) + random.randint(0, int(run["delay_jitter_ms"]))) / 1000
                    time.sleep(pause)
            finally:
                browser.close()

    except Exception as exc:
        with _LOCK:
            _JOBS[job_id]["error"] = f"{type(exc).__name__}: {exc}"[:300]
    finally:
        with _LOCK:
            j = _JOBS[job_id]
            if j["state"] == "stopping":
                j["state"] = "stopped"
            elif j["error"]:
                j["state"] = "error"
            else:
                j["state"] = "done"


@app.post("/api/start")
async def api_start(payload: dict):
    try:
        count = int(payload.get("count", 1))
    except (TypeError, ValueError):
        return JSONResponse({"error": "count must be an integer"}, status_code=400)
    if not 1 <= count <= 5000:
        return JSONResponse({"error": "count must be 1..5000"}, status_code=400)

    job_id = uuid.uuid4().hex
    with _LOCK:
        _JOBS[job_id] = {
            "state": "queued",
            "total": count,
            "done": 0,
            "ok": 0,
            "bad": 0,
            "error": "",
            "rows": [],
        }
    threading.Thread(target=worker, args=(job_id, count), daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/job/{job_id}")
async def api_job(job_id: str):
    if job_id not in _JOBS:
        return JSONResponse({"error": "unknown job"}, status_code=404)
    return snapshot(job_id)


@app.post("/api/stop/{job_id}")
async def api_stop(job_id: str):
    if job_id not in _JOBS:
        return JSONResponse({"error": "unknown job"}, status_code=404)
    with _LOCK:
        if _JOBS[job_id]["state"] in ("queued", "running"):
            _JOBS[job_id]["state"] = "stopping"
        state = _JOBS[job_id]["state"]
    return {"state": state}


@app.get("/api/job/{job_id}/csv")
async def api_csv(job_id: str):
    if job_id not in _JOBS:
        return JSONResponse({"error": "unknown job"}, status_code=404)
    snap = snapshot(job_id)
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["n", "handle", "status", "detail", "screenshot", "at"])
    for r in snap["rows"]:
        writer.writerow([r["n"], r["handle"], r["status"], r["detail"], r["shot"], r["at"]])
    return Response(
        buf.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={"content-disposition": f'attachment; filename="{job_id[:8]}-accounts.csv"'},
    )


INDEX = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>account panel</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b0c0f;color:#e4e6ea;font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
header{display:flex;align-items:baseline;gap:16px;padding:18px 24px;border-bottom:1px solid #1c1e24;flex-wrap:wrap}
h1{font-size:14px;letter-spacing:.08em;text-transform:uppercase;margin:0;color:#f0f1f3}
.sub{color:#6b7280;font-size:12px}
main{display:grid;grid-template-columns:320px 1fr;min-height:calc(100vh - 61px)}
aside{padding:24px;border-right:1px solid #1c1e24}
section{padding:24px;overflow:auto;max-height:calc(100vh - 61px)}
label{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:0 0 6px}
input[type=number]{width:100%;background:#101216;border:1px solid #24272e;border-radius:6px;color:#e4e6ea;padding:10px;font:inherit}
button{font:inherit;cursor:pointer;border-radius:6px;border:1px solid #2a2e36;background:#15171c;color:#e4e6ea;padding:10px 14px}
button.primary{background:#e4e6ea;color:#0b0c0f;border-color:#e4e6ea;font-weight:600;width:100%;margin-top:12px}
button:disabled{opacity:.38;cursor:not-allowed}
.row{display:flex;gap:10px;margin-top:14px}
.row button{flex:1}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1c1e24;border:1px solid #1c1e24;border-radius:8px;overflow:hidden;margin-bottom:18px}
.stat{background:#101216;padding:14px}
.stat b{display:block;font-size:20px;color:#f0f1f3;font-weight:600}
.stat span{font-size:11px;color:#6b7280;letter-spacing:.05em;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;padding:0 8px 8px;border-bottom:1px solid #1c1e24}
td{padding:7px 8px;border-bottom:1px solid #14161a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
td.h{color:#8fb6ff}
.ok{color:#6ee7a0}.bad{color:#f28b8b}.run{color:#8a8f98}
a{color:#8fb6ff;text-decoration:none}
a:hover{text-decoration:underline}
.hint{color:#5d636d;font-size:12px;margin-top:16px;line-height:1.65}
#log{font-size:12px;color:#7b8291;margin-top:14px;min-height:18px;word-break:break-all}
</style></head><body>
<header><h1>account panel</h1><span class="sub">target: __TARGET__ · fresh context per account · explicit logout</span></header>
<main>
<aside>
  <label for="count">how many</label>
  <input id="count" type="number" min="1" max="5000" value="10">
  <button class="primary" id="go">generate</button>
  <div class="row">
    <button id="stop" disabled>stop</button>
    <button id="csv" disabled>csv</button>
  </div>
  <div id="log">idle</div>
  <p class="hint">handles: 8 chars from the configured charset. photos: pool dir, seeded with a placeholder if empty. screenshots land in out/shots.</p>
</aside>
<section>
  <div class="stats">
    <div class="stat"><b id="s-ok">0</b><span>created</span></div>
    <div class="stat"><b id="s-bad">0</b><span>failed</span></div>
    <div class="stat"><b id="s-left">0</b><span>left</span></div>
  </div>
  <table><thead><tr><th>#</th><th>handle</th><th>status</th><th>detail</th><th>time</th></tr></thead><tbody id="rows"></tbody></table>
</section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let job = null, poll = null;

function cell(text, cls) {
  const td = document.createElement('td');
  td.textContent = text;
  if (cls) td.className = cls;
  return td;
}

function render(s) {
  $('s-ok').textContent = s.ok;
  $('s-bad').textContent = s.bad;
  $('s-left').textContent = Math.max(0, s.total - s.done);
  const rows = s.rows.slice().reverse().slice(0, 500).map(r => {
    const tr = document.createElement('tr');
    const cls = r.status === 'created' ? 'ok' : (r.status === 'failed' ? 'bad' : 'run');
    tr.append(cell(r.n), cell(r.handle, 'h'), cell(r.status, cls), cell(r.detail || '—'), cell(r.at));
    return tr;
  });
  $('rows').replaceChildren(...rows);
  $('log').textContent = s.state + ' · ' + s.done + '/' + s.total + (s.error ? ' · ' + s.error : '');
  const live = s.state === 'queued' || s.state === 'running' || s.state === 'stopping';
  $('go').disabled = live;
  $('stop').disabled = !live;
  $('csv').disabled = s.rows.length === 0;
  if (!live && poll) { clearInterval(poll); poll = null; }
}

async function tick() {
  if (!job) return;
  const r = await fetch('/api/job/' + job);
  if (r.ok) render(await r.json());
}

$('go').onclick = async () => {
  const count = Number($('count').value || 1);
  const r = await fetch('/api/start', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({count})
  });
  const d = await r.json();
  if (!r.ok) { $('log').textContent = d.error || 'start failed'; return; }
  job = d.job_id;
  $('rows').replaceChildren();
  $('csv').disabled = true;
  if (poll) clearInterval(poll);
  poll = setInterval(tick, 500);
  tick();
};

$('stop').onclick = async () => { if (job) await fetch('/api/stop/' + job, {method: 'POST'}); };
$('csv').onclick = () => { if (job) window.location = '/api/job/' + job + '/csv'; };
</script>
</body></html>"""


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse(INDEX.replace("__TARGET__", CFG["target"]["base_url"]))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8100, log_level="warning")
