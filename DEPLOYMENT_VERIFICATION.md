# Subgraph Deployment Verification

## Pre-Deployment Checklist

✅ Contracts deployed to Kava:
- ScrubPoint: `0x7A48cD5f0AF2232f08066101b04E5fDd1F1aC435` (block 19209042)
- ScrubVaultCave: `0x4C6537DF1e633F75b054e3Fb094f99a66b37A103` (block 19209044)

✅ ABIs updated in scrub-graphs/abis/:
- ScrubPoint.json
- ScrubVaultCave.json

✅ subgraph.yaml updated with contract addresses and start blocks

✅ Codegen completed successfully (npm run codegen)

## Deployment Command

```bash
cd ~/scrub-subgraphs/ && git checkout . && git pull && npm run deploy-graft-test-prod 19087542
```

## Post-Deployment Verification

### 1. Check Indexing Status
```bash
curl https://subgraph.scrub.money/subgraphs/name/scrubvault-test/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ _meta { block { number } } }"}'
```

### 2. Verify ScrubPoint Events Indexed
```bash
curl https://subgraph.scrub.money/subgraphs/name/scrubvault-test/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ scrubPointStats(id: \"singleton\") { totalSupply totalHolders totalMints totalTransfers } }"}'
```

### 3. Verify Cave Events Indexed
```bash
curl https://subgraph.scrub.money/subgraphs/name/scrubvault-test/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ caveStats(id: \"singleton\") { totalShares totalDeposits currentPrice uniqueDepositors } }"}'
```

### 4. Check for Errors in Graph Node Logs
```bash
# On server
docker logs graph-node --tail 100 -f | grep -i error
docker logs graph-node --tail 100 -f | grep scrubvault-test
```

## Expected Results

After deployment and syncing to current block (~19209050):
- `scrubPointStats` should exist (even if no mints yet)
- `caveStats` should exist (even if no deposits yet)
- No indexing errors in logs
- Block number should be close to current Kava block

## Common Issues

### Issue: Subgraph fails to index
**Solution**: Check event signatures in ABIs match contract events exactly

### Issue: Entities not created
**Solution**: Verify contract addresses and start blocks are correct

### Issue: Missing data
**Solution**: Check if transactions have been sent to contracts; if not, entities will be empty

## Next Steps After Successful Deployment

1. Test minting ScrubPoints from backend
2. Test Cave deposits/withdrawals
3. Verify subgraph tracks all events
4. Update frontend to use subgraph endpoint
5. Promote to production subgraph when stable
