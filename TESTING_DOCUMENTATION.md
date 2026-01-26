# ScrubVault Subgraph - Testing Documentation

## 🧪 Test Suite Overview

The scrubvault subgraph includes comprehensive unit tests covering all event handlers and user flows. All tests use the **matchstick-as** framework for AssemblyScript smart contract indexing.

---

## 📊 Test Results

**Status**: ✅ **All 9 tests passing** (6.484s execution time)

### Test Files
1. `tests/scrubVault.test.ts` - Original 4 tests (granular handler tests)
2. `tests/scrubVaultComplete.test.ts` - Comprehensive 5 tests (full flow tests)

---

## 🎯 Test Coverage by Event Handler

### 1. VaultInitialized ✅
**Handler**: `handleVaultInitialized`
**Tests**: 2 tests

**Coverage**:
- ✅ Creates Vault entity with correct ID
- ✅ Sets vaultType to "scrub"
- ✅ Stores all addresses (underlying, shareToken, strategy, treasury)
- ✅ Initializes totalShares to 0
- ✅ Initializes totalPendingWithdrawalShares to 0
- ✅ Sets paused to false
- ✅ Sets tokenName and decimals

**Test Files**:
- `scrubVault.test.ts` → "VaultInitialized creates vault entity with correct fields"
- `scrubVaultComplete.test.ts` → "VaultInitialized creates vault with all fields"

---

### 2. DepositRequested ✅
**Handler**: `handleDepositRequested`
**Tests**: 3 tests (standalone + within flows)

**Coverage**:
- ✅ Creates VaultDeposit entity with status="pending"
- ✅ Sets deposit amount and fee
- ✅ Records timestamp from event.params.timestamp
- ✅ Links deposit to vault and user
- ✅ Creates VaultUser entity if first deposit
- ✅ Increments user's pendingDepositCount
- ✅ Updates user's totalDeposited

**Test Files**:
- `scrubVault.test.ts` → "DepositRequested creates deposit and updates user stats"
- `scrubVaultComplete.test.ts` → Within "Complete deposit flow"

---

### 3. DepositProcessed ✅
**Handler**: `handleDepositProcessed`
**Tests**: 3 tests

**Coverage**:
- ✅ Updates VaultDeposit status to "processed"
- ✅ Sets sharesMinted on deposit entity
- ✅ Updates user's shareBalance
- ✅ Decrements user's pendingDepositCount
- ✅ Updates vault's totalShares
- ✅ Creates VaultInfo entry for TVL/APR tracking
- ✅ Uses event.params.timestamp for VaultInfo (chart accuracy)

**Test Files**:
- `scrubVault.test.ts` → "DepositProcessed updates deposit, user, and vault"
- `scrubVaultComplete.test.ts` → Within "Complete deposit flow"

**Critical Fix**: Changed from `event.block.timestamp` to `event.params.timestamp` for VaultInfo creation (accurate charting)

---

### 4. WithdrawalRequested ✅
**Handler**: `handleWithdrawalRequested`
**Tests**: 1 test (within withdrawal flow)

**Coverage**:
- ✅ Creates VaultWithdraw entity with status="pending"
- ✅ Sets shares, amount, shareValueAtRequest
- ✅ Records canBeApprovedAt for withdrawal queue UI
- ✅ Uses event.params.timestamp for requestedAt and timestamp
- ✅ Increments user's pendingWithdrawalCount
- ✅ Updates vault's totalPendingWithdrawalShares

**Test Files**:
- `scrubVaultComplete.test.ts` → "Complete withdrawal flow - request and process"

**Critical Fix**: Changed all `event.block.timestamp` to `event.params.timestamp` for accurate timeline

---

### 5. WithdrawalProcessed ✅
**Handler**: `handleWithdrawalProcessed`
**Tests**: 1 test (within withdrawal flow)

