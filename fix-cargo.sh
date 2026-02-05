#!/bin/bash

echo "=== Fixing Graph Node Cargo Issue ==="
echo ""

echo "1. Current Cargo version (as graph-user):"
su - graph-user -c "cargo --version"

echo ""
echo "2. Current Rust version (as graph-user):"
su - graph-user -c "rustc --version"

echo ""
echo "3. Updating Rust and Cargo to latest (as graph-user)..."
su - graph-user -c "rustup update stable && rustup default stable"

echo ""
echo "4. New Cargo version (as graph-user):"
su - graph-user -c "cargo --version"

echo ""
echo "5. Rebuilding graph node (as graph-user)..."
su - graph-user -c "cd /home/graph-user/graph-node && cargo build --release"

echo ""
echo "6. Restarting subgraph service..."
systemctl restart subgraph.service

echo ""
echo "7. Checking service status..."
sleep 5
systemctl status subgraph.service --no-pager | head -30

echo ""
echo "8. Testing graph endpoint..."
sleep 5
curl -s -X POST http://localhost:8000/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}' | jq .
