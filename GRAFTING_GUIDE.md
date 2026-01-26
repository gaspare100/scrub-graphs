# 🚀 Quick Deployment with Grafting - Avoid Reindexing

## Problem
Every time you deploy an updated subgraph, it reindexes from the genesis block, which takes **hours** on Kava mainnet.

## Solution: Grafting
Grafting allows you to "graft" your new subgraph onto an existing one, inheriting all indexed data up to a specific block, then continuing from there.

## How It Works

### 1. Find Your Current Deployment
SSH into your DO server and get the current deployment IPFS hash:

```bash
ssh your-server
curl -X POST http://localhost:8020 -H "Content-Type: application/json" --data '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"scrub\") { synced chains { latestBlock { number }} }}"}'
```

Note the:
- Latest synced block number
- Current subgraph IPFS hash

### 2. Update subgraph.yaml with Graft Configuration

Add this section at the TOP of your `subgraph.yaml`:

```yaml
specVersion: 0.0.4
description: ScrubInvest
schema:
  file: ./schema.graphql
features:
  - grafting
graft:
  base: Qm...  # Your current subgraph IPFS hash
  block: 19087500  # Block number BEFORE your new contract deployment
```

**Important**: 
- `base`: IPFS hash of your CURRENTLY DEPLOYED subgraph
- `block`: Must be BEFORE the startBlock of your new data source (ScrubDepositVault at block 19087544)
- Use a recent block (like current block - 100) to minimize reindexing

### 3. Build with Grafting

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
npm run build
```

### 4. Deploy to Your DO Server

```bash
# On your local machine
git add .
git commit -m "feat: Add ScrubVault subgraph with grafting"
git push origin main

# SSH to DO server
ssh your-server
cd /path/to/scrub-graphs
git fetch
git pull

# First time: create the subgraph
npm run create-scrubvault

# Deploy with automatic startBlock update
npm run deploy-grafting 19087544
```

**What this does**:
- ✅ Updates `subgraph.yaml` with the specified startBlock
- ✅ Runs codegen to generate types
- ✅ Builds the subgraph
- ✅ Deploys to local graph-node

### 5. What Happens

✅ Graph Node copies all data up to block 19087500 from old subgraph  
✅ Starts indexing NEW events from block 19087500 onwards  
✅ Only indexes ~44 blocks (19087544 - 19087500) for ScrubDepositVault  
⚡ **Deployment completes in MINUTES instead of HOURS**

## Alternative: Schema-Only Changes (Even Faster)

If you're ONLY adding a new data source (not changing existing ones):

### Option A: Feature Flags
Add to subgraph.yaml:
```yaml
features:
  - nonFatalErrors
  - fullTextSearch
```

Then deploy without grafting - existing data sources continue, new one starts fresh.

### Option B: Multiple Subgraphs (Recommended)
Deploy ScrubVault as a SEPARATE subgraph:

```bash
# On DO server
cd /path/to/scrub-graphs

# First time: create the subgraph
npm run create-scrubvault

# Deploy with startBlock parameter
npm run deploy-grafting 19087544
```

This automatically updates the subgraph.yaml, runs codegen, builds, and deploys!
graph create --node http://localhost:8020 scrubvault
graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 scrubvault

# Query both in your frontend
```

## Recommended Approach for This Deployment

**Use Option A: Separate Subgraph** (Fastest)

1. Create `scrubvault-subgraph.yaml`:
```yaml
specVersion: 0.0.4
description: ScrubVault - Queue-based deposit/withdrawal system
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: ScrubDepositVault
    network: kava
    source:
      address: "0x7BFf6c730dA681dF03364c955B165576186370Bc"
      abi: DepositVault
      startBlock: 19087544
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      file: ./src/mappingScrubVault.ts
      entities:
        - Vault
        - VaultDeposit
        - VaultWithdraw
        - VaultReward
        - VaultInfo
        - VaultUser
      abis:
        - name: DepositVault
          file: ./abis/DepositVault.json
      eventHandlers:
        - event: VaultInitialized(indexed address,indexed address,indexed address,address,address,uint256)
          handler: handleVaultInitialized
        - event: DepositRequested(indexed uint256,indexed address,uint256,uint256,uint256)
          handler: handleDepositRequested
        - event: DepositProcessed(indexed uint256,indexed address,uint256,uint256,uint256)
          handler: handleDepositProcessed
        - event: WithdrawalRequested(indexed uint256,indexed address,uint256,uint256,uint256,uint256,uint256)
          handler: handleWithdrawalRequested
        - event: WithdrawalProcessed(indexed uint256,indexed address,uint256,uint256,uint256,uint256,uint256)
          handler: handleWithdrawalProcessed
        - event: RewardDistributed(int256,uint256,uint256)
          handler: handleRewardDistributed
```

2. Build:
```bash
npm run build
```

3. Deploy as NEW subgraph:
```bash
# SSH to server
cd /path/to/scrub-graphs
git pull

# Create new subgraph
graph create --node http://localhost:8020 scrubvault

# Deploy
graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 scrubvault --version-label v1.0.0
```

4. Update frontend to query BOTH subgraphs:
```typescript
// For Hover vaults
const HOVER_SUBGRAPH = 'http://your-server:8000/subgraphs/name/scrub';

// For ScrubVaults
const SCRUBVAULT_SUBGRAPH = 'http://your-server:8000/subgraphs/name/scrubvault';
```

## Benefits of Separate Subgraph

✅ **Zero downtime** - existing subgraph keeps running  
✅ **Fast deployment** - only indexes from block 19087544  
✅ **Independent updates** - can update ScrubVault logic without affecting Hover vaults  
✅ **Easy rollback** - just point frontend back to old endpoint  
✅ **No schema conflicts** - each subgraph has its own schema

## Long-term: Merge Later (Optional)

Once ScrubVault is stable, you can merge into main subgraph using grafting if desired.

## Deployment Commands

```bash
# Local
cd /Users/gasparemarchese/scrub/scrub-graphs
npm run build
git add .
git commit -m "feat: Add ScrubVault subgraph"
git push

# Server
ssh your-do-server
cd /path/to/scrub-graphs
git pull
graph create --node http://localhost:8020 scrubvault
graph deploy --node http://localhost:8020 --ipfs http://localhost:5001 scrubvault
```

## Monitoring

```bash
# Check indexing status
curl http://localhost:8000/subgraphs/name/scrubvault/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"query": "{ _meta { block { number } } }"}'

# Check for errors
docker logs graph-node --tail 100 -f | grep scrubvault
```

---

**Recommended**: Start with separate subgraph approach. It's fastest and safest!
