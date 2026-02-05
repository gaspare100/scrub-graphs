#!/bin/bash

echo "=== Fixing Graph Node Cargo Issue ==="
echo ""

echo "1. Current Cargo version:"
cargo --version

echo ""
echo "2. Current Rust version:"
rustc --version

echo ""
echo "3. Updating Rust and Cargo to latest..."
rustup update stable
rustup default stable

echo ""
echo "4. New Cargo version:"
cargo --version

echo ""
echo "5. Rebuilding graph node..."
cd /home/graph-user/graph-node || exit 1
cargo build --release

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
