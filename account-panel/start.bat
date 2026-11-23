@echo off
rem double-click to bring up both servers, then the panel
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo no venv found in this folder - run setup first
    pause
    exit /b 1
)

start "signup mock :8000" /min ".venv\Scripts\python.exe" signup_mock.py
start "panel :8100" /min ".venv\Scripts\python.exe" app.py

echo waiting for ports...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try{ $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8100/ -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } }catch{}; Start-Sleep -Milliseconds 250 }; if($ok){ exit 0 } else { exit 1 }"

if errorlevel 1 (
    echo panel did not answer on :8100 - check the two minimized windows for a traceback
    pause
    exit /b 1
)

start "" http://127.0.0.1:8100/
