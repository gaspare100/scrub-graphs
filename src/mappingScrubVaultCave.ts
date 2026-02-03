import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    InventoryDeposited as InventoryDepositedEvent,
    PointsDeposited as PointsDepositedEvent,
    PointsPurchased as PointsPurchasedEvent,
    PointsWithdrawn as PointsWithdrawnEvent,
    PriceUpdated as PriceUpdatedEvent,
    UsdtClaimed as UsdtClaimedEvent
} from "../generated/ScrubVaultCave/ScrubVaultCave";
import {
    CaveDeposit,
    CaveInventoryDeposit,
    CavePointPurchase,
    CavePriceUpdate,
    CaveStats,
    CaveUsdtClaim,
    CaveUser,
    CaveWithdrawal
} from "../generated/schema";

const ZERO = BigInt.fromI32(0);
const STATS_ID = "singleton";

function getOrCreateStats(): CaveStats {
  let stats = CaveStats.load(STATS_ID);
  if (!stats) {
    stats = new CaveStats(STATS_ID);
    stats.totalShares = ZERO;
    stats.totalDeposits = ZERO;
    stats.totalWithdrawals = ZERO;
    stats.totalInventory = ZERO;
    stats.totalPointsSold = ZERO;
    stats.totalUsdtCollected = ZERO;
    stats.uniqueDepositors = 0;
    stats.uniqueBuyers = 0;
    stats.uniqueClaimers = 0;
    stats.totalDepositCount = 0;
    stats.totalWithdrawalCount = 0;
    stats.totalPurchaseCount = 0;
    stats.totalClaimCount = 0;
    stats.currentPrice = ZERO;
    stats.priceUpdateCount = 0;
    stats.firstActivityAt = ZERO;
    stats.lastActivityAt = ZERO;
    stats.save();
  }
  return stats;
}

function getOrCreateUser(address: Address, timestamp: BigInt): CaveUser {
  const id = address.toHex();
  let user = CaveUser.load(id);
  if (!user) {
    user = new CaveUser(id);
    user.address = address;
    user.totalDeposits = ZERO;
    user.totalDepositCount = 0;
    user.totalWithdrawals = ZERO;
    user.totalWithdrawalCount = 0;
    user.currentShares = ZERO;
    user.totalPointsPurchased = ZERO;
    user.totalUsdtSpent = ZERO;
    user.purchaseCount = 0;
    user.totalUsdtClaimed = ZERO;
    user.claimCount = 0;
    user.firstActivityAt = timestamp;
    user.lastActivityAt = timestamp;
    user.save();
  }
  return user;
}

function updateFirstAndLastActivity(stats: CaveStats, timestamp: BigInt): void {
  if (stats.firstActivityAt.equals(ZERO)) {
    stats.firstActivityAt = timestamp;
  }
  stats.lastActivityAt = timestamp;
}

export function handlePointsDeposited(event: PointsDepositedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();
  let user = getOrCreateUser(event.params.user, timestamp);

  const deposit = new CaveDeposit(id);
  deposit.user = user.id;
  deposit.pointAmount = event.params.amount;
  deposit.sharesReceived = event.params.shares;
  deposit.totalSharesAfter = event.params.totalShares;
  deposit.timestamp = timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  if (user.totalDepositCount == 0) {
    stats.uniqueDepositors = stats.uniqueDepositors + 1;
  }

  user.totalDeposits = user.totalDeposits.plus(event.params.amount);
  user.totalDepositCount = user.totalDepositCount + 1;
  user.currentShares = user.currentShares.plus(event.params.shares);
  user.lastActivityAt = timestamp;
  user.save();

  stats.totalShares = event.params.totalShares;
  stats.totalDeposits = stats.totalDeposits.plus(event.params.amount);
  stats.totalDepositCount = stats.totalDepositCount + 1;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}

