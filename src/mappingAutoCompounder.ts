import { BigInt, dataSource, log } from "@graphprotocol/graph-ts";
import {
    Vault,
    VaultDeposit,
    VaultUser,
    VaultWithdraw
} from "../generated/schema";
import {
    AutoCompounder,
    Compound,
    Deposit,
    Withdraw,
} from "../generated/templates/AutoCompounder/AutoCompounder";

/**
 * Get or create a Vault entity
 */
function getOrCreateVault(vaultAddress: string): Vault {
  let vault = Vault.load(vaultAddress);
  
  if (!vault) {
    log.warning("Vault {} not found, creating minimal entity", [vaultAddress]);
    vault = new Vault(vaultAddress);
    
    // Try to get context data if available
    const context = dataSource.context();
    vault.underlying = context.getBytes("underlying");
    vault.decimals = context.getBigInt("decimals");
    vault.tokenName = context.getString("tokenName");
    
    // Initialize totals
    vault.totalShares = BigInt.fromI32(0);
    vault.totalUsers = BigInt.fromI32(0);
    vault.shareValue = BigInt.fromI32(10).pow(18); // Default 1:1
    vault.paused = false;
    
    vault.save();
  }
  
  return vault;
}

/**
 * Handle Deposit events from AutoCompounder vaults
 * Updates VaultUser totals and creates transaction record
 */
export function handleAutoCompounderDeposit(event: Deposit): void {
  log.info("AutoCompounder deposit detected for vault {} user {} amount {}", [
    event.address.toHex(),
    event.params.user.toHex(),
    event.params.amount.toString(),
  ]);

  const context = dataSource.context();
  const vaultAddress = event.address.toHex();
  const userAddress = event.params.user.toHex();
  const decimals = context.getBigInt("decimals").toI32() as u8;
  
  // Ensure vault exists
  const vault = getOrCreateVault(vaultAddress);
  
  // Normalize amount by decimals for display purposes
  const normalizedAmount = event.params.amount.div(
    BigInt.fromI32(10).pow(decimals)
  );

  // Create deposit transaction record
  const depositId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let vaultDeposit = new VaultDeposit(depositId);
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = normalizedAmount;
  vaultDeposit.timestamp = event.block.timestamp;
  vaultDeposit.vault = vaultAddress;
  vaultDeposit.requestedAt = event.block.timestamp;
  vaultDeposit.processedAt = event.block.timestamp; // AutoCompounder deposits are instant
  vaultDeposit.status = "processed";
  vaultDeposit.fee = BigInt.fromI32(0); // AutoCompounder has no deposit fee
  vaultDeposit.sharesMinted = event.params.shares; // Shares minted from event
  vaultDeposit.save();

  // Update or create VaultUser entity
  const vaultUserId = vaultAddress + "-" + userAddress;
  let vaultUser = VaultUser.load(vaultUserId);
  
  const isNewUser = vaultUser === null;
  
  if (!vaultUser) {
    vaultUser = new VaultUser(vaultUserId);
    vaultUser.vault = vaultAddress;
    vaultUser.user = event.params.user;
    vaultUser.shareBalance = BigInt.fromI32(0);
    vaultUser.pendingWithdrawalShares = BigInt.fromI32(0);
    vaultUser.pendingDepositCount = BigInt.fromI32(0);
    vaultUser.pendingWithdrawalCount = BigInt.fromI32(0);
    vaultUser.totalDeposited = BigInt.fromI32(0);
    vaultUser.totalWithdrawn = BigInt.fromI32(0);
    vaultUser.lastInteractionTimestamp = event.block.timestamp;
  }

  // FETCH current values from contract (don't accumulate!)
  const autoCompounderContract = AutoCompounder.bind(event.address);
  
  // Defensive: handle potential ABI mismatches gracefully
  const depositedResult = autoCompounderContract.try_deposited(event.params.user);
  if (!depositedResult.reverted) {
    vaultUser.totalDeposited = depositedResult.value;
  } else {
    log.warning("Failed to fetch deposited for user {} in vault {}, using event accumulation", [
      userAddress,
      vaultAddress
    ]);
    // Fallback: accumulate from events
    vaultUser.totalDeposited = vaultUser.totalDeposited.plus(normalizedAmount);
  }
  
  const withdrawnResult = autoCompounderContract.try_withdrawn(event.params.user);
  if (!withdrawnResult.reverted) {
    vaultUser.totalWithdrawn = withdrawnResult.value;
  } else {
    log.warning("Failed to fetch withdrawn for user {} in vault {}", [
      userAddress,
      vaultAddress
    ]);
  }
  
  vaultUser.shareBalance = vaultUser.shareBalance.plus(event.params.shares);
  vaultUser.lastInteractionTimestamp = event.block.timestamp;
  vaultUser.save();

  // Fetch current vault state from contract
  const totalSupplyResult = autoCompounderContract.try_totalSupply();
  const totalCollateralResult = autoCompounderContract.try_totalCollateral();
  
  if (!totalSupplyResult.reverted) {
    vault.totalShares = totalSupplyResult.value;
  }
  if (!totalCollateralResult.reverted) {
    vault.tvl = totalCollateralResult.value;
  }
  
  // Update totalUsers count
  if (!vault.totalUsers) {
    vault.totalUsers = BigInt.fromI32(0);
  }
  if (isNewUser) {
    vault.totalUsers = vault.totalUsers!.plus(BigInt.fromI32(1));
  }
  vault.save();

  log.info("Updated VaultUser {} totalDeposited: {} shareBalance: {}", [
    vaultUserId,
    vaultUser.totalDeposited.toString(),
    vaultUser.shareBalance.toString(),
  ]);
  log.info("Updated Vault {} totalShares: {} totalUsers: {}", [
    vaultAddress,
    vault.totalShares ? vault.totalShares!.toString() : "null",
    vault.totalUsers ? vault.totalUsers!.toString() : "null",
  ]);
}

