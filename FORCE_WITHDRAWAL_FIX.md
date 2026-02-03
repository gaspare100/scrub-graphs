# Force Withdrawal Display Bug - Fixed

**Date**: February 3, 2026  
**Issue**: Force-processed withdrawals still show as "pending" with incorrect amounts and wrong colors

## Problem

When a withdrawal was force-processed using `forceApproveWithdrawals()`, the transaction completed successfully on-chain, but the subgraph was never redeployed to index the event, so:

1. ❌ Still showed as "pending" in admin UI
2. ❌ Still showed as "pending" in activity feed  
3. ❌ Displayed old expected amount ($18.06) instead of actual amount ($17.06)
4. ❌ Missing withdrawal fee information ($1.00)
5. ❌ Earn UI showed "Completed" badge in RED instead of GREEN

### Example Transaction

- **TX**: https://kavascan.com/tx/0x9f728cf991eeb9cc8c67b16d7507e9d8abb5c82aeeb9731a601668021663d372
- **User**: 0xd47d...b652
- **Withdrawal ID**: 0x7BFf6c730dA681dF03364c955B165576186370Bc-0
- **Status on-chain**: ✅ Processed successfully (emitted WithdrawalProcessed event)
- **Status in subgraph**: ❌ Still "pending" because subgraph wasn't redeployed
- **Status in UI**: ❌ Showing as pending everywhere

## Root Cause

### The Smart Contract Works Correctly ✅

Both `approveWithdrawals()` and `forceApproveWithdrawals()` emit the **same** `WithdrawalProcessed` event:

```solidity
emit WithdrawalProcessed(
    withdrawalId,
    withdrawal.user,
    withdrawal.shares,
    currentShareValue,
    amountAfterFee, // $17.06 (after $1 fee)
    withdrawalFee,   // $1.00
    block.timestamp
);
```

### The Subgraph Handler Exists ✅

The subgraph's `handleWithdrawalProcessed()` function is correctly implemented:

```typescript
export function handleWithdrawalProcessed(event: WithdrawalProcessedEvent): void {
  let withdrawal = VaultWithdraw.load(withdrawalId);
  
  if (withdrawal) {
    withdrawal.status = "processed";           // ✅ Updates status
    withdrawal.amount = event.params.usdAmount; // ✅ Updates to $17.06
    withdrawal.fee = event.params.fee;          // ✅ Sets fee to $1.00
    withdrawal.processedAt = event.params.timestamp; // ✅ Records processed time
    withdrawal.save();
  }
}
```

### The Problem: Subgraph Was Never Deployed ❌

The subgraph mapping code exists but **was never deployed to The Graph**. The deployed subgraph is still running old code that doesn't have the `handleWithdrawalProcessed` handler.

Result:
- ✅ Event emitted on-chain
- ❌ Subgraph never processed the event
- ❌ Database still shows old "pending" data
- ❌ UI displays stale information

## The Fix

### 1. Deploy the Subgraph (Main Fix)

The subgraph code is already correct - it just needs to be deployed:

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs

# Build
pnpm run codegen
pnpm run build

# Deploy
pnpm run deploy
```

This will:
- Deploy the `handleWithdrawalProcessed` handler
- Re-index all historical `WithdrawalProcessed` events
- Update all processed withdrawals with correct status, amounts, and fees

### 2. Fix Earn UI Colors (Green for Completed)

The earn UI was showing completed withdrawals with a red/pink badge instead of green:

**Before:**
```tsx
<span className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300">
  ✓ Completed
</span>
```

**After:**
```tsx
<span className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300">
  ✓ Completed
</span>
```

Changed from `emerald` to `green` for proper green color.

## Important: Timestamp Fields

**DO NOT update the `timestamp` field** - it should always equal `requestedAt` to preserve when the withdrawal was originally requested.

The schema correctly has separate fields:
```graphql
type VaultWithdraw @entity {
  timestamp: BigInt!       # Request time (DO NOT update when processed)
  requestedAt: BigInt      # When withdrawal was requested
  processedAt: BigInt      # When withdrawal was completed (null if pending)
  canBeApprovedAt: BigInt  # When 7-day lock expires
}
```

This allows tracking:
- When user requested the withdrawal
- When it can be approved (after 7-day delay)
- When it was actually processed

## Deployment Steps

### Step 1: Deploy Subgraph

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
pnpm run codegen
pnpm run build
pnpm run deploy
```

