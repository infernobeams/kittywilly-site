@echo off
setlocal

echo ---- Deploying kittywilly-site to Vercel ----
cd /d "%~dp0"

REM Refresh the lockfile when dependencies change.
call npm install --package-lock-only --ignore-scripts
if errorlevel 1 exit /b 1

REM Commit app changes (nothing here rewrites the entry point).
git add -A
git commit -m "Deploy kittywilly site"
git push origin main

vercel --prod --yes
if errorlevel 1 exit /b 1

echo.
echo Live at https://kittywilly-site.vercel.app
echo.
pause
endlocal
