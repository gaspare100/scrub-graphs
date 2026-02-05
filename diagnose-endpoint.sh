#!/bin/bash
echo "=== Graph Endpoint Diagnostics ==="

echo -e "\n1. Testing local GraphQL endpoint (port 8000):"
curl -s http://localhost:8000/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'

echo -e "\n\n2. Testing via public URL:"
curl -s https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'

echo -e "\n\n3. Checking if graph-node is listening on 8000:"
netstat -tln | grep :8000

echo -e "\n4. Checking nginx/proxy status:"
systemctl status nginx 2>/dev/null || systemctl status apache2 2>/dev/null || echo "No nginx/apache2 found"

echo -e "\n5. Recent graph-node logs:"
journalctl -u subgraph.service -n 20 --no-pager | grep -E "8000|Listening|Started"

echo -e "\n6. Checking for other deployments:"
curl -s http://localhost:8000/subgraphs/name/scrubvault \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
