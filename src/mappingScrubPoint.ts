import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    PointsBurned as PointsBurnedEvent,
    PointsForceBurned as PointsForceBurnedEvent,
    PointsMinted as PointsMintedEvent,
    Transfer as TransferEvent
} from "../generated/ScrubPoint/ScrubPoint";
import {
    ScrubPointBurn,
    ScrubPointForceBurn,
    ScrubPointHolder,
    ScrubPointMint,
    ScrubPointStats,
    ScrubPointTransfer
} from "../generated/schema";

const ZERO_ADDRESS = Address.zero();
const ZERO = BigInt.fromI32(0);
const STATS_ID = "singleton";

// IMPORTANT: Set this to the block number where the contract upgrade happens
// Before this block: use Transfer events to create mint/burn entities
// After this block: use PointsMinted/Burned events (Transfer still tracked for transfers)
const UPGRADE_BLOCK = BigInt.fromI32(999999999); // UPDATE THIS AFTER UPGRADE!

function getOrCreateStats(): ScrubPointStats {
  let stats = ScrubPointStats.load(STATS_ID);
  if (!stats) {
    stats = new ScrubPointStats(STATS_ID);
    stats.totalSupply = ZERO;
    stats.totalHolders = 0;
    stats.totalMints = 0;
    stats.totalBurns = 0;
    stats.totalForceBurns = 0;
    stats.totalTransfers = 0;
    stats.firstMintAt = ZERO;
    stats.lastActivityAt = ZERO;
    stats.save();
  }
  return stats;
}

function getOrCreateHolder(address: Address, timestamp: BigInt): ScrubPointHolder {
  const id = address.toHex();
  let holder = ScrubPointHolder.load(id);
  if (!holder) {
    holder = new ScrubPointHolder(id);
    holder.address = address;
    holder.balance = ZERO;
    holder.totalReceived = ZERO;
    holder.totalSent = ZERO;
    holder.totalBurned = ZERO;
    holder.firstSeenAt = timestamp;
    holder.lastActivityAt = timestamp;
    holder.save();
  }
  return holder;
}

/**
 * Handle PointsMinted event (post-upgrade only)
 * Creates ScrubPointMint entity with totalSupply info
 */
export function handlePointsMinted(event: PointsMintedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.block.timestamp;
  
  let stats = getOrCreateStats();
  
  const mint = new ScrubPointMint(id);
  mint.recipient = event.params.to;
  mint.amount = event.params.amount;
  mint.totalSupply = event.params.newTotalSupply;
  mint.timestamp = timestamp;
  mint.blockNumber = event.block.number;
  mint.transactionHash = event.transaction.hash;
  mint.save();

  stats.totalMints = stats.totalMints + 1;
  stats.totalSupply = event.params.newTotalSupply;
  stats.lastActivityAt = timestamp;
  if (stats.firstMintAt.equals(ZERO)) {
    stats.firstMintAt = timestamp;
  }

  let toHolder = getOrCreateHolder(event.params.to, timestamp);
  const prevBalance = toHolder.balance;
  toHolder.balance = toHolder.balance.plus(event.params.amount);
  toHolder.totalReceived = toHolder.totalReceived.plus(event.params.amount);
  toHolder.lastActivityAt = timestamp;
  if (prevBalance.equals(ZERO) && toHolder.balance.gt(ZERO)) {
    stats.totalHolders = stats.totalHolders + 1;
  }
  toHolder.save();
  
  stats.save();
}

/**
 * Handle PointsBurned event (post-upgrade only)
 * Creates ScrubPointBurn entity with totalSupply info
 */
export function handlePointsBurned(event: PointsBurnedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.block.timestamp;
  
  let stats = getOrCreateStats();
  
  const burn = new ScrubPointBurn(id);
  burn.burner = event.params.from;
  burn.amount = event.params.amount;
  burn.totalSupply = event.params.newTotalSupply;
  burn.timestamp = timestamp;
  burn.blockNumber = event.block.number;
  burn.transactionHash = event.transaction.hash;
  burn.save();

  stats.totalBurns = stats.totalBurns + 1;
  stats.totalSupply = event.params.newTotalSupply;
  stats.lastActivityAt = timestamp;

  let fromHolder = getOrCreateHolder(event.params.from, timestamp);
  const prevBalance = fromHolder.balance;
  fromHolder.balance = fromHolder.balance.minus(event.params.amount);
  fromHolder.totalBurned = fromHolder.totalBurned.plus(event.params.amount);
  fromHolder.lastActivityAt = timestamp;
  if (prevBalance.gt(ZERO) && fromHolder.balance.equals(ZERO)) {
    stats.totalHolders = stats.totalHolders - 1;
  }
  fromHolder.save();
  
  stats.save();
}

/**
 * Handle PointsForceBurned event (post-upgrade only)
 * Creates ScrubPointForceBurn entity with burner info
 */
