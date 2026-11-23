@echo off
rem close whatever is holding :8000 and :8100
powershell -NoProfile -Command "foreach($p in 8000,8100){ Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { try{ Stop-Process -Id $_ -Force; Write-Host ('closed :' + $p) }catch{} } }"
