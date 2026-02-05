#!/bin/bash
echo "=== Checking Proxy Configuration ==="

echo -e "\n1. Looking for nginx config:"
find /etc/nginx -name "*subgraph*" -o -name "*scrub*" 2>/dev/null

echo -e "\n2. Checking nginx sites-enabled:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null

echo -e "\n3. Checking for haproxy:"
which haproxy
systemctl status haproxy 2>/dev/null | head -10

echo -e "\n4. Checking what's on port 80/443:"
netstat -tlnp | grep -E ':80 |:443 '

echo -e "\n5. Testing local port 8000 directly:"
curl -s -X POST http://localhost:8000/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}' | head -100

echo -e "\n6. Checking all graph-node ports:"
netstat -tlnp | grep -E '8000|8001|8020|8030|8040'

echo -e "\n7. Process listening on 8000:"
lsof -i :8000 2>/dev/null || fuser 8000/tcp 2>/dev/null
