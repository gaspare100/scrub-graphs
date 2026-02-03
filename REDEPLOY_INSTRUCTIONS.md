# Subgraph Redeployment - Force Withdrawal Fix

**Date**: February 3, 2026  
**Issue**: Force-processed withdrawals showing as pending with wrong amounts  
**Fix**: Update timestamp field when deposits/withdrawals are processed

## Changes Made

### 1. Withdrawal Processing (`handleWithdrawalProcessed`)
- ✅ Now updates `timestamp` field when withdrawal is processed
- ✅ Ensures transaction history shows correct processing time
- ✅ Displays correct amounts (after fees) in UI

### 2. Deposit Processing (`handleDepositProcessed`)  
- ✅ Also updates `timestamp` field when deposit is processed
- ✅ Proactive fix to prevent same issue with deposits
- ✅ Maintains consistency across both transaction types

## Deployment Steps

### Step 1: Navigate to Subgraph Directory

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
```

### Step 2: Build Subgraph

```bash
# Generate TypeScript types from schema
pnpm run codegen

# Compile AssemblyScript to WASM
pnpm run build
```

**Expected output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
  Compile data source: ScrubDepositVault => build/ScrubDepositVault/ScrubDepositVault.wasm
✔ Compile subgraph
  Copy schema file build/schema.graphql
  Write subgraph file build/subgraph.yaml
  Write subgraph manifest build/subgraph.yaml
✔ Write compiled subgraph to build/

Build completed: build/subgraph.yaml
```

### Step 3: Deploy to The Graph

```bash
pnpm run deploy
```

**What happens:**
1. Uploads new mapping code to The Graph
2. Triggers re-indexing of all historical events
3. Updates all processed deposits/withdrawals with correct timestamps

**Expected time:** 5-10 minutes for complete re-indexing

### Step 4: Monitor Deployment

Watch the deployment progress at:
https://thegraph.com/studio/subgraph/scrubvault

**Check for:**
- ✅ Syncing status: "Synced"
- ✅ Index health: "Healthy"
- ✅ Latest block indexed matches current chain height

### Step 5: Verify Fix

Query the specific force-processed withdrawal:

```bash
curl -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ vaultWithdraws(where: { id: \"0x7bff6c730da681df03364c955b165576186370bc-0\" }) { id user status shares amount fee requestedAt processedAt timestamp canBeApprovedAt } }"
  }'
```

**Expected response:**
```json
{
  "data": {
    "vaultWithdraws": [{
      "id": "0x7bff6c730da681df03364c955b165576186370bc-0",
      "user": "0xd47d2f1543cdae1284f20705a32b1362422cb652",
      "status": "processed",
      "shares": "18000000000000000000",
      "amount": "17060000",
      "fee": "1000000",
      "requestedAt": "1738428893",
      "processedAt": "1738512906",
      "timestamp": "1738512906",  // ✅ Should match processedAt
      "canBeApprovedAt": "1739033693"
    }]
  }
}
```

### Step 6: Test in UI

**Admin UI** (scrubvault-l7vkv.ondigitalocean.app/vault-management):

1. Go to "All Withdrawals" section
2. Find withdrawal ID `0` for user `0xd47d...b652`
3. Verify:
   - ✅ Status badge is green (processed)
   - ✅ Amount shows $17.06 (not $18.00)
   - ✅ Fee shows $1.00
   - ✅ Timestamp shows Feb 2, 2026 15:15 (processing time, not Jan 31)

**Earn UI** (earn/scrubvault/0x7BFf6c730dA681dF03364c955B165576186370Bc):

1. Connect wallet as `0xd47d...b652`
2. View transaction history
3. Verify withdrawal shows:
   - ✅ Green "✓ Completed" badge
   - ✅ Completed timestamp: Feb 2, 2026
   - ✅ Amount: $17.06
   - ✅ Fee: $1.00

## Post-Deployment Checks

See detailed verification queries in FORCE_WITHDRAWAL_FIX.md

## Files Changed

1. `src/mappingScrubVault.ts`
   - Line 210: Added `deposit.timestamp = event.params.timestamp;`
   - Line 306: Added `withdrawal.timestamp = event.params.timestamp;`

2. `../scrubvault/apps/api/src/modules/vault/vault.service.ts`
   - Line 527: Changed query to `orderBy: requestedAt`
   - Line 537: Added `processedAt` field

## Testing Checklist

- [ ] Subgraph builds without errors
- [ ] Deployment completes successfully  
- [ ] Subgraph shows "Synced" status
- [ ] Force-processed withdrawal shows correct data
- [ ] Admin UI shows correct amounts/timestamps
- [ ] Earn UI shows correct amounts/timestamps

See FORCE_WITHDRAWAL_FIX.md for complete details.

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