**Expected time:** 5-10 minutes for re-indexing

### Step 2: Rebuild Earn Frontend

```bash
cd /Users/gasparemarchese/scrub/earn
pnpm build
# Deploy to your hosting
```

### Step 3: Verify Fix

After subgraph redeployment, query the withdrawal:

```graphql
{
  vaultWithdraws(where: { 
    id: "0x7bff6c730da681df03364c955b165576186370bc-0" 
  }) {
    id
    user
    status
    shares
    amount
    fee
    requestedAt
    processedAt
  }
}
```

**Expected Result:**
```json
{
  "id": "0x7bff6c730da681df03364c955b165576186370bc-0",
  "user": "0xd47d2f1543cdae1284f20705a32b1362422cb652",
  "status": "processed",  // ✅ Now "processed" instead of "pending"
  "shares": "18000000000000000000",
  "amount": "17060000",   // ✅ $17.06 (after $1 fee)
  "fee": "1000000",       // ✅ $1.00
  "requestedAt": "1738428893",
  "processedAt": "1738512906"  // ✅ Now set
}
```

### Step 4: Verify in UIs

**Admin UI** (scrubvault-i7vkv.ondigitalocean.app/vault-management):
- ✅ Withdrawal no longer appears in "Pending Withdrawals (1)"
- ✅ Shows in "All Withdrawals" with status "processed" (green badge)
- ✅ Amount shows $17.06
- ✅ Fee shows $1.00
- ✅ Activity feed shows "$20.00 withdrawn" with processed status

**Earn UI** (earn project):
- ✅ "Completed" badge is now GREEN (not red)
- ✅ Shows processed timestamp
- ✅ Amount: $17.06
- ✅ Fee: $1.00

## Files Changed

1. `/Users/gasparemarchese/scrub/earn/src/components/ScrubVaultDetailRestructured.tsx`
   - Line 477: Changed completed badge from `emerald` to `green` colors

## Why This Happened

The subgraph was developed with the correct handler for `WithdrawalProcessed` events, but was never deployed. This is why:

1. Regular withdrawals work fine (they use different events that were deployed)
2. Force withdrawals appeared to work (transaction succeeded on-chain)
3. But UI showed stale data (subgraph never indexed the event)

## Prevention

1. **Always deploy subgraph after adding event handlers**
2. **Test force/emergency functions** the same as regular functions
3. **Monitor subgraph indexing** after deployments
4. **Verify UI data** matches on-chain events

## Related Documentation

- Smart contract: `scrubvault/packages/contracts/contracts/vault/DepositVault.sol`
- Subgraph handler: `scrub-graphs/src/mappingScrubVault.ts` (line 295)
- Admin UI: `scrubvault/apps/admin/src/app/vault-management/page.tsx`
- Earn UI: `earn/src/components/ScrubVaultDetailRestructured.tsx`

1. ❌ Still showed as "pending" in transaction history
2. ❌ Displayed old expected amount instead of actual amount received
3. ❌ Missing withdrawal fee information
4. ✅ Correctly showed as "Completed" in earn project (green)

### Example Transaction

- **TX**: https://kavascan.com/tx/0x9f728cf991eeb9cc8c67b16d7507e9d8abb5c82aeeb9731a601668021663d372
- **User**: 0xd47d...b652
- **Withdrawal ID**: 0x7BFf6c730dA681dF03364c955B165576186370Bc-0
- **Status on-chain**: ✅ Processed successfully
- **Status in UI**: ❌ Still showing as pending

## Root Cause

### The Smart Contract Works Correctly

Both `approveWithdrawals()` and `forceApproveWithdrawals()` emit the **same** `WithdrawalProcessed` event:

```solidity
emit WithdrawalProcessed(
    withdrawalId,
    withdrawal.user,
    withdrawal.shares,
    currentShareValue,
    amountAfterFee, // Amount actually sent to user
    withdrawalFee,
    block.timestamp
);
```

### The Subgraph Handler Was Incomplete

The subgraph's `handleWithdrawalProcessed()` function correctly updated:
- ✅ `status` → "processed"
- ✅ `amount` → actual amount (after fees)
- ✅ `fee` → withdrawal fee ($1.00)
- ✅ `processedAt` → processing timestamp

