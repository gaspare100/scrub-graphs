#!/bin/bash
# Clean up failed/old subgraph deployments to free resources
# Usage: ./cleanup-failed-subgraphs.sh (no sudo needed)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Subgraph Cleanup Utility ===${NC}\n"

# Check resource usage before
echo -e "${YELLOW}Current resource usage:${NC}"
free -h | grep -E 'Mem:|Swap:'
echo ""

# Check if graph node is accessible
echo -e "${YELLOW}Testing graph node connection...${NC}"
response=$(curl -s -X POST http://localhost:8020/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"subgraph_list","params":[],"id":1}')

echo "Response: $response"
echo ""

if [ -z "$response" ]; then
  echo -e "${RED}Failed to connect to graph node. Is it running?${NC}"
  exit 1
fi

# Define failed/old subgraphs to remove
# These are the ones with crashed writers
echo -e "${YELLOW}Failed subgraphs to remove:${NC}"
echo "  QmbMpbACXNGPwzGvRVHLdKRmqkP9rr3rp1VJpVaENJUuri (sgd103 - stuck)"
echo "  QmZ2tkmb1wwPLbzPiBd6wVgokMpwZau1ywkczsEWQ7ygM7 (sgd115 - stuck)"
echo ""

# Use graph CLI to remove them
cd ~/scrub-subgraphs

echo -e "${RED}Removing QmbMpbACXNGPwzGvRVHLdKRmqkP9rr3rp1VJpVaENJUuri...${NC}"
graph remove --node http://localhost:8020/ QmbMpbACXNGPwzGvRVHLdKRmqkP9rr3rp1VJpVaENJUuri 2>&1
echo ""

echo -e "${RED}Removing QmZ2tkmb1wwPLbzPiBd6wVgokMpwZau1ywkczsEWQ7ygM7...${NC}"
graph remove --node http://localhost:8020/ QmZ2tkmb1wwPLbzPiBd6wVgokMpwZau1ywkczsEWQ7ygM7 2>&1
echo ""

# Show resource usage after
echo -e "\n${YELLOW}Resource usage after cleanup:${NC}"
free -h | grep -E 'Mem:|Swap:'

echo -e "\n${GREEN}Cleanup complete!${NC}"
echo -e "${YELLOW}Consider restarting graph node if memory is still high:${NC}"
echo "  sudo systemctl restart subgraph.service"
