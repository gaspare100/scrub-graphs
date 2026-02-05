#!/bin/bash

echo "=== Querying Graph Node ==="
echo ""

echo "1. Testing localhost:8000 (direct to graph node)..."
curl -s -X POST http://localhost:8000/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number hash timestamp } hasIndexingErrors } }"}' | jq . || echo "Failed to connect to localhost:8000"

echo ""
echo "2. Testing public endpoint (https://subgraph.scrub.money)..."
curl -s -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number hash timestamp } hasIndexingErrors } }"}' | jq . || echo "Failed to connect to public endpoint"

echo ""
echo "3. Checking graph-node service status..."
systemctl status graph-node --no-pager | head -20

echo ""
echo "4. Checking graph-node process..."
ps aux | grep -E "graph-node|8000" | grep -v grep

echo ""
echo "5. Checking which service is on port 8000..."
sudo netstat -tlnp | grep 8000 || lsof -i :8000

echo ""
echo "6. Checking nginx/haproxy status..."
systemctl status nginx --no-pager 2>/dev/null | head -10 || echo "nginx not found"
systemctl status haproxy --no-pager 2>/dev/null | head -10 || echo "haproxy not found"