**Coverage**:
- ✅ Updates VaultWithdraw status to "processed"
- ✅ Sets actualAmount and fee
- ✅ Uses event.params.timestamp for timestamp field
- ✅ Updates user's shareBalance (burns shares)
- ✅ Decrements user's pendingWithdrawalCount
- ✅ Updates user's totalWithdrawn
- ✅ Updates vault's totalShares (decreases)
- ✅ Updates vault's totalPendingWithdrawalShares (clears)

**Test Files**:
- `scrubVaultComplete.test.ts` → "Complete withdrawal flow - request and process"

**Critical Fix**: Changed `event.block.timestamp` to `event.params.timestamp` in user stats update

---

### 6. RewardDistributed ✅
**Handler**: `handleRewardDistributed`
**Tests**: 1 test

**Coverage**:
- ✅ Creates VaultReward entity
- ✅ Records reward amount
- ✅ Records new share value
- ✅ Creates VaultInfo entry for TVL update
- ✅ Uses event.block.timestamp (RewardDistributed has no params.timestamp)

**Test Files**:
- `scrubVaultComplete.test.ts` → "Reward distribution updates vault info"

---

## 🔄 User Flow Tests

### Complete Deposit Flow ✅
**Covers**: VaultInitialized → DepositRequested → DepositProcessed

**Validates**:
1. Vault initialization
2. Deposit request creates pending deposit
3. User's pendingDepositCount increases
4. User's totalDeposited updates
5. Deposit processing changes status to "processed"
6. User receives shares (shareBalance increases)
7. User's pendingDepositCount decreases
8. Vault's totalShares increases
9. VaultInfo created for chart data

**Assertions**: 10+ field validations

---

### Complete Withdrawal Flow ✅
**Covers**: Setup (init + deposit) → WithdrawalRequested → WithdrawalProcessed

**Validates**:
1. User has shares to withdraw (from setup)
2. Withdrawal request creates pending withdrawal
3. User's pendingWithdrawalCount increases
4. Vault's totalPendingWithdrawalShares increases
5. canBeApprovedAt set correctly
6. Withdrawal processing changes status to "processed"
7. User's shares burned (shareBalance decreases)
8. User's pendingWithdrawalCount decreases
9. User's totalWithdrawn updates
10. Vault's totalShares decreases
11. Vault's totalPendingWithdrawalShares clears

**Assertions**: 12+ field validations

---

### Multiple Users - Independent Tracking ✅
**Covers**: 2 separate users depositing

**Validates**:
1. Separate VaultUser entities created
2. Each user's shareBalance tracked independently
3. Each user's totalDeposited tracked independently
4. Vault's totalShares = sum of all users
5. No cross-contamination of user data

**Assertions**: 6+ field validations

---

## 🛠️ Test Utilities

### Event Creation Functions
Located in `tests/scrubVault-utils.ts`

All functions create properly formatted events with correct parameter types:

1. **createVaultInitializedEvent**
   - Parameters: vaultAddress, underlying, strategy, shareToken, treasury, decimals
   - Returns: VaultInitialized event

2. **createDepositRequestedEvent**
   - Parameters: depositId, user, amount, fee, timestamp
   - Returns: DepositRequested event

3. **createDepositProcessedEvent**
   - Parameters: depositId, user, amount, sharesMinted, timestamp
   - Returns: DepositProcessed event

4. **createWithdrawalRequestedEvent** ⚠️ Recently Fixed
   - Parameters: withdrawalId, user, shares, shareValueAtRequest, expectedUsdAmount, canBeApprovedAt, **timestamp**
   - Added timestamp parameter to match actual event signature
   - Returns: WithdrawalRequested event

5. **createWithdrawalProcessedEvent**
   - Parameters: withdrawalId, user, shares, shareValueAtProcessing, actualUsdAmount, fee, timestamp
   - Returns: WithdrawalProcessed event

6. **createRewardDistributedEvent**
   - Parameters: rewardAmount, newShareValue, newTotalVaultValue
   - Returns: RewardDistributed event