**BUT** it did NOT update:
- ❌ `timestamp` → remained at old request time

### The Query Used Wrong Field

The backend API query ordered by `timestamp`:

```graphql
vaultWithdraws(
  where: { vault: "${vault}" }
  orderBy: timestamp        # ❌ WRONG - This is the request time
  orderDirection: desc
  first: 1000
)
```

Since `timestamp` was never updated when the withdrawal was processed, it still had the old value from when it was first requested. The UI displayed the old data instead of the updated data.

## The Fix

### 1. Update Subgraph Mapping (`scrub-graphs/src/mappingScrubVault.ts`)

```typescript
export function handleWithdrawalProcessed(event: WithdrawalProcessedEvent): void {
  // ... existing code ...
  
  if (withdrawal) {
    withdrawal.status = "processed";
    withdrawal.amount = event.params.usdAmount;
    withdrawal.fee = event.params.fee;
    withdrawal.processedAt = event.params.timestamp;
    withdrawal.timestamp = event.params.timestamp; // ✅ FIX: Update timestamp
    withdrawal.save();
    // ...
  }
}
```

**Why this works**: 
- When ordered by `timestamp`, processed withdrawals now show with their processing time
- The UI displays the correct (updated) amount and fee
- Historical data shows when withdrawal was actually processed, not just requested

### 2. Update Backend API Query (`scrubvault/apps/api/src/modules/vault/vault.service.ts`)

```typescript
async getAllWithdrawals(vaultAddress?: string) {
  const query = gql`
    query GetAllWithdrawals {
      vaultWithdraws(
        where: { vault: "${vault}" }
        orderBy: requestedAt     # ✅ Better: Use requestedAt for clear semantics
        orderDirection: desc
        first: 1000
      ) {
        id
        user
        shares
        amount
        fee
        status
        timestamp                # Now shows processing time for processed withdrawals
        requestedAt              # ✅ Added: When withdrawal was requested
        canBeApprovedAt          # When 7-day lock expires
        processedAt              # ✅ Added: When withdrawal was completed
      }
    }
  `;
}
```

**Why this is better**:
- `orderBy: requestedAt` is semantically clearer - sorts by request order
- We now fetch all timestamp fields so UI can display both request and processed times
- Future-proof: If we want different sorting, we have all the data

### 3. Frontend Already Correct

The earn project (`earn/src/components/ScrubVaultDetailRestructured.tsx`) was already implemented correctly:

```tsx
{!isPending && (
  <span className="px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 rounded-lg border border-emerald-500/40">
    ✓ Completed
  </span>
)}
```

It correctly:
- Shows green for completed withdrawals ✅
- Displays processed timestamp ✅
- Shows actual amount received ✅

The scrubvault admin UI also correctly shows green for processed withdrawals.

## Schema Design Note

The `VaultWithdraw` schema has these timestamp fields:

```graphql
type VaultWithdraw @entity {
  timestamp: BigInt!       # Deprecated - now shows processing time
  requestedAt: BigInt      # When withdrawal was requested
  canBeApprovedAt: BigInt  # When 7-day lock expires
  processedAt: BigInt      # When withdrawal was processed (null if pending)
}
```

**Why we didn't deprecate `timestamp` completely**:
1. It's required (`!`) in the schema - breaking change to remove
2. Now it serves a useful purpose: shows most recent action time
   - For pending: shows when requested
   - For processed: shows when completed
3. Existing frontends use it for sorting

**Better long-term solution** (for future schema v2):
- Remove `timestamp` field entirely
- Always use explicit `requestedAt` and `processedAt`
- Queries specify which timestamp they want to sort by

## Deployment Steps

### 1. Update Subgraph

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs

# Build
pnpm run codegen
pnpm run build

