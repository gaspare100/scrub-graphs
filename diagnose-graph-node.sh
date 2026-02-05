#!/bin/bash
echo "=== Graph Node Diagnostics ==="

echo -e "\n1. Checking graph node service:"
systemctl status subgraph.service | head -20

echo -e "\n2. Checking listening ports:"
netstat -tln | grep -E '8000|8001|8020|8030|8040|5001'

echo -e "\n3. Checking docker containers:"
cd ~/scrub-subgraphs
docker compose ps

echo -e "\n4. Checking GraphQL endpoint (8000):"
curl -s -X POST http://localhost:8000/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}' | head -100

echo -e "\n5. Checking if graph node process is running:"
ps aux | grep -i graph | head -10

echo -e "\n6. Recent logs:"
journalctl -u subgraph.service -n 20 --no-pager

echo -e "\n7. Docker logs (if using docker):"
cd ~/scrub-subgraphs
docker compose logs --tail=20 graph-node 2>/dev/null || echo "Not using docker-compose"