---

## 🔍 Test Patterns and Best Practices

### 1. Entity ID Format
All tests use **lowercase addresses** (Graph Protocol standard):

```typescript
// ✅ Correct
const vaultId = VAULT_ADDRESS.toLowerCase();
const userId = vaultId + "-" + USER_ADDRESS.toLowerCase();

// ❌ Wrong
const vaultId = VAULT_ADDRESS;  // Mixed case fails
```

### 2. Test Isolation
Each test calls `clearStore()` to start with clean state:

```typescript
afterEach(() => {
  clearStore();  // Prevents cross-test contamination
});
```

### 3. Timestamp Handling
Use realistic Unix timestamps for accurate testing:

```typescript
// Example: January 26, 2024
BigInt.fromI32(1706270400)
```

### 4. Address Format
Always use `Address.fromString()` for address parameters:

```typescript
Address.fromString(VAULT_ADDRESS)
```

### 5. Event Address Assignment
Set event.address for proper entity relationship tracking:

```typescript
let event = createDepositRequestedEvent(...);
event.address = Address.fromString(VAULT_ADDRESS);
handleDepositRequested(event);
```

---

## 📈 Test Metrics

### Coverage Statistics
- **Total Handlers**: 6
- **Handlers Tested**: 6 (100%)
- **Total Tests**: 9
- **Passing Tests**: 9 (100%)
- **Test Execution Time**: 6.484 seconds
- **Lines of Test Code**: ~400 lines across 2 files

### Entity Coverage
- ✅ Vault - All fields tested
- ✅ VaultDeposit - All fields tested
- ✅ VaultWithdraw - All fields tested
- ✅ VaultUser - All fields tested
- ✅ VaultInfo - Creation tested
- ✅ VaultReward - Creation tested

### Relationship Coverage
- ✅ Vault ↔ VaultDeposit (one-to-many)
- ✅ Vault ↔ VaultWithdraw (one-to-many)
- ✅ Vault ↔ VaultUser (one-to-many)
- ✅ Vault ↔ VaultInfo (one-to-many)
- ✅ Vault ↔ VaultReward (one-to-many)
- ✅ VaultUser ↔ VaultDeposit (one-to-many)
- ✅ VaultUser ↔ VaultWithdraw (one-to-many)

---

## 🚀 Running Tests

### Run All Tests
```bash
npm run test
```

**Expected Output**:
```
Compiling...
💬 Compiling scrubvault...
💬 Compiling scrubvaultcomplete...

Igniting tests 🔥

scrubvaultcomplete
--------------------------------------------------
  ScrubVault Complete Tests:
    √ VaultInitialized creates vault with all fields
    √ Complete deposit flow - request and process
    √ Complete withdrawal flow - request and process
    √ Multiple users - independent tracking
    √ Reward distribution updates vault info

scrubvault
--------------------------------------------------
  ScrubVault:
    √ VaultInitialized creates vault entity with correct fields
    √ DepositRequested creates deposit and updates user stats
    √ DepositProcessed updates deposit, user, and vault
    √ Complete deposit flow works correctly

All 9 tests passed! 😎
```

### Run Specific Test File
```bash
# Not directly supported by matchstick-as
# Must run all tests via npm run test
```

### Debug Test Failures
If tests fail, matchstick-as provides detailed error messages:
- Entity not found → Check entity ID format (lowercase?)
- Field mismatch → Check expected vs actual values
- Handler error → Check handler implementation

---

## 🐛 Common Test Issues & Solutions

### Issue 1: Entity Not Found
**Symptom**: `assert.entityCount` fails or `assert.fieldEquals` can't find entity

**Solution**: Ensure entity ID uses lowercase addresses
```typescript
// ✅ Correct
const vaultId = VAULT_ADDRESS.toLowerCase();

// ❌ Wrong
const vaultId = VAULT_ADDRESS;
```

---

