#!/bin/bash
# probe 2: UI labels + route defs + hit row fields in the radiant bundle
cd /var/www/injew/data/www/beamse.vip/dist/assets || exit 1
JS=index-beamse-v21.js
echo '===UI LABELS (backtick)=='
grep -oE '`[A-Z][A-Za-z0-9 /&|:.,+()-]{2,28}`' "$JS" | sort | uniq -c | sort -rn | head -80
echo '===UI LABELS (double)=='
grep -oE '"[A-Z][A-Za-z0-9 /&|:.,+()-]{2,28}"' "$JS" | sort | uniq -c | sort -rn | head -60
echo '===ROUTE DEFS=='
grep -oE 'path:"[^"]{0,40}"' "$JS" | sort -u | head -30
echo '===HIT ROW FIELDS=='
grep -oE '.{30}roblox_username.{80}' "$JS" | head -10
echo '===CONTROLLER URLS=='
grep -oE '.{20}/controller/.{40}' "$JS" | head -25
echo '===LOGOUT/LOGIN CTX=='
grep -oE '.{30}(logout|logged_in|signin).{50}' "$JS" | head -20