export function handlePointsForceBurned(event: PointsForceBurnedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.block.timestamp;
  
  let stats = getOrCreateStats();
  
  const forceBurn = new ScrubPointForceBurn(id);
  forceBurn.from = event.params.from;
  forceBurn.burner = event.params.burner;
  forceBurn.amount = event.params.amount;
  forceBurn.totalSupply = event.params.newTotalSupply;
  forceBurn.timestamp = timestamp;
  forceBurn.blockNumber = event.block.number;
  forceBurn.transactionHash = event.transaction.hash;
  forceBurn.save();

  stats.totalForceBurns = stats.totalForceBurns + 1;
  stats.totalSupply = event.params.newTotalSupply;
  stats.lastActivityAt = timestamp;

  let fromHolder = getOrCreateHolder(event.params.from, timestamp);
  const prevBalance = fromHolder.balance;
  fromHolder.balance = fromHolder.balance.minus(event.params.amount);
  fromHolder.totalBurned = fromHolder.totalBurned.plus(event.params.amount);
  fromHolder.lastActivityAt = timestamp;
  if (prevBalance.gt(ZERO) && fromHolder.balance.equals(ZERO)) {
    stats.totalHolders = stats.totalHolders - 1;
  }
  fromHolder.save();
  
  stats.save();
}

/**
 * Handle Transfer event
 * - Always tracks all transfers in ScrubPointTransfer entity
 * - PRE-UPGRADE (block < UPGRADE_BLOCK): Creates mint/burn entities from Transfer(0x0) 
 * - POST-UPGRADE (block >= UPGRADE_BLOCK): Only tracks transfers, mint/burn handled by custom events
 */
export function handleTransfer(event: TransferEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.block.timestamp;
  const value = event.params.value;

  let stats = getOrCreateStats();
  stats.totalTransfers = stats.totalTransfers + 1;
  stats.lastActivityAt = timestamp;

  const transfer = new ScrubPointTransfer(id);
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.amount = value;
  transfer.timestamp = timestamp;
  transfer.blockNumber = event.block.number;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  const isPreUpgrade = event.block.number.lt(UPGRADE_BLOCK);

  if (event.params.from.equals(ZERO_ADDRESS)) {
    // Mint detected (from zero address)
    
    // Only create ScrubPointMint entity if PRE-UPGRADE
    // Post-upgrade, handlePointsMinted will create it
    if (isPreUpgrade) {
      const mint = new ScrubPointMint(id);
      mint.recipient = event.params.to;
      mint.amount = value;
      mint.totalSupply = ZERO; // We don't have totalSupply in Transfer event
      mint.timestamp = timestamp;
      mint.blockNumber = event.block.number;
      mint.transactionHash = event.transaction.hash;
      mint.save();

      stats.totalMints = stats.totalMints + 1;
      if (stats.firstMintAt.equals(ZERO)) {
        stats.firstMintAt = timestamp;
      }
    }

    // Always update holder balance
    let toHolder = getOrCreateHolder(event.params.to, timestamp);
    const prevToBalance = toHolder.balance;
    toHolder.balance = prevToBalance.plus(value);
    toHolder.totalReceived = toHolder.totalReceived.plus(value);
    toHolder.lastActivityAt = timestamp;
    if (prevToBalance.equals(ZERO) && toHolder.balance.gt(ZERO)) {
      stats.totalHolders = stats.totalHolders + 1;
    }
    toHolder.save();

  } else if (event.params.to.equals(ZERO_ADDRESS)) {
    // Burn detected (to zero address)
    
    // Only create ScrubPointBurn entity if PRE-UPGRADE
    // Post-upgrade, handlePointsBurned or handlePointsForceBurned will create it
    if (isPreUpgrade) {
      const burn = new ScrubPointBurn(id);
      burn.burner = event.params.from;
      burn.amount = value;
      burn.totalSupply = ZERO; // We don't have totalSupply in Transfer event
      burn.timestamp = timestamp;
      burn.blockNumber = event.block.number;
      burn.transactionHash = event.transaction.hash;
      burn.save();

      stats.totalBurns = stats.totalBurns + 1;
    }

    // Always update holder balance
    let fromHolder = getOrCreateHolder(event.params.from, timestamp);
    const prevFromBalance = fromHolder.balance;
    fromHolder.balance = prevFromBalance.minus(value);
    fromHolder.totalBurned = fromHolder.totalBurned.plus(value);
    fromHolder.lastActivityAt = timestamp;
    if (prevFromBalance.gt(ZERO) && fromHolder.balance.equals(ZERO)) {
      stats.totalHolders = stats.totalHolders - 1;
    }
    fromHolder.save();

  } else {
    // Standard transfer
    let fromHolder = getOrCreateHolder(event.params.from, timestamp);
    const prevFromBalance = fromHolder.balance;
    fromHolder.balance = prevFromBalance.minus(value);
    fromHolder.totalSent = fromHolder.totalSent.plus(value);
    fromHolder.lastActivityAt = timestamp;
    if (prevFromBalance.gt(ZERO) && fromHolder.balance.equals(ZERO)) {
      stats.totalHolders = stats.totalHolders - 1;
    }
    fromHolder.save();

    let toHolder = getOrCreateHolder(event.params.to, timestamp);
    const prevToBalance = toHolder.balance;
    toHolder.balance = prevToBalance.plus(value);
    toHolder.totalReceived = toHolder.totalReceived.plus(value);
    toHolder.lastActivityAt = timestamp;
    if (prevToBalance.equals(ZERO) && toHolder.balance.gt(ZERO)) {
      stats.totalHolders = stats.totalHolders + 1;
    }
    toHolder.save();
  }

  stats.save();
}
