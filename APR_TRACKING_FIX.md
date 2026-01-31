# APR Tracking Fix

## Problem

The subgraph was incorrectly setting APR to 0 whenever a deposit or withdrawal occurred. This created misleading APR history charts with many zero values between actual reward events.

**Previous behavior:**
- `handleDepositProcessed`: Created VaultInfo with `apr = 0`
- `handleWithdrawalProcessed`: Created VaultInfo with `apr = 0`
- `handleRewardDistributed`: Created VaultInfo with calculated APR

This meant APR charts showed zeros for every deposit/withdrawal, making the data useless.

## Solution

Implemented **APR carry-forward** mechanism:

1. **Added `getLatestAPR()` function** that finds the most recent non-zero APR value
2. **Modified deposit/withdrawal handlers** to carry forward the last known APR instead of resetting to 0
3. **Only `handleRewardDistributed`** updates APR with newly calculated values

## Changes Made

### New Function: `getLatestAPR()`

```typescript
function getLatestAPR(vaultId: string): BigInt {
  // Searches backward through VaultInfo history
  // Returns the most recent non-zero APR
  // Returns 0 if no APR has been set yet
}
```

### Updated Event Handlers

**`handleDepositProcessed()`:**
```typescript
// Before:
info.apr = BigInt.fromI32(0);

// After:
info.apr = getLatestAPR(vault.id); // Carry forward last known APR
```

**`handleWithdrawalProcessed()`:**
```typescript
// Before:
info.apr = BigInt.fromI32(0);

// After:
info.apr = getLatestAPR(vault.id); // Carry forward last known APR
```

**`handleRewardDistributed()`:**
- No changes
- Still calculates APR based on reward amount and time delta
- This is the only place where APR is actually updated

## How It Works

1. **Reward Distribution** → APR is calculated from actual reward data
2. **Deposits/Withdrawals** → APR is carried forward from last reward
3. **Charts** → Show consistent APR values between rewards instead of zeros

## APR Calculation (Unchanged)

APR is still calculated in `handleRewardDistributed()`:

```typescript
APR = (rewardAmount / TVL) * (secondsInYear / timeSinceLastReward) * 10000
```

Stored as basis points (e.g., 1234 = 12.34%)

## Benefits

✅ APR charts now show meaningful data  
✅ No false zero APR values  
✅ APR remains stable between reward distributions  
✅ Accurate historical APR tracking  

## Alternative Approaches Considered

1. **Track share price only** - Decided against because we already track `shareValue` in the vault entity
2. **Interpolation** - More complex and not necessary since APR should remain constant between rewards
3. **Don't create VaultInfo on deposits/withdrawals** - Would lose TVL tracking granularity

## Deployment

After deploying this fix:

1. Redeploy the subgraph
2. Historical data will still show old zero values
3. New events will use carry-forward APR
4. Consider reindexing from a recent block to fix historical data

## Testing

Verify the fix by:
1. Check APR chart after deposits - should not drop to zero
2. Check APR chart after withdrawals - should not drop to zero  
3. Check APR chart after rewards - should update to new calculated value
4. Query VaultInfo entities and verify APR consistency
