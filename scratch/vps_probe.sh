#!/bin/bash
# probe how the radiant bundle talks to the beamse-dashboard backend
cd /var/www/injew/data/www/beamse.vip/dist/assets || exit 1
JS=index-beamse-v21.js
echo '===LATEST FILES==='
ls -la | tail -30
echo '===WS URLS==='
grep -oE 'wss?://[^"`]+' $JS | sort -u | head -20
echo '===URL PATH STRINGS==='
grep -oE '"/[a-z][a-z0-9_/.-]*"' $JS | sort | uniq -c | sort -rn | head -40
echo '===PATHNAME CTX==='
grep -oE '.{24}pathname.{70}' $JS | head -15
echo '===TOKEN CTX==='
grep -oE '.{40}(recovery_token|Authentication).{56}' $JS | head -15
echo '===AUTH CHECK CTX==='
grep -oE '.{40}auth/check.{50}' $JS | head -10
echo '===COOKIE CTX==='
grep -oE '.{32}document\.cookie.{64}' $JS | head -10
echo '===WS CTX==='
grep -oE '.{12}(new WebSocket|WebSocket\()[^;]{0,100}' $JS | head -10
echo '===MSG TYPES==='
for t in authenticate get_dashboard get_live_hits get_leaderboard get_chat send_chat_message get_referral save_referral get_recovery_token recovery_login get_triplehook_directory get_signin_stats save_settings save_profile save_group generate_hyperlink new_live_hit stats_update; do
  n=$(grep -o "$t" $JS | wc -l)
  echo "$t: $n"
done
echo '===NAV LABELS==='
grep -oE '(Dashboard|Leaderboard|Chat|Settings|Create|Directory|Referral|Overview|Profile|Group|Insights|Hits|Visits)' $JS | sort | uniq -c | sort -rn | head -25
echo '===WS SEND CTX==='
grep -oE '.{20}\{type:"[a-z_]+".{50}' $JS | head -25
