import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    Transfer as TransferEvent
} from "../generated/ScrubPoint/ScrubPoint";
import {
    ScrubPointBurn,
    ScrubPointHolder,
    ScrubPointMint,
    ScrubPointStats,
    ScrubPointTransfer
} from "../generated/schema";

const ZERO_ADDRESS = Address.zero();
const ZERO = BigInt.fromI32(0);
const STATS_ID = "singleton";

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

  if (event.params.from.equals(ZERO_ADDRESS)) {
    // Mint - create ScrubPointMint entity
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
    // Burn - create ScrubPointBurn entity
    const burn = new ScrubPointBurn(id);
    burn.burner = event.params.from;
    burn.amount = value;
    burn.totalSupply = ZERO; // We don't have totalSupply in Transfer event
    burn.timestamp = timestamp;
    burn.blockNumber = event.block.number;
    burn.transactionHash = event.transaction.hash;
    burn.save();

    stats.totalBurns = stats.totalBurns + 1;

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
