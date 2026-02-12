# ScrubPoint Contract → Subgraph Event Mapping

## 📋 Overview

The ScrubPoint contract was upgraded to emit custom events. The subgraph handles **both pre-upgrade and post-upgrade** scenarios.

## 🔄 Contract Upgrade Strategy

### **Before Upgrade** (Block < UPGRADE_BLOCK)
- Only `Transfer` events exist
- Subgraph creates mint/burn entities from Transfer(0x0 → user) and Transfer(user → 0x0)
- totalSupply field = 0 (not available in Transfer event)

### **After Upgrade** (Block >= UPGRADE_BLOCK)  
- Custom events (`PointsMinted`, `PointsBurned`, `PointsForceBurned`) are emitted
- Subgraph uses custom events to create mint/burn entities
- totalSupply field populated correctly
- Transfer events still tracked for all token movements

## 📊 Event → Entity Mapping

### 1. **Transfer Event** (Standard ERC20)
```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```

**Emitted by:**
- `_mint()` → from = 0x0000...0000
- `_burn()` → to = 0x0000...0000  
- `transfer()` → from = sender, to = recipient
- `transferFrom()` → from = owner, to = recipient

**Creates:**
- `ScrubPointTransfer` (always)
- `ScrubPointMint` (PRE-UPGRADE only, when from = 0x0)
- `ScrubPointBurn` (PRE-UPGRADE only, when to = 0x0)

**Updates:**
- `ScrubPointHolder` balances
- `ScrubPointStats.totalTransfers`

---

### 2. **PointsMinted Event** (Custom - POST-UPGRADE)
```solidity
event PointsMinted(address indexed to, uint256 amount, uint256 newTotalSupply)
```

**Emitted by:**
- `mint(address to, uint256 amount)` 
- `batchMint(address[] recipients, uint256[] amounts)` - one event per recipient

**Creates:**
- `ScrubPointMint` with full data including `totalSupply`

**Fields:**
```typescript
{
  id: string               // txHash-logIndex
  recipient: Bytes         // event.params.to
  amount: BigInt           // event.params.amount
  totalSupply: BigInt      // event.params.newTotalSupply ✅
  timestamp: BigInt
  blockNumber: BigInt
  transactionHash: Bytes
}
```

**Updates:**
- `ScrubPointHolder.balance` (increment)
- `ScrubPointHolder.totalReceived` (increment)
- `ScrubPointStats.totalMints` (increment)
- `ScrubPointStats.totalSupply` (set to newTotalSupply)
- `ScrubPointStats.totalHolders` (increment if new holder)

---

### 3. **PointsBurned Event** (Custom - POST-UPGRADE)
```solidity
event PointsBurned(address indexed from, uint256 amount, uint256 newTotalSupply)
```

**Emitted by:**
- `burn(uint256 amount)` - burns from msg.sender
- `burnFrom(address from, uint256 amount)` - burns from approved address

**Creates:**
- `ScrubPointBurn` with full data including `totalSupply`

**Fields:**
```typescript
{
  id: string               // txHash-logIndex
  burner: Bytes            // event.params.from
  amount: BigInt           // event.params.amount
  totalSupply: BigInt      // event.params.newTotalSupply ✅
  timestamp: BigInt
  blockNumber: BigInt
  transactionHash: Bytes
}
```

**Updates:**
- `ScrubPointHolder.balance` (decrement)
- `ScrubPointHolder.totalBurned` (increment)
- `ScrubPointStats.totalBurns` (increment)
- `ScrubPointStats.totalSupply` (set to newTotalSupply)
- `ScrubPointStats.totalHolders` (decrement if balance becomes 0)

---

### 4. **PointsForceBurned Event** (Custom - POST-UPGRADE)
```solidity
event PointsForceBurned(address indexed from, address indexed burner, uint256 amount, uint256 newTotalSupply)
```

**Emitted by:**
- `forceBurn(address from, uint256 amount)` - owner forcibly burns from any address

**Creates:**
- `ScrubPointForceBurn` with burner info and totalSupply

**Fields:**
```typescript
{
  id: string               // txHash-logIndex  
  from: Bytes              // event.params.from (address losing tokens)
  burner: Bytes            // event.params.burner (owner executing burn)
  amount: BigInt           // event.params.amount
  totalSupply: BigInt      // event.params.newTotalSupply ✅
  timestamp: BigInt
  blockNumber: BigInt
  transactionHash: Bytes
}
```

**Updates:**
- `ScrubPointHolder.balance` (decrement for 'from' address)
- `ScrubPointHolder.totalBurned` (increment)
- `ScrubPointStats.totalForceBurns` (increment)
- `ScrubPointStats.totalSupply` (set to newTotalSupply)
- `ScrubPointStats.totalHolders` (decrement if balance becomes 0)

---

## 🎯 Complete Entity Schema

### ScrubPointMint
```typescript
type ScrubPointMint @entity {
  id: ID!                    # txHash-logIndex
  recipient: Bytes!          # Who received the minted tokens
  amount: BigInt!            # Amount minted
  totalSupply: BigInt!       # Total supply after mint (0 if pre-upgrade)
  timestamp: BigInt!         # Block timestamp
  blockNumber: BigInt!       # Block number
  transactionHash: Bytes!    # Transaction hash
}
```

