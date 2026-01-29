# Timestamp Tracking Feature - Deployment Guide

## Overview
This update adds proper tracking of request and processing timestamps for both deposits and withdrawals in the ScrubVault subgraph.

## Changes Made

### Schema Changes (`schema.graphql`)

#### VaultDeposit Entity
```graphql
type VaultDeposit @entity {
  # ... existing fields ...
  requestedAt: BigInt      # NEW: When deposit was requested
  processedAt: BigInt      # NEW: When deposit was processed (null if pending)
}
```

#### VaultWithdraw Entity
```graphql
type VaultWithdraw @entity {
  # ... existing fields ...
  processedAt: BigInt      # NEW: When withdrawal was processed (null if pending)
}
```

### Mapping Changes (`mappingScrubVault.ts`)

1. **handleDepositRequested**: Sets `requestedAt` when deposit is created
2. **handleDepositProcessed**: Sets `processedAt` when deposit is processed
3. **handleWithdrawalProcessed**: Sets `processedAt` when withdrawal is processed

### Frontend Changes (`earn` repo)

1. **GraphQL Queries** (`scrubVaults.ts`):
   - Added `requestedAt` and `processedAt` to deposit queries
   - Added `processedAt` to withdrawal queries

2. **Data Hook** (`useScrubVaultDetails.ts`):
   - Uses `requestedAt` and `processedAt` fields from GraphQL
   - Fallback to `timestamp` for backward compatibility

3. **UI** (`ScrubVaultDetailRestructured.tsx`):
   - Shows "Requested" timestamp for all transactions
   - Shows "Processed" timestamp when available
   - Displays processing duration (⏱️ Processed in X minutes)

## Deployment Steps

### 1. Deploy Subgraph (scrub-graphs)

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs

# Already done:
# npm run codegen  ✓
# npm run build    ✓

# Deploy to The Graph hosted service
npm run deploy

# Or deploy to specific network
graph deploy --product hosted-service <GITHUB_USERNAME>/scrubvault
```

### 2. Wait for Sync
- The subgraph will need to re-index all historical events
- New fields (`requestedAt`, `processedAt`) will be populated from blockchain events
- Monitor deployment at: https://thegraph.com/hosted-service/subgraph/<YOUR_SUBGRAPH>

### 3. Verify Subgraph Data

Test query to verify new fields:
```graphql
{
  vaultDeposits(first: 5, orderBy: timestamp, orderDirection: desc) {
    id
    amount
    status
    timestamp
    requestedAt
    processedAt
  }
  vaultWithdraws(first: 5, orderBy: timestamp, orderDirection: desc) {
    id
    amount
    status
    timestamp
    requestedAt
    processedAt
  }
}
```

### 4. Deploy Frontend (earn)

```bash
cd /Users/gasparemarchese/scrub/earn

# Test locally first
npm run dev

# Test that transactions show correct timestamps:
# - Navigate to /vault/[address]
# - Check transaction history
# - Verify "Requested" and "Processed" timestamps are different
# - Verify processing duration is shown

# Build for production
npm run build

# Deploy to production (e.g., Vercel)
vercel deploy --prod
```

## Expected Results

### Before Deployment
```
Deposit #123
Requested: Jan 28, 2026, 03:51 PM
Processed: Jan 28, 2026, 03:51 PM  ❌ Same time (incorrect)
```

### After Deployment
```
Deposit #123
Requested: Jan 28, 2026, 02:30 PM  ✓ When user requested
Processed: Jan 28, 2026, 03:51 PM  ✓ When system processed
⏱️ Processed in 81 minutes         ✓ Duration shown
```

### Pending Transactions
```
Deposit #456 (Pending)
Requested: Jan 29, 2026, 10:00 AM  ✓ Shows request time
Expected: Soon!                     ✓ No processed time yet
```

## Rollback Plan

If issues occur after deployment:

### Subgraph Rollback
```bash
# Redeploy previous version
cd /Users/gasparemarchese/scrub/scrub-graphs
git revert 9b8bf63
npm run codegen
npm run build
npm run deploy
```

### Frontend Rollback
```bash
# Revert frontend changes
cd /Users/gasparemarchese/scrub/earn
git revert 18cabde
npm run build
vercel deploy --prod
```

## Backward Compatibility

- ✅ Old data will work: Frontend falls back to `timestamp` if new fields are null
- ✅ Old frontend will work: Subgraph still provides `timestamp` field
- ✅ Gradual migration: New events will populate new fields immediately

## Testing Checklist

- [ ] Subgraph deployed and syncing
- [ ] New fields appear in GraphQL queries
- [ ] Processed deposits show different request/processed times
- [ ] Pending deposits show only request time
- [ ] Processed withdrawals show different request/processed times  
- [ ] Pending withdrawals show only request time
- [ ] Processing duration displays correctly (in minutes)
- [ ] No TypeScript errors in frontend
- [ ] Build succeeds
- [ ] UI displays correctly in production

## Commits

- **scrub-graphs**: `9b8bf63` - feat: Track separate request and processing timestamps
- **earn**: `18cabde` - feat: Update frontend to use separate request and processing timestamps

## Next Steps

After successful deployment:
1. Monitor user feedback on timestamp accuracy
2. Consider adding more time-based analytics:
   - Average processing time by time of day
   - Processing time trends
   - Alert if processing takes unusually long
3. Apply similar timestamp tracking to other entities (rewards, etc.)