export function handlePointsWithdrawn(event: PointsWithdrawnEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();
  let user = getOrCreateUser(event.params.user, timestamp);

  const withdrawal = new CaveWithdrawal(id);
  withdrawal.user = user.id;
  withdrawal.sharesBurned = event.params.shares;
  withdrawal.pointsReceived = event.params.amount;
  withdrawal.totalSharesAfter = event.params.totalShares;
  withdrawal.timestamp = timestamp;
  withdrawal.blockNumber = event.block.number;
  withdrawal.transactionHash = event.transaction.hash;
  withdrawal.save();

  user.totalWithdrawals = user.totalWithdrawals.plus(event.params.amount);
  user.totalWithdrawalCount = user.totalWithdrawalCount + 1;
  user.currentShares = user.currentShares.minus(event.params.shares);
  user.lastActivityAt = timestamp;
  user.save();

  stats.totalShares = event.params.totalShares;
  stats.totalWithdrawals = stats.totalWithdrawals.plus(event.params.amount);
  stats.totalWithdrawalCount = stats.totalWithdrawalCount + 1;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}

export function handlePointsPurchased(event: PointsPurchasedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();
  let user = getOrCreateUser(event.params.buyer, timestamp);

  const purchase = new CavePointPurchase(id);
  purchase.buyer = user.id;
  purchase.pointAmount = event.params.pointAmount;
  purchase.usdtPaid = event.params.usdtPaid;
  purchase.pricePerToken = event.params.pricePerToken;
  purchase.timestamp = timestamp;
  purchase.blockNumber = event.block.number;
  purchase.transactionHash = event.transaction.hash;
  purchase.save();

  if (user.purchaseCount == 0) {
    stats.uniqueBuyers = stats.uniqueBuyers + 1;
  }

  user.totalPointsPurchased = user.totalPointsPurchased.plus(event.params.pointAmount);
  user.totalUsdtSpent = user.totalUsdtSpent.plus(event.params.usdtPaid);
  user.purchaseCount = user.purchaseCount + 1;
  user.lastActivityAt = timestamp;
  user.save();

  stats.totalPointsSold = stats.totalPointsSold.plus(event.params.pointAmount);
  stats.totalUsdtCollected = stats.totalUsdtCollected.plus(event.params.usdtPaid);
  stats.totalPurchaseCount = stats.totalPurchaseCount + 1;
  stats.currentPrice = event.params.pricePerToken;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}

export function handleUsdtClaimed(event: UsdtClaimedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();
  let user = getOrCreateUser(event.params.user, timestamp);

  const claim = new CaveUsdtClaim(id);
  claim.user = user.id;
  claim.amount = event.params.amount;
  claim.totalClaimedByUser = event.params.totalClaimed;
  claim.timestamp = timestamp;
  claim.blockNumber = event.block.number;
  claim.transactionHash = event.transaction.hash;
  claim.save();

  if (user.claimCount == 0) {
    stats.uniqueClaimers = stats.uniqueClaimers + 1;
  }

  user.totalUsdtClaimed = event.params.totalClaimed;
  user.claimCount = user.claimCount + 1;
  user.lastActivityAt = timestamp;
  user.save();

  stats.totalClaimCount = stats.totalClaimCount + 1;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}

export function handlePriceUpdated(event: PriceUpdatedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();

  const update = new CavePriceUpdate(id);
  update.oldPrice = event.params.oldPrice;
  update.newPrice = event.params.newPrice;
  update.timestamp = timestamp;
  update.blockNumber = event.block.number;
  update.transactionHash = event.transaction.hash;
  update.save();

  stats.currentPrice = event.params.newPrice;
  stats.priceUpdateCount = stats.priceUpdateCount + 1;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}

export function handleInventoryDeposited(event: InventoryDepositedEvent): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const timestamp = event.params.timestamp;

  let stats = getOrCreateStats();

  const deposit = new CaveInventoryDeposit(id);
  deposit.owner = event.params.owner;
  deposit.amount = event.params.amount;
  deposit.totalInventoryAfter = event.params.totalInventory;
  deposit.timestamp = timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  stats.totalInventory = event.params.totalInventory;
  updateFirstAndLastActivity(stats, timestamp);
  stats.save();
}