### ScrubPointBurn
```typescript
type ScrubPointBurn @entity {
  id: ID!                    # txHash-logIndex
  burner: Bytes!             # Who burned the tokens
  amount: BigInt!            # Amount burned
  totalSupply: BigInt!       # Total supply after burn (0 if pre-upgrade)
  timestamp: BigInt!         # Block timestamp
  blockNumber: BigInt!       # Block number
  transactionHash: Bytes!    # Transaction hash
}
```

### ScrubPointForceBurn
```typescript
type ScrubPointForceBurn @entity {
  id: ID!                    # txHash-logIndex
  from: Bytes!               # Address that had tokens burned
  burner: Bytes!             # Owner who executed force burn
  amount: BigInt!            # Amount burned
  totalSupply: BigInt!       # Total supply after burn
  timestamp: BigInt!         # Block timestamp
  blockNumber: BigInt!       # Block number
  transactionHash: Bytes!    # Transaction hash
}
```

### ScrubPointTransfer
```typescript
type ScrubPointTransfer @entity {
  id: ID!                    # txHash-logIndex
  from: Bytes!               # Sender (0x0 for mints)
  to: Bytes!                 # Receiver (0x0 for burns)
  amount: BigInt!            # Amount transferred
  timestamp: BigInt!         # Block timestamp
  blockNumber: BigInt!       # Block number
  transactionHash: Bytes!    # Transaction hash
}
```

### ScrubPointHolder
```typescript
type ScrubPointHolder @entity {
  id: ID!                    # userAddress
  address: Bytes!            # User address
  balance: BigInt!           # Current balance
  totalReceived: BigInt!     # Lifetime mints + transfers in
  totalSent: BigInt!         # Lifetime transfers out
  totalBurned: BigInt!       # Lifetime burns (regular + force)
  firstSeenAt: BigInt!       # First interaction timestamp
  lastActivityAt: BigInt!    # Last interaction timestamp
}
```

### ScrubPointStats
```typescript
type ScrubPointStats @entity {
  id: ID!                    # "singleton"
  totalSupply: BigInt!       # Current total supply
  totalHolders: Int!         # Number of addresses with balance > 0
  totalMints: Int!           # Total mint operations
  totalBurns: Int!           # Total burn operations
  totalForceBurns: Int!      # Total force burn operations
  totalTransfers: Int!       # Total transfer operations
  firstMintAt: BigInt!       # First mint timestamp
  lastActivityAt: BigInt!    # Last activity timestamp
}
```

---

## 🔧 Configuration

### Update UPGRADE_BLOCK After Deployment

In `src/mappingScrubPoint.ts`, update this constant after running the upgrade:

```typescript
const UPGRADE_BLOCK = BigInt.fromI32(999999999); // ⚠️ UPDATE THIS!
```

**To find the upgrade block:**
```bash
# After running upgrade script, it will output the block number
# Or check the transaction on Kava explorer
# Set UPGRADE_BLOCK to that block number
```

---

## 📝 Deployment Steps

### 1. Upgrade the Contract
```bash
cd /Users/gasparemarchese/scrub/scrubvault/packages/contracts
npx hardhat run scripts/upgrade-scrubpoint.ts --network kava
```

**Note the block number from the output!**

### 2. Update UPGRADE_BLOCK
Edit `scrub-graphs/src/mappingScrubPoint.ts`:
```typescript
const UPGRADE_BLOCK = BigInt.fromI32(ACTUAL_BLOCK_NUMBER);
```

### 3. Deploy Subgraph
```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
npm run codegen
npm run build
npm run deploy-scrubvault-test
```

---

## 🧪 Testing Queries

### Get Recent Mints (with totalSupply post-upgrade)
```graphql
query {
  scrubPointMints(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    recipient
    amount
    totalSupply
    timestamp
    transactionHash
  }
}
```

### Get Recent Burns
```graphql
query {
  scrubPointBurns(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    burner
    amount
    totalSupply
    timestamp
    transactionHash
  }
}
```

### Get Force Burns (admin actions)
```graphql
query {
  scrubPointForceBurns(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    from
    burner
    amount
    totalSupply
    timestamp
    transactionHash
  }
}
```

### Get Top Holders
```graphql
query {
  scrubPointHolders(first: 10, orderBy: balance, orderDirection: desc) {
    address
    balance
    totalReceived
    totalSent
    totalBurned
  }
}
```

### Get Stats
```graphql
query {
  scrubPointStats(id: "singleton") {
    totalSupply
    totalHolders
    totalMints
    totalBurns
    totalForceBurns
    totalTransfers
  }
}
```

---

## ⚠️ Important Notes

1. **Backward Compatibility**: Pre-upgrade mints/burns created from Transfer events will have `totalSupply = 0`
2. **No Duplicates**: The UPGRADE_BLOCK check prevents duplicate entities post-upgrade
3. **Transfer Tracking**: All transfers (mints, burns, user-to-user) are tracked in ScrubPointTransfer
4. **Force Burns**: Only available post-upgrade via PointsForceBurned event
5. **Holder Updates**: Balances are always updated from Transfer event regardless of upgrade status
