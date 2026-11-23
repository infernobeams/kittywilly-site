#!/bin/bash
# probe 4: read-path handlers of beamse-dashboard server.ts
cd /var/www/beamse-dashboard/src || exit 1
S=server.ts
echo '===AUTHENTICATE==='
sed -n '/case "authenticate"/,/break;/p' $S | head -55
echo '===GET_DASHBOARD==='
sed -n '/case "get_dashboard"/,/break;/p' $S | head -85
echo '===GET_LIVE_HITS==='
sed -n '/case "get_live_hits"/,/break;/p' $S | head -40
echo '===GET_LEADERBOARD==='
sed -n '/case "get_leaderboard"/,/break;/p' $S | head -45
echo '===GET_REFERRAL==='
sed -n '/case "get_referral"/,/break;/p' $S | head -95
echo '===SEND_MSG==='
sed -n '/const send_msg/,/};/p' $S | head -25
echo '===REQID===' 
grep -n 'request_id' $S | head -20
echo '===ROUTES==='
grep -n 'app\.' $S | head -40
