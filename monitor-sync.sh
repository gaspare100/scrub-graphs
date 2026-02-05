#!/bin/bash
# Continuous Graph Sync Monitor
# Usage: ./monitor-sync.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kava RPC endpoints with fallbacks (same as scrubvault)
KAVA_RPCS=(
  "https://lb.nodies.app/v2/kava?apikey=82326d6c-74c4-4e98-9479-d2bdc8a7be38"
  "https://evm.kava.io"
  "https://kava-evm.publicnode.com"
)

echo -e "${BLUE}=== Continuous Graph Sync Monitor ===${NC}"
echo "Press Ctrl+C to stop"
echo ""

PREV_BLOCK=0
PREV_TIME=$(date +%s)
NO_PROGRESS_COUNT=0

# Function to get current Kava block with RPC fallback
get_kava_block() {
  for rpc in "${KAVA_RPCS[@]}"; do
    response=$(curl -s --max-time 10 "$rpc" \
      -X POST \
      -H "Content-Type: application/json" \
      -H "Origin: https://scrub.money" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}')
    
    block_hex=$(echo "$response" | grep -o '"result":"0x[0-9a-fA-F]*"' | grep -o '0x[0-9a-fA-F]*')
    
    if [ -n "$block_hex" ]; then
      printf "%d" "$block_hex" 2>/dev/null
      return 0
    fi
  done
  return 1
}

while true; do
  CURRENT_TIME=$(date +%s)
  
  # Get current graph block
  GRAPH_RESPONSE=$(curl -s --max-time 10 -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
    -H "Content-Type: application/json" \
    -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}')
  
  GRAPH_BLOCK=$(echo $GRAPH_RESPONSE | grep -o '"number":[0-9]*' | grep -o '[0-9]*')
  HAS_ERRORS=$(echo $GRAPH_RESPONSE | grep -o '"hasIndexingErrors":[a-z]*' | grep -o '[a-z]*$')
  
  # Get current Kava chain block using RPC fallback
  KAVA_BLOCK=$(get_kava_block)
  
  if [ -z "$GRAPH_BLOCK" ] || [ -z "$KAVA_BLOCK" ]; then
    echo -e "${RED}[$(date '+%H:%M:%S')] Failed to fetch block data${NC}"
    sleep 10
    continue
  fi
  
  # Calculate progress
  REMAINING=$((KAVA_BLOCK - GRAPH_BLOCK))
  PROGRESS=$((GRAPH_BLOCK * 100 / KAVA_BLOCK))
  
  # Calculate blocks processed since last check
  TIME_DIFF=$((CURRENT_TIME - PREV_TIME))
  BLOCK_DIFF=$((GRAPH_BLOCK - PREV_BLOCK))
  
  # Display status
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} Block: ${GREEN}$GRAPH_BLOCK${NC} / $KAVA_BLOCK | Progress: ${GREEN}$PROGRESS%${NC} | Remaining: $REMAINING"
  
  if [ $TIME_DIFF -gt 0 ] && [ $PREV_BLOCK -gt 0 ]; then
    BLOCKS_PER_MIN=$((BLOCK_DIFF * 60 / TIME_DIFF))
    
    if [ $BLOCKS_PER_MIN -gt 0 ]; then
      ETA_MIN=$((REMAINING / BLOCKS_PER_MIN))
      echo -e "  Rate: ${GREEN}$BLOCKS_PER_MIN${NC} blocks/min | ETA: ${GREEN}~$ETA_MIN${NC} minutes"
    else
      echo -e "  Rate: ${YELLOW}$BLOCKS_PER_MIN blocks/min${NC}"
    fi
    
    # Check if no progress in last minute
    if [ $BLOCK_DIFF -eq 0 ] && [ $TIME_DIFF -ge 60 ]; then
      NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
      echo -e "  ${YELLOW}⚠️  No progress detected for $NO_PROGRESS_COUNT check(s)${NC}"
      
      # Show errors after 1 minute of no progress
      if [ $NO_PROGRESS_COUNT -ge 1 ]; then
        echo -e "\n${RED}=== Errors in last 5 minutes ===${NC}"
        journalctl -u subgraph.service --since "5 minutes ago" --no-pager | grep -E "ERRO|WARN|fatal|panic" | tail -20
        echo ""
        
        # If no progress for 3+ checks, exit
        if [ $NO_PROGRESS_COUNT -ge 3 ]; then
          echo -e "${RED}No progress for 3+ minutes. Exiting.${NC}"
          echo "Check logs: journalctl -u subgraph.service -n 100"
          exit 1
        fi
      fi
    else
      NO_PROGRESS_COUNT=0
    fi
  fi
  
  # Check for indexing errors
  if [ "$HAS_ERRORS" = "true" ]; then
    echo -e "${RED}⚠️  INDEXING ERRORS DETECTED!${NC}"
    echo -e "\n${RED}=== Recent Errors ===${NC}"
    journalctl -u subgraph.service --since "5 minutes ago" --no-pager | grep "ERRO" | tail -20
    echo ""
    exit 1
  fi
  
  # Check if synced
  if [ $REMAINING -le 10 ]; then
    echo -e "\n${GREEN}✅ SYNC COMPLETE! Graph is up to date.${NC}"
    echo "Graph block: $GRAPH_BLOCK"
    echo "Chain block: $KAVA_BLOCK"
    exit 0
  fi
  
  # Update for next iteration
  PREV_BLOCK=$GRAPH_BLOCK
  PREV_TIME=$CURRENT_TIME
  
  # Wait before next check
  sleep 30
  echo ""
done
