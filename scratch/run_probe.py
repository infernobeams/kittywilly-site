"""Run the login probe and print only the failure surface."""

import json
import subprocess
import sys

PY = r"account-panel\.venv\Scripts\python.exe"
out = subprocess.run([PY, r"scratch\login_probe.py"], capture_output=True, text=True, encoding="utf-8", errors="replace")
print(out.stdout.strip()[:500])
if out.returncode != 0:
    print(out.stderr[:2000])
    sys.exit(1)

with open(r"scratch\probe_report.json", encoding="utf-8") as fh:
    rep = json.load(fh)

errs = rep.get("errors", [])
print(f"\ntotal failing requests: {len(errs)}")
for e in errs:
    print(" ", e)

print("\ncapture-path calls:")
for r in rep.get("requests", []):
    print(" ", r)

print("\nform probes:", json.dumps(rep.get("form", {}), indent=2))
print("submit:", json.dumps(rep.get("submit", {}), indent=2))
