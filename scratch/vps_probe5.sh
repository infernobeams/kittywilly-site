#!/bin/bash
# probe 5: write-path handlers of beamse-dashboard server.ts
cd /var/www/beamse-dashboard/src || exit 1
S=server.ts
echo '===SAVE_REFERRAL==='
sed -n '/case "save_referral"/,/break;/p' $S | head -95
echo '===SAVE_SETTINGS==='
sed -n '/case "save_settings"/,/break;/p' $S | head -85
echo '===SAVE_PROFILE==='
sed -n '/case "save_profile"/,/break;/p' $S | head -60
echo '===SAVE_GROUP==='
sed -n '/case "save_group"/,/break;/p' $S | head -60
echo '===GET_RECOVERY_TOKEN==='
sed -n '/case "get_recovery_token"/,/break;/p' $S | head -25
echo '===RECOVERY_LOGIN==='
sed -n '/case "recovery_login"/,/break;/p' $S | head -40
