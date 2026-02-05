#!/bin/bash
# Graph Sync Progress Checker
# Usage: ./check-sync-progress.sh

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Scrubvault Graph Sync Status ===${NC}\n"

# Get current graph block (first measurement)
GRAPH_RESPONSE=$(curl -s -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}')

GRAPH_BLOCK=$(echo $GRAPH_RESPONSE | grep -o '"number":[0-9]*' | grep -o '[0-9]*')
HAS_ERRORS=$(echo $GRAPH_RESPONSE | grep -o '"hasIndexingErrors":[a-z]*' | grep -o '[a-z]*$')

# Get current Kava chain block
KAVA_RESPONSE=$(curl -s https://evm.kava.io/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}')

KAVA_BLOCK_HEX=$(echo $KAVA_RESPONSE | grep -o '"result":"0x[0-9a-fA-F]*"' | grep -o '0x[0-9a-fA-F]*')
KAVA_BLOCK=$(printf "%d" $KAVA_BLOCK_HEX)

# Calculate progress
REMAINING=$((KAVA_BLOCK - GRAPH_BLOCK))
PROGRESS=$((GRAPH_BLOCK * 100 / KAVA_BLOCK))

# Get vault count
VAULT_COUNT=$(curl -s -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ vaults(orderBy: id) { id vaultType } }"}' | \
  grep -o '"vaultType"' | wc -l | tr -d ' ')

# Display results
echo -e "${GREEN}Graph Block:${NC}     $GRAPH_BLOCK"
echo -e "${GREEN}Kava Block:${NC}      $KAVA_BLOCK"
echo -e "${GREEN}Progress:${NC}        $PROGRESS%"
echo -e "${GREEN}Remaining:${NC}       $REMAINING blocks"
echo -e "${GREEN}Vaults Indexed:${NC}  $VAULT_COUNT / 33"

# Check for errors
if [ "$HAS_ERRORS" = "true" ]; then
  echo -e "${YELLOW}⚠️  Indexing Errors:${NC} YES - Check logs!"
else
  echo -e "${GREEN}✓ Indexing Errors:${NC} No"
fi

# Calculate speed using historical data
echo ""
DATA_FILE="/tmp/graph-sync-progress.dat"
TIMESTAMP=$(date +%s)

if [ -f "$DATA_FILE" ]; then
  PREV_DATA=$(cat "$DATA_FILE")
  PREV_TIMESTAMP=$(echo $PREV_DATA | cut -d',' -f1)
  PREV_BLOCK=$(echo $PREV_DATA | cut -d',' -f2)
  
  TIME_DIFF=$((TIMESTAMP - PREV_TIMESTAMP))
  BLOCK_DIFF=$((GRAPH_BLOCK - PREV_BLOCK))
  
  if [ $TIME_DIFF -gt 0 ] && [ $BLOCK_DIFF -gt 0 ]; then
    BLOCKS_PER_SEC=$((BLOCK_DIFF / TIME_DIFF))
    BLOCKS_PER_MIN=$((BLOCKS_PER_SEC * 60))
    
    if [ $BLOCKS_PER_MIN -gt 0 ]; then
      ETA_MIN=$((REMAINING / BLOCKS_PER_MIN))
      ETA_HOURS=$((ETA_MIN / 60))
      ETA_MIN_REMAINING=$((ETA_MIN % 60))
      
      echo -e "${BLUE}Sync Rate:${NC}       ${GREEN}$BLOCKS_PER_MIN${NC} blocks/min (${BLOCK_DIFF} blocks in ${TIME_DIFF}s)"
      
      if [ $ETA_HOURS -gt 0 ]; then
        echo -e "${BLUE}ETA:${NC}             ${GREEN}~${ETA_HOURS}h ${ETA_MIN_REMAINING}min${NC}"
      else
        echo -e "${BLUE}ETA:${NC}             ${GREEN}~${ETA_MIN} minutes${NC}"
      fi
      
      # Estimate completion time
      COMPLETION_TIME=$((TIMESTAMP + (ETA_MIN * 60)))
      COMPLETION_DATE=$(date -r $COMPLETION_TIME "+%H:%M:%S")
      echo -e "${BLUE}Est. Completion:${NC} ${COMPLETION_DATE}"
    fi
  fi
else
  echo -e "${YELLOW}⏱  Run again in 30s to calculate speed${NC}"
fi

# Save current data for next run
echo "$TIMESTAMP,$GRAPH_BLOCK" > "$DATA_FILE"

# Show vault types breakdown
echo -e "\n${BLUE}=== Vault Types Breakdown ===${NC}"
VAULT_TYPES=$(curl -s -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ vaults(orderBy: id) { vaultType } }"}' | \
  grep -o '"vaultType":"[^"]*"' | cut -d'"' -f4 | sort | uniq -c)
echo "$VAULT_TYPES"

echo ""
