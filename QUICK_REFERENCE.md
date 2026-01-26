# ScrubVault Subgraph - Quick Reference

## 🚀 Quick Start Commands

### Development
```bash
# Install dependencies
npm install

# Generate types from schema
npm run codegen

# Build subgraph
npm run build

# Run tests
npm run test
```

### Deployment
```bash
# Deploy as new separate subgraph (starts indexing from block 19087544)
npm run deploy-grafting 19087544

# Deploy with grafting (inherits data from old subgraph)
npm run deploy-grafting 19087544 QmOldSubgraphIPFSHash
```

### Testing Queries
```bash
# Check indexing status
curl http://localhost:8000/subgraphs/name/scrubvault/graphql \
  -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'

# Get all vaults
curl http://localhost:8000/subgraphs/name/scrubvault/graphql \
  -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ vaults { id vaultType totalShares paused } }"}'
```

---

## 📊 Entity Quick Reference

### Vault
**ID**: `{vaultAddress}` (lowercase)
**Key Fields**: vaultType, underlying, shareToken, strategy, totalShares, paused

### VaultDeposit
**ID**: `{vaultAddress}-{depositId}` (lowercase)
**Key Fields**: depositId, user, amount, fee, sharesMinted, status, timestamp

### VaultWithdraw
**ID**: `{vaultAddress}-{withdrawalId}` (lowercase)
**Key Fields**: withdrawalId, user, shares, amount, fee, status, canBeApprovedAt, timestamp

### VaultUser
**ID**: `{vaultAddress}-{userAddress}` (both lowercase)
**Key Fields**: shareBalance, pendingDepositCount, pendingWithdrawalCount, totalDeposited, totalWithdrawn

### VaultInfo
**ID**: `{vaultAddress}-{timestamp}` (lowercase)
**Key Fields**: timestamp, tvl, apr, totalSupplied, totalBorrowed

### VaultReward
**ID**: `{vaultAddress}-{timestamp}` (lowercase)
**Key Fields**: rewardAmount, newShareValue, newTotalVaultValue, timestamp

---

## 🎯 Event Handlers Summary

| Event | Handler | Creates/Updates |
|-------|---------|----------------|
| VaultInitialized | handleVaultInitialized | ✅ Vault |
| DepositRequested | handleDepositRequested | ✅ VaultDeposit, ⬆️ VaultUser |
| DepositProcessed | handleDepositProcessed | ⬆️ VaultDeposit, ⬆️ VaultUser, ⬆️ Vault, ✅ VaultInfo |
| WithdrawalRequested | handleWithdrawalRequested | ✅ VaultWithdraw, ⬆️ VaultUser, ⬆️ Vault |
| WithdrawalProcessed | handleWithdrawalProcessed | ⬆️ VaultWithdraw, ⬆️ VaultUser, ⬆️ Vault |
| RewardDistributed | handleRewardDistributed | ✅ VaultReward, ✅ VaultInfo |

✅ = Creates entity  
⬆️ = Updates entity

---

## 📝 Common GraphQL Queries

### Get All Vaults
```graphql
{
  vaults(where: { vaultType: "scrub" }) {
    id
    vaultType
    underlying
    shareToken
    totalShares
    paused
  }
}
```

### Get Vault with Historical Data
```graphql
{
  vault(id: "0x7bff6c730da681df03364c955b165576186370bc") {
    id
    vaultType
    totalShares
    infos(first: 100, orderBy: timestamp, orderDirection: desc) {
      timestamp
      tvl
      apr
    }
  }
}
```

### Get User Deposits
```graphql
{
  vaultDeposits(
    where: { 
      vault: "0x7bff6c730da681df03364c955b165576186370bc",
      user: "0x1234567890123456789012345678901234567890"
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    depositId
    amount
    fee
    sharesMinted
    status
    timestamp
  }
}
```

### Get User Pending Deposits
```graphql
{
  vaultDeposits(
    where: { 
      vault: "0x7bff6c730da681df03364c955b165576186370bc",
      user: "0x1234567890123456789012345678901234567890",
      status: "pending"
    }
  ) {
    depositId
    amount
    fee
    timestamp
  }
}
```

### Get User Withdrawals
```graphql
{
  vaultWithdraws(
    where: { 
      vault: "0x7bff6c730da681df03364c955b165576186370bc",
      user: "0x1234567890123456789012345678901234567890"
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    withdrawalId
    shares
    amount
    fee
    status
    canBeApprovedAt
    timestamp
  }
}
```

### Get User Stats
```graphql
{
  vaultUser(
    id: "0x7bff6c730da681df03364c955b165576186370bc-0x1234567890123456789012345678901234567890"
  ) {
    user
    shareBalance
    pendingDepositCount
    pendingWithdrawalCount
    totalDeposited
    totalWithdrawn
  }
}
```

---

## ⚙️ Configuration Files

### package.json Scripts
- `codegen` - Generate TypeScript types from schema
- `build` - Compile AssemblyScript handlers
- `test` - Run matchstick-as unit tests
- `create-scrubvault` - Create new subgraph (first time only)
- `deploy-scrubvault` - Deploy without grafting
- `deploy-grafting` - Deploy with optional grafting (TypeScript script)

### subgraph.yaml
- **dataSources**: Defines ScrubDepositVault contract
- **startBlock**: Updated by deploy-grafting script
- **grafting** (optional): Configured by deploy-grafting script
- **entities**: Vault, VaultDeposit, VaultWithdraw, VaultUser, VaultInfo, VaultReward
- **eventHandlers**: All 6 events mapped to handlers

---

## 🧪 Testing

### Run All Tests
```bash
npm run test
```

**Expected**: "All 9 tests passed! 😎" (6.484s)