/**
 * Handle Withdraw events from AutoCompounder vaults
 * Updates VaultUser totals and creates transaction record
 */
export function handleAutoCompounderWithdraw(event: Withdraw): void {
  log.info("AutoCompounder withdraw detected for vault {} user {} amount {}", [
    event.address.toHex(),
    event.params.user.toHex(),
    event.params.amount.toString(),
  ]);

  const context = dataSource.context();
  const vaultAddress = event.address.toHex();
  const userAddress = event.params.user.toHex();
  const decimals = context.getBigInt("decimals").toI32() as u8;
  
  // Ensure vault exists
  const vault = getOrCreateVault(vaultAddress);
  
  // Normalize amount by decimals for display purposes
  const normalizedAmount = event.params.amount.div(
    BigInt.fromI32(10).pow(decimals)
  );

  // Create withdrawal transaction record
  const withdrawId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let vaultWithdraw = new VaultWithdraw(withdrawId);
  vaultWithdraw.user = event.params.user;
  vaultWithdraw.amount = normalizedAmount;
  vaultWithdraw.timestamp = event.block.timestamp;
  vaultWithdraw.vault = vaultAddress;
  vaultWithdraw.requestedAt = event.block.timestamp;
  vaultWithdraw.processedAt = event.block.timestamp; // AutoCompounder withdrawals are instant
  vaultWithdraw.status = "processed";
  vaultWithdraw.fee = BigInt.fromI32(0); // AutoCompounder has no withdrawal fee
  vaultWithdraw.shares = event.params.shares; // Shares burned from event
  vaultWithdraw.canBeApprovedAt = event.block.timestamp;
  vaultWithdraw.save();

  // Update VaultUser entity
  const vaultUserId = vaultAddress + "-" + userAddress;
  let vaultUser = VaultUser.load(vaultUserId);
  
  if (!vaultUser) {
    // This shouldn't happen, but create it just in case
    log.warning("VaultUser {} not found for withdrawal, creating new", [vaultUserId]);
    vaultUser = new VaultUser(vaultUserId);
    vaultUser.vault = vaultAddress;
    vaultUser.user = event.params.user;
    vaultUser.shareBalance = BigInt.fromI32(0);
    vaultUser.pendingWithdrawalShares = BigInt.fromI32(0);
    vaultUser.pendingDepositCount = BigInt.fromI32(0);
    vaultUser.pendingWithdrawalCount = BigInt.fromI32(0);
    vaultUser.totalDeposited = BigInt.fromI32(0);
    vaultUser.totalWithdrawn = BigInt.fromI32(0);
    vaultUser.lastInteractionTimestamp = event.block.timestamp;
  }

  // FETCH current values from contract (don't accumulate!)
  const autoCompounderContract = AutoCompounder.bind(event.address);
  
  // Defensive: handle potential ABI mismatches gracefully
  const depositedResult = autoCompounderContract.try_deposited(event.params.user);
  if (!depositedResult.reverted) {
    vaultUser.totalDeposited = depositedResult.value;
  } else {
    log.warning("Failed to fetch deposited for user {} in vault {} during withdrawal", [
      userAddress,
      vaultAddress
    ]);
  }
  
  const withdrawnResult = autoCompounderContract.try_withdrawn(event.params.user);
  if (!withdrawnResult.reverted) {
    vaultUser.totalWithdrawn = withdrawnResult.value;
  } else {
    log.warning("Failed to fetch withdrawn for user {} in vault {}, using event accumulation", [
      userAddress,
      vaultAddress
    ]);
    // Fallback: accumulate from events
    vaultUser.totalWithdrawn = vaultUser.totalWithdrawn.plus(normalizedAmount);
  }
  
  vaultUser.shareBalance = vaultUser.shareBalance.minus(event.params.shares);
  vaultUser.lastInteractionTimestamp = event.block.timestamp;
  vaultUser.save();

  // Fetch current vault state from contract
  const totalSupplyResult = autoCompounderContract.try_totalSupply();
  const totalCollateralResult = autoCompounderContract.try_totalCollateral();
  
  if (!totalSupplyResult.reverted) {
    vault.totalShares = totalSupplyResult.value;
  }
  if (!totalCollateralResult.reverted) {
    vault.tvl = totalCollateralResult.value;
  }
  
  // Update totalUsers count
  if (!vault.totalUsers) {
    vault.totalUsers = BigInt.fromI32(0);
  }
  // If user has 0 shares left, decrement totalUsers
  if (vaultUser.shareBalance.equals(BigInt.fromI32(0))) {
    vault.totalUsers = vault.totalUsers!.minus(BigInt.fromI32(1));
  }
  vault.save();

  log.info("Updated VaultUser {} totalWithdrawn: {} shareBalance: {}", [
    vaultUserId,
    vaultUser.totalWithdrawn.toString(),
    vaultUser.shareBalance.toString(),
  ]);
  log.info("Updated Vault {} totalShares: {} totalUsers: {}", [
    vaultAddress,
    vault.totalShares ? vault.totalShares!.toString() : "null",
    vault.totalUsers ? vault.totalUsers!.toString() : "null",
  ]);
}

