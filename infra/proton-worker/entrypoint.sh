#!/bin/sh
set -eu
remaining=30
while [ ! -s /run/vp/wg0.conf ] && [ "$remaining" -gt 0 ]; do sleep 1; remaining=$((remaining-1)); done
[ -s /run/vp/wg0.conf ] || { echo "WireGuard config not provided" >&2; exit 20; }
chmod 600 /run/vp/wg0.conf
gateway="$(ip route show default | awk 'NR==1 {print $3}')"
wg-quick up /run/vp/wg0.conf
endpoint="$(wg show wg0 endpoints | awk 'NR==1 {print $2}' | sed 's/:.*//')"
[ -n "$gateway" ] && [ -n "$endpoint" ]
ip route replace "$endpoint/32" via "$gateway" dev eth0
ip route replace default dev wg0
cat >/tmp/tinyproxy.conf <<'EOF'
User nobody
Group nogroup
Port 8888
Listen 0.0.0.0
Timeout 600
Allow 0.0.0.0/0
LogLevel Info
MaxClients 100
EOF
exec tinyproxy -d -c /tmp/tinyproxy.conf