### Issue 2: Tests Hang or Timeout
**Symptom**: Test execution stops without completing all tests

**Solutions**:
1. Remove `beforeAll` hooks (causes matchstick issues)
2. Add `clearStore()` in `afterEach`
3. Check for missing `event.address` assignment
4. Verify event parameters match handler expectations

---

### Issue 3: Timestamp Mismatches
**Symptom**: VaultInfo or timestamps have wrong values

**Solution**: Ensure handlers use correct timestamp source:
- ✅ Deposit/Withdrawal events: `event.params.timestamp`
- ✅ Reward events: `event.block.timestamp` (no params.timestamp)

---

### Issue 4: User Stats Not Updating
**Symptom**: `pendingDepositCount`, `shareBalance` etc. incorrect

**Solution**: Verify VaultUser entity created before updates:
```typescript
let userId = vaultId + "-" + user.toHexString();
let vaultUser = VaultUser.load(userId);
if (!vaultUser) {
  vaultUser = new VaultUser(userId);
  vaultUser.vault = vaultId;
  vaultUser.user = user;
  // ... initialize fields
}
```

---

## 📋 Pre-Deployment Test Checklist

Before deploying the subgraph, ensure:

- ✅ `npm run test` shows "All 9 tests passed! 😎"
- ✅ No "Entity not found" errors
- ✅ All assertions match expected values
- ✅ Timestamp fields use correct source (params vs block)
- ✅ Entity IDs follow lowercase pattern
- ✅ User stats update correctly (pending counts, balances)
- ✅ Vault totals match sum of user balances
- ✅ VaultInfo entities created for charting
- ✅ Test execution completes in <10 seconds

---

## 🎯 Test Maintenance

### Adding New Tests
When adding new event handlers or fields:

1. **Create event utility** in `scrubVault-utils.ts`:
   ```typescript
   export function createNewEvent(...): NewEvent {
     let event = changetype<NewEvent>(newMockEvent());
     // ... set parameters
     return event;
   }
   ```

2. **Add test case**:
   ```typescript
   test("NewEvent does something", () => {
     // Setup
     let event = createNewEvent(...);
     event.address = Address.fromString(VAULT_ADDRESS);
     
     // Execute
     handleNewEvent(event);
     
     // Assert
     assert.fieldEquals("Entity", "id", "field", "value");
   });
   ```

3. **Run tests**: `npm run test`

---

### Updating Existing Tests
When modifying handlers:

1. Update test assertions to match new behavior
2. Add new assertions for new fields
3. Update expected values if logic changes
4. Re-run tests to verify: `npm run test`

---

## 📊 Testing vs Production

### Test Data
Tests use hardcoded addresses and amounts:
- VAULT_ADDRESS: `0x7BFf6c730dA681dF03364c955B165576186370Bc`
- USER1_ADDRESS: `0x1234567890123456789012345678901234567890`
- Amounts: Realistic USDT values (6 decimals)

### Production Data
Subgraph will index real on-chain data:
- Contract addresses from `subgraph.yaml`
- User addresses from transaction events
- Amounts from contract events
- Timestamps from block data

**Tests validate handler logic, not data sources.**

---

## ✅ Conclusion

The scrubvault subgraph has **comprehensive test coverage** ensuring:

✅ All 6 event handlers tested
✅ Complete user flows validated
✅ Entity relationships verified
✅ Timestamp handling correct
✅ User stats accurately tracked
✅ Vault totals match user data
✅ Historical data (VaultInfo) created for charts

**Test Status**: 9/9 passing ✅

**Ready for deployment with confidence!** 🚀

---

## 📚 Additional Resources

- **matchstick-as Docs**: https://thegraph.com/docs/en/developer/matchstick/
- **AssemblyScript**: https://www.assemblyscript.org/
- **Graph Protocol Testing**: https://github.com/LimeChain/matchstick
- **Project Context**: See `FRONTEND_DATA_VALIDATION.md` for data requirements
