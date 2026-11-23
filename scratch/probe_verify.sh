#!/bin/bash
echo '== index ver =='
curl -sk 'https://beamse.vip/controller/dashboard' | grep -o '__ARTERYX_VER__ = "v2"'
echo '== index asset refs =='
curl -sk 'https://beamse.vip/controller/dashboard' | grep -o 'assets/arteryx/dashboard[^"]*'
echo '== ws handshake (http1.1) =='
curl -sk -i -N -m 6 --http1.1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' 'https://beamse.vip/ws' | head -8
echo '== done =='