# Deploy
pnpm run deploy
```

### 2. Wait for Re-indexing

The subgraph will re-index all historical `WithdrawalProcessed` events and update the `timestamp` field for all processed withdrawals.

**Expected time**: 5-10 minutes (depends on number of historical withdrawals)

### 3. Verify Fix

Check the force-processed withdrawal:

```graphql
{
  vaultWithdraws(where: { 
    id: "0x7bff6c730da681df03364c955b165576186370bc-0" 
  }) {
    id
    user
    status
    shares
    amount
    fee
    requestedAt
    processedAt
    timestamp
    canBeApprovedAt
  }
}
```

**Expected Result**:
```json
{
  "id": "0x7bff6c730da681df03364c955b165576186370bc-0",
  "user": "0xd47d2f1543cdae1284f20705a32b1362422cb652",
  "status": "processed",
  "shares": "18000000000000000000",
  "amount": "17060000",  // $17.06 after $1 fee
  "fee": "1000000",      // $1.00
  "requestedAt": "1738428893",
  "processedAt": "1738512906",
  "timestamp": "1738512906",  // ✅ Now matches processedAt
  "canBeApprovedAt": "1739033693"
}
```

### 4. Rebuild Backend (if needed)

If the backend API is already deployed, no rebuild needed - the query will automatically fetch the updated data from the subgraph.

```bash
cd /Users/gasparemarchese/scrub/scrubvault
pnpm --filter @scrubvault/api build
```

## Testing

### Test Scenarios

1. **Existing processed withdrawals**:
   - ✅ Should now show correct processed timestamp
   - ✅ Should show correct amount (after fees)
   - ✅ Should show correct fee ($1.00)

2. **New regular withdrawals** (via `approveWithdrawals`):
   - ✅ Should work exactly as before
   - ✅ Should update timestamp when processed

3. **New force withdrawals** (via `forceApproveWithdrawals`):
   - ✅ Should update timestamp immediately
   - ✅ Should show as "processed" immediately
   - ✅ Should display correct amounts

4. **Pending withdrawals**:
   - ✅ `timestamp` = `requestedAt`
   - ✅ `processedAt` = null
   - ✅ Status = "pending"

### Manual Verification

Check the admin UI at `scrubvault-l7vkv.ondigitalocean.app/vault-management`:

1. Go to "All Withdrawals" section
2. Find withdrawal ID `0` for user `0xd47d...b652`
3. Verify:
   - Status badge is green (processed) ✅
   - Amount shows $17.06 (not $18.00) ✅
   - Fee shows $1.00 ✅
   - Timestamp shows Feb 2, 2026 (not Jan 31) ✅

## Prevention

To prevent similar issues in the future:

### 1. Always Update All Timestamp Fields

When handling events that change state, update ALL relevant timestamp fields:

```typescript
// ✅ GOOD
withdrawal.status = "processed";
withdrawal.processedAt = event.params.timestamp;
withdrawal.timestamp = event.params.timestamp;  // Update legacy field too

// ❌ BAD
withdrawal.status = "processed";
withdrawal.processedAt = event.params.timestamp;
// Forgot to update timestamp
```

### 2. Use Explicit Field Names in Queries

```graphql
# ✅ GOOD - Clear intent
orderBy: requestedAt

# ⚠️ UNCLEAR - What does timestamp represent?
orderBy: timestamp
```

### 3. Test Force Functions

Force/emergency functions should emit the same events as regular functions and be tested the same way:

```typescript
it("Should handle force-processed withdrawals in subgraph", async () => {
  // Test that forceApproveWithdrawals updates all fields correctly
});
```

### 4. Add Schema Documentation

```graphql
type VaultWithdraw @entity {
  """
  Legacy timestamp field. 
  For pending: equals requestedAt
  For processed: equals processedAt
  Use requestedAt/processedAt explicitly instead
  """
  timestamp: BigInt!
}
```

## Related Issues

- Similar issue could exist with deposits (check if `timestamp` updates on processing)
- Consider adding `timestamp` update to `handleDepositProcessed()` as well

## Commit

This fix includes:
- ✅ Subgraph mapping update
- ✅ Backend API query improvement  
- ✅ Documentation
- ⏳ Pending: Subgraph redeployment

## Files Changed

1. `/Users/gasparemarchese/scrub/scrub-graphs/src/mappingScrubVault.ts`
   - Line 306: Added `withdrawal.timestamp = event.params.timestamp;`

2. `/Users/gasparemarchese/scrub/scrubvault/apps/api/src/modules/vault/vault.service.ts`
   - Line 527: Changed `orderBy: timestamp` → `orderBy: requestedAt`
   - Line 537: Added `processedAt` to query fields