### Test Files
- `tests/scrubVault.test.ts` - 4 granular tests
- `tests/scrubVaultComplete.test.ts` - 5 comprehensive flow tests
- `tests/scrubVault-utils.ts` - Event creation utilities

---

## 🐛 Troubleshooting

### Tests Fail: "Entity not found"
**Cause**: Entity ID not lowercase
**Fix**: Use `.toLowerCase()` for all addresses
```typescript
const vaultId = VAULT_ADDRESS.toLowerCase();
```

### Tests Hang
**Cause**: Missing `clearStore()` or `beforeAll` hook
**Fix**: Add `afterEach(() => clearStore())` and remove `beforeAll`

### Wrong Timestamps in VaultInfo
**Cause**: Using `event.block.timestamp` instead of `event.params.timestamp`
**Fix**: Check handler uses `event.params.timestamp` for deposit/withdrawal events

### Build Fails
**Cause**: Schema or handler syntax error
**Fix**: Check error message, verify types match schema, ensure all imports present

---

## 📚 Documentation

- **FRONTEND_DATA_VALIDATION.md** - Frontend requirements validation (100% coverage)
- **TESTING_DOCUMENTATION.md** - Complete test suite documentation
- **DEPLOYMENT_READINESS_REPORT.md** - Deployment status and checklist
- **README.md** - Project overview and setup

---

## 🔗 Important Addresses

### ScrubVault Contract
- **Address**: (from subgraph.yaml - updated per deployment)
- **Network**: Kava (or configured network)
- **Start Block**: 19087544

### Graph Node Endpoint
- **Local**: `http://localhost:8000/subgraphs/name/scrubvault/graphql`
- **Production**: (Update after deployment)

---

## ✅ Pre-Deployment Checklist

Quick validation before deploying:

```bash
# 1. Tests pass
npm run test
# Expected: All 9 tests passed! 😎

# 2. Build succeeds
npm run build
# Expected: Build completed: build/subgraph.yaml

# 3. No uncommitted changes
git status
# Commit any pending changes

# 4. Deploy
npm run deploy-grafting 19087544
```

---

## 🚨 Critical Rules

1. **Always use lowercase addresses** in entity IDs
2. **Use `event.params.timestamp`** for deposit/withdrawal events (not block timestamp)
3. **Use `event.block.timestamp`** only for RewardDistributed (no params.timestamp)
4. **Call `clearStore()`** in test cleanup (afterEach)
5. **Set `event.address`** when creating test events
6. **Never deploy without running tests first**

---

## 📊 Status Indicators

### Entity Status Fields
- **VaultDeposit.status**: "pending" | "processed"
- **VaultWithdraw.status**: "pending" | "processed"

### Vault State Fields
- **Vault.paused**: true | false
- **Vault.totalShares**: Current total (increases with deposits, decreases with withdrawals)
- **Vault.totalPendingWithdrawalShares**: Shares locked in pending withdrawals

---

## 🎯 Frontend Integration

### Update Subgraph Endpoint
```typescript
// earn/src/config/subgraphs.ts
export const SUBGRAPH_ENDPOINTS = {
  scrubvault: "http://localhost:8000/subgraphs/name/scrubvault/graphql",
};
```

### Example React Hook Usage
```typescript
import { useScrubVault } from '@/features/earn/hooks/useScrubVault';

const { vault, loading, error } = useScrubVault(vaultAddress);

// vault contains:
// - address, underlying, shareToken, strategy, treasury
// - totalShares, shareValue, paused
// - tvl, apr
// - tvlHistory[], aprHistory[], shareValueHistory[]
// - userShares, pendingDepositCount, pendingWithdrawalCount
// - recentDeposits[], recentWithdrawals[]
```

---

## 🔄 Typical Development Workflow

1. **Make Changes**: Edit schema.graphql or src/mappingScrubVault.ts
2. **Regenerate Types**: `npm run codegen`
3. **Update Tests**: Modify tests to match new logic
4. **Run Tests**: `npm run test` (must pass)
5. **Build**: `npm run build` (must succeed)
6. **Deploy**: `npm run deploy-grafting <block> [grafting]`
7. **Verify**: Test queries against deployed subgraph
8. **Integrate**: Update frontend to use new fields

---

## 📞 Quick Help

### "How do I test a specific query?"
Use curl with GraphQL query:
```bash
curl http://localhost:8000/subgraphs/name/scrubvault/graphql \
  -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ vaults { id } }"}'
```

### "How do I check if indexing is working?"
Query the `_meta` field:
```bash
curl http://localhost:8000/subgraphs/name/scrubvault/graphql \
  -X POST -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
```

### "How do I redeploy after changes?"
```bash
npm run codegen && npm run build && npm run deploy-grafting 19087544
```

### "How do I debug test failures?"
Check error message for:
- Entity not found → Check ID format (lowercase?)
- Field mismatch → Check expected vs actual value
- Handler error → Check handler logic

---

## ✅ Deployment Status

**Current Status**: 🟢 **READY FOR PRODUCTION**

- ✅ All tests passing (9/9)
- ✅ Build successful (0 errors)
- ✅ Frontend data validated (100% coverage)
- ✅ Documentation complete
- ✅ Deployment scripts ready

**Deploy with**: `npm run deploy-grafting 19087544`

---

## 📖 Further Reading

- **Graph Protocol Docs**: https://thegraph.com/docs/
- **AssemblyScript**: https://www.assemblyscript.org/
- **matchstick-as**: https://github.com/LimeChain/matchstick
- **GraphQL**: https://graphql.org/learn/

---

**Last Updated**: After comprehensive validation and testing
**Version**: Ready for deployment
**Confidence**: 🟢 HIGH (all validations passed)
