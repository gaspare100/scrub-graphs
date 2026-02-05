#!/bin/bash

echo "=== Checking Graph Node Status ==="
echo ""

echo "1. Checking docker containers..."
docker ps -a | grep -E "graph|postgres|ipfs" || echo "No graph-related containers found"

echo ""
echo "2. Checking docker-compose.yml location..."
ls -la docker-compose.yml 2>/dev/null || echo "docker-compose.yml not found in current directory"

echo ""
echo "3. Starting graph node with docker-compose..."
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    echo ""
    echo "Waiting 10 seconds for services to start..."
    sleep 10
    echo ""
    echo "4. Checking running containers..."
    docker ps | grep -E "graph|postgres|ipfs"
    echo ""
    echo "5. Testing graph node endpoint..."
    sleep 5
    curl -s -X POST http://localhost:8000/subgraphs/name/scrubvault-test \
      -H "Content-Type: application/json" \
      -d '{"query": "{ _meta { block { number } } }"}' | jq .
else
    echo "Error: docker-compose.yml not found. Please run from scrub-subgraphs directory"
    exit 1
fi
