#!/bin/bash
# Debug RPC connectivity
echo "Testing Kava RPC endpoints..."

echo -e "\n1. Testing Nodies RPC:"
curl -s --max-time 5 "https://lb.nodies.app/v2/kava?apikey=82326d6c-74c4-4e98-9479-d2bdc8a7be38" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://scrub.money" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
echo ""

echo -e "2. Testing evm.kava.io:"
curl -s --max-time 5 "https://evm.kava.io" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
echo ""

echo -e "3. Testing kava-evm.publicnode.com:"
curl -s --max-time 5 "https://kava-evm.publicnode.com" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
echo ""

echo -e "4. Testing graph endpoint:"
curl -s --max-time 5 -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
echo ""
