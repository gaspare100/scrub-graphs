#!/bin/bash

echo "🔍 Monitoring grafting progress..."
echo "Press Ctrl+C to stop"
echo ""

SUBGRAPH_URL="https://subgraph.scrub.money/subgraphs/name/scrubvault"
INTERVAL=10

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Try to query the subgraph
    RESPONSE=$(curl -s -X POST "$SUBGRAPH_URL" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ _meta { block { number } hasIndexingErrors } }"}')
    
    # Check if we got an error about not syncing yet
    if echo "$RESPONSE" | grep -q "has not started syncing yet"; then
        echo "[$TIMESTAMP] ⏳ Still grafting... (copying data from base subgraph)"
    # Check if we got block data
    elif echo "$RESPONSE" | grep -q '"number"'; then
        BLOCK=$(echo "$RESPONSE" | grep -o '"number":[0-9]*' | grep -o '[0-9]*')
        HAS_ERRORS=$(echo "$RESPONSE" | grep -o '"hasIndexingErrors":[a-z]*' | grep -o '[a-z]*$')
        
        echo "[$TIMESTAMP] ✅ Grafting complete! Syncing at block: $BLOCK"
        echo "[$TIMESTAMP] 🔍 Indexing errors: $HAS_ERRORS"
        
        # Try to get vault count
        VAULT_RESPONSE=$(curl -s -X POST "$SUBGRAPH_URL" \
            -H "Content-Type: application/json" \
            -d '{"query":"{ vaults(first: 1) { id } }"}')
        
        VAULT_COUNT=$(echo "$VAULT_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
        
        if [ "$VAULT_COUNT" -gt 0 ]; then
            echo "[$TIMESTAMP] 📊 Vaults indexed: $VAULT_COUNT+"
        fi
        
        echo ""
        echo "✨ Grafting successful! Subgraph is now live."
        break
    # Other errors
    else
        echo "[$TIMESTAMP] ❌ Unexpected response:"
        echo "$RESPONSE" | head -c 200
        echo ""
    fi
    
    sleep $INTERVAL
done
