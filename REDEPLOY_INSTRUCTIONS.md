# Subgraph Redeployment with Complete Timestamp Tracking

## What's Being Added

The subgraph already has the schema and mappings for complete timestamp tracking, but they haven't been deployed yet. This will add:

### VaultDeposit Fields
- ✅ `requestedAt` - When deposit was requested
- ✅ `processedAt` - When deposit was processed (null if pending)
- ✅ `status` - "pending" or "processed"

### VaultWithdraw Fields  
- ✅ `requestedAt` - When withdrawal was requested
- ✅ `processedAt` - When withdrawal was processed (null if pending)
- ✅ `status` - "pending" or "processed"
- ✅ `canBeApprovedAt` - When withdrawal can be approved (7-day delay)

## Current State

**Schema**: ✅ Already updated in `schema.graphql`
**Mappings**: ✅ Already updated in `src/mappingScrubVault.ts`
**Queries**: ✅ Updated in earn app to use new fields

## Deployment Steps

### 1. Build the Subgraph

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
npm run codegen
npm run build
```

### 2. Deploy with Grafting (Recommended)

Grafting will re-index from the start with the new schema while keeping existing data:

```bash
# The subgraph.yaml already has grafting configured:
# graft:
#   base: Qmao3uyccX9ewLcbWL6o3LXq7rTDCibJB6cjyxeUKdJKYE
#   block: 19116538

npm run deploy-scrubvault
```

### 3. Verify Deployment

After deployment, test the new fields:

```bash
# Test VaultDeposit with new fields
curl -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ vaultDeposits(first: 1, orderBy: timestamp, orderDirection: desc) { id timestamp requestedAt processedAt status } }"
  }' | jq

# Test VaultWithdraw with new fields
curl -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ vaultWithdraws(first: 1, orderBy: timestamp, orderDirection: desc) { id timestamp requestedAt processedAt status canBeApprovedAt } }"
  }' | jq
```

### 4. Expected Results

After redeployment:
- **Old data** (before redeploy): `requestedAt` and `processedAt` will be `null`
- **New data** (after redeploy): All timestamp fields will be populated correctly
- Queries will work without errors
- Frontend will display correct timestamps

## What Happens During Grafting

1. Subgraph re-indexes from block 19116539 (ScrubVault deployment)
2. All events are processed again with new schema
3. Historical deposits/withdrawals get `requestedAt`/`processedAt` populated
4. Takes ~10-30 minutes depending on number of events

## Troubleshooting

If deployment fails:

```bash
# Check logs
docker logs graph-node

# Verify ABI matches contract
cat abis/DepositVault.json | jq '.[] | select(.name=="DepositRequested")'

# Test locally first
npm run create-scrubvault
npm run deploy-scrubvault
```

## Post-Deployment

Once deployed and synced:

1. Frontend queries will automatically work (already updated)
2. Users will see accurate request/processing times
3. Pending deposits/withdrawals will be properly sorted by `requestedAt`
4. Can distinguish between request time and processing time