/**
 * Handle Compound events from AutoCompounder vaults
 * Updates lastCompoundTimestamp and fetches current vault state
 */
export function handleAutoCompounderCompound(event: Compound): void {
  const vaultAddress = event.address.toHex();
  
  log.info("AutoCompounder compound detected for vault {} at timestamp {}", [
    vaultAddress,
    event.params.timestamp.toString(),
  ]);

  // Ensure vault exists
  const vault = getOrCreateVault(vaultAddress);
  
  // Update last compound timestamp
  vault.lastCompoundTimestamp = event.params.timestamp;
  
  // Fetch current vault state from contract
  const autoCompounderContract = AutoCompounder.bind(event.address);
  const totalSupplyResult = autoCompounderContract.try_totalSupply();
  const totalCollateralResult = autoCompounderContract.try_totalCollateral();
  
  if (!totalSupplyResult.reverted) {
    vault.totalShares = totalSupplyResult.value;
  }
  if (!totalCollateralResult.reverted) {
    vault.tvl = totalCollateralResult.value;
  }
  
  vault.save();

  log.info("Updated Vault {} lastCompoundTimestamp: {} totalShares: {}", [
    vaultAddress,
    event.params.timestamp.toString(),
    vault.totalShares ? vault.totalShares!.toString() : "null",
  ]);
}
