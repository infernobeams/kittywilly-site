#!/bin/bash
# probe 3: what HTTP endpoints the SPA uses + the PHP create/settings endpoints
cd /var/www/injew/data/www/beamse.vip || exit 1
echo '===BUNDLE API URLS==='
grep -oE '/(control/api|api)/[A-Za-z0-9_/.-]*' dist/assets/index-beamse-v21.js | sort | uniq -c | sort -rn | head -40
echo '===BUNDLE URL TEMPLATES==='
grep -oE '`/[A-Za-z][^`]{0,60}`' dist/assets/index-beamse-v21.js | sort -u | head -40
echo '===PHP ENDPOINT SIZES==='
wc -l control/api/create/*.php control/api/settings/*.php control/api/stats.php control/api/dashboard.php control/api/allData.php 2>/dev/null
echo '===profileAvatar.php===' 
head -70 control/api/create/profileAvatar.php 2>/dev/null
echo '===groupData.php==='
head -50 control/api/create/groupData.php 2>/dev/null
echo '===gameData.php==='
head -50 control/api/create/gameData.php 2>/dev/null
echo '===settingsData.php==='
head -60 control/api/settings/settingsData.php 2>/dev/null
