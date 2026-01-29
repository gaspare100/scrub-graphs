import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
    DepositFeeUpdated as DepositFeeUpdatedEvent,
    DepositProcessed as DepositProcessedEvent,
    DepositRequested as DepositRequestedEvent,
    DepositVault as DepositVaultContract,
    MinDepositUpdated as MinDepositUpdatedEvent,
    MinWithdrawalSharesUpdated as MinWithdrawalSharesUpdatedEvent,
    RewardDistributed as RewardDistributedEvent,
    VaultInitialized as VaultInitializedEvent,
    WithdrawalFeeUpdated as WithdrawalFeeUpdatedEvent,
    WithdrawalProcessed as WithdrawalProcessedEvent,
    WithdrawalRequested as WithdrawalRequestedEvent,
} from "../generated/ScrubDepositVault/DepositVault";
import { Vault, VaultDeposit, VaultInfo, VaultReward, VaultUser, VaultWithdraw } from "../generated/schema";

function getOrCreateVaultUser(vaultId: string, userAddress: Address): VaultUser {
  const id = vaultId + "-" + userAddress.toHex();
  let vaultUser = VaultUser.load(id);
  
  if (!vaultUser) {
    vaultUser = new VaultUser(id);
    vaultUser.vault = vaultId;
    vaultUser.user = Bytes.fromHexString(userAddress.toHex());
    vaultUser.shareBalance = BigInt.fromI32(0);
    vaultUser.pendingDepositCount = BigInt.fromI32(0);
    vaultUser.pendingWithdrawalCount = BigInt.fromI32(0);
    vaultUser.totalDeposited = BigInt.fromI32(0);
    vaultUser.totalWithdrawn = BigInt.fromI32(0);
    vaultUser.lastInteractionTimestamp = BigInt.fromI32(0);
  }
  
  return vaultUser;
}

export function handleVaultInitialized(event: VaultInitializedEvent): void {
  log.info("ScrubVault initialized!", []);
  
  let vault = new Vault(event.params.vault.toHex());
  
  // Set vault type to distinguish from Hover vaults
  vault.vaultType = "scrub";
  
  // ScrubVault specific fields
  vault.underlying = event.params.stablecoin;
  vault.shareToken = event.params.shareToken;
  vault.strategy = event.params.strategy;
  vault.treasury = event.params.treasury;
  
  // Initialize counters
  vault.totalShares = BigInt.fromI32(0);
  vault.shareValue = BigInt.fromI32(0);
  vault.totalUsers = BigInt.fromI32(0);
  vault.totalPendingWithdrawalShares = BigInt.fromI32(0);
  vault.paused = false;
  
  // Initialize configurable fees and limits from contract
  let contract = DepositVaultContract.bind(event.params.vault);
  
  // Try to read config values, use defaults if contract call fails
  let depositFeeResult = contract.try_depositFee();
  vault.depositFee = depositFeeResult.reverted ? BigInt.fromI32(0) : depositFeeResult.value;
  
  let withdrawalFeeResult = contract.try_withdrawalFee();
  vault.withdrawalFee = withdrawalFeeResult.reverted ? BigInt.fromI32(0) : withdrawalFeeResult.value;
  
  let minDepositResult = contract.try_minDeposit();
  vault.minDeposit = minDepositResult.reverted ? BigInt.fromI32(0) : minDepositResult.value;
  
  let minWithdrawalSharesResult = contract.try_minWithdrawalShares();
  vault.minWithdrawalShares = minWithdrawalSharesResult.reverted ? BigInt.fromI32(0) : minWithdrawalSharesResult.value;
  
  // Fields compatible with existing Vault schema
  vault.decimals = BigInt.fromI32(6); // USDT decimals
  vault.tokenName = "USDT Vault";     // Display name
  
  vault.save();
  
  log.info("ScrubVault created: {}", [vault.id]);
}

export function handleDepositRequested(event: DepositRequestedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) {
    log.warning("Vault not found for deposit: {}", [event.address.toHex()]);
    return;
  }
  
  // Create deposit entity
  const depositId = event.address.toHex() + "-" + event.params.depositId.toString();
  let deposit = new VaultDeposit(depositId);
  
  deposit.vault = vault.id;
  deposit.user = event.params.user;
  deposit.amount = event.params.amount;      // Net amount (after fee)
  deposit.fee = event.params.fee;
  deposit.timestamp = event.params.timestamp;
  deposit.status = "pending";
  deposit.sharesMinted = BigInt.fromI32(0);  // Will be set when processed
  
  deposit.save();
  
  // Update user stats
  let vaultUser = getOrCreateVaultUser(vault.id, event.params.user);
  vaultUser.pendingDepositCount = vaultUser.pendingDepositCount.plus(BigInt.fromI32(1));
  // Don't add to totalDeposited yet - only when processed
  vaultUser.lastInteractionTimestamp = event.params.timestamp;
  vaultUser.save();
}

export function handleDepositProcessed(event: DepositProcessedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  const depositId = event.address.toHex() + "-" + event.params.depositId.toString();
  let deposit = VaultDeposit.load(depositId);
  
  if (deposit) {
    deposit.status = "processed";
    deposit.sharesMinted = event.params.sharesMinted;
    deposit.save();
    
    // Update user stats
    let vaultUser = getOrCreateVaultUser(vault.id, event.params.user);
    const isNewUser = vaultUser.totalDeposited.equals(BigInt.fromI32(0));
    
    vaultUser.shareBalance = vaultUser.shareBalance.plus(event.params.sharesMinted);
    vaultUser.pendingDepositCount = vaultUser.pendingDepositCount.minus(BigInt.fromI32(1));
    // Add to totalDeposited when deposit is processed (gross amount = amount + fee)
    const depositAmount = deposit.amount ? deposit.amount as BigInt : BigInt.fromI32(0);
    const depositFee = deposit.fee ? deposit.fee as BigInt : BigInt.fromI32(0);
    vaultUser.totalDeposited = vaultUser.totalDeposited.plus(depositAmount).plus(depositFee);
    vaultUser.lastInteractionTimestamp = event.params.timestamp;
    vaultUser.save();
    
    // Increment totalUsers if this is the user's first deposit
    if (isNewUser) {
      const currentTotalUsers = vault.totalUsers ? vault.totalUsers as BigInt : BigInt.fromI32(0);
      vault.totalUsers = currentTotalUsers.plus(BigInt.fromI32(1));
    }
  }
  
  // Update vault totals (initialize if null for backward compatibility)
  const currentShares = vault.totalShares ? vault.totalShares as BigInt : BigInt.fromI32(0);
  vault.totalShares = currentShares.plus(event.params.sharesMinted);
  
  // Update shareValue from contract
  let contract = DepositVaultContract.bind(event.address);
  let shareValueResult = contract.try_shareValue();
  if (!shareValueResult.reverted) {
    vault.shareValue = shareValueResult.value;
  }
  
  // Update VaultInfo for charts (compatible with existing schema)
  const infoId = vault.id + "-" + event.params.timestamp.toString();
  let info = new VaultInfo(infoId);
  info.vault = vault.id;
  info.timestamp = event.params.timestamp;
  info.tvl = event.params.usdAmount;
  info.apr = BigInt.fromI32(0);
  info.totalSupplied = vault.totalShares ? vault.totalShares as BigInt : BigInt.fromI32(0);
  info.totalBorrowed = BigInt.fromI32(0);
  info.totalBorrowable = BigInt.fromI32(0);
  info.lastCompoundTimestamp = event.params.timestamp;
  info.save();
  
  vault.save();
}

export function handleWithdrawalRequested(event: WithdrawalRequestedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  const withdrawalId = event.address.toHex() + "-" + event.params.withdrawalId.toString();
  let withdrawal = new VaultWithdraw(withdrawalId);
  
  withdrawal.vault = vault.id;
  withdrawal.user = event.params.user;
  withdrawal.shares = event.params.shares;
  withdrawal.amount = event.params.expectedUsdAmount;
  withdrawal.timestamp = event.params.timestamp;
  withdrawal.requestedAt = event.params.timestamp;
  withdrawal.canBeApprovedAt = event.params.canBeApprovedAt;
  withdrawal.status = "pending";
  withdrawal.fee = BigInt.fromI32(0);  // Will be calculated when processed
  
  withdrawal.save();
  
  // Update pending withdrawal shares
  const currentPendingShares = vault.totalPendingWithdrawalShares ? vault.totalPendingWithdrawalShares as BigInt : BigInt.fromI32(0);
  vault.totalPendingWithdrawalShares = currentPendingShares.plus(event.params.shares);
  vault.save();
  
  // Update user stats
  let vaultUser = getOrCreateVaultUser(vault.id, event.params.user);
  vaultUser.pendingWithdrawalCount = vaultUser.pendingWithdrawalCount.plus(BigInt.fromI32(1));
  vaultUser.lastInteractionTimestamp = event.params.timestamp;
  vaultUser.save();
}

export function handleWithdrawalProcessed(event: WithdrawalProcessedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  const withdrawalId = event.address.toHex() + "-" + event.params.withdrawalId.toString();
  let withdrawal = VaultWithdraw.load(withdrawalId);
  
  if (withdrawal) {
    withdrawal.status = "processed";
    withdrawal.amount = event.params.usdAmount;
    withdrawal.fee = event.params.fee;
    withdrawal.save();
    
    // Update user stats
    let vaultUser = getOrCreateVaultUser(vault.id, event.params.user);
    vaultUser.shareBalance = vaultUser.shareBalance.minus(event.params.shares);
    vaultUser.pendingWithdrawalCount = vaultUser.pendingWithdrawalCount.minus(BigInt.fromI32(1));
    vaultUser.totalWithdrawn = vaultUser.totalWithdrawn.plus(event.params.usdAmount);
    vaultUser.lastInteractionTimestamp = event.params.timestamp;
    vaultUser.save();
  }
  
  // Update vault totals
  const currentShares = vault.totalShares ? vault.totalShares as BigInt : BigInt.fromI32(0);
  const currentPendingShares = vault.totalPendingWithdrawalShares ? vault.totalPendingWithdrawalShares as BigInt : BigInt.fromI32(0);
  vault.totalShares = currentShares.minus(event.params.shares);
  vault.totalPendingWithdrawalShares = currentPendingShares.minus(event.params.shares);
  
  // Update shareValue from contract
  let contract = DepositVaultContract.bind(event.address);
  let shareValueResult = contract.try_shareValue();
  if (!shareValueResult.reverted) {
    vault.shareValue = shareValueResult.value;
  }
  
  vault.save();
}

export function handleRewardDistributed(event: RewardDistributedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  // Create reward event
  const rewardId = vault.id + "-reward-" + event.block.timestamp.toString();
  let reward = new VaultReward(rewardId);
  reward.vault = vault.id;
  reward.reward = event.params.rewardAmount;
  reward.timestamp = event.block.timestamp;
  reward.apr = BigInt.fromI32(0);  // Calculate if needed
  reward.save();
  
  // Update vault info
  const infoId = vault.id + "-" + event.block.timestamp.toString();
  let info = new VaultInfo(infoId);
  info.vault = vault.id;
  info.timestamp = event.block.timestamp;
  info.tvl = event.params.newTotalVaultValue;
  info.apr = BigInt.fromI32(0);
  info.totalSupplied = vault.totalShares ? vault.totalShares as BigInt : BigInt.fromI32(0);
  info.totalBorrowed = BigInt.fromI32(0);
  info.totalBorrowable = BigInt.fromI32(0);
  info.lastCompoundTimestamp = event.block.timestamp;
  info.save();
  
  // Update shareValue from contract after reward distribution
  let contract = DepositVaultContract.bind(event.address);
  let shareValueResult = contract.try_shareValue();
  if (!shareValueResult.reverted) {
    vault.shareValue = shareValueResult.value;
  }
  vault.save();
}

// Event Handler: DepositFeeUpdated
export function handleDepositFeeUpdated(event: DepositFeeUpdatedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  vault.depositFee = event.params.newFee;
  vault.save();
}

// Event Handler: WithdrawalFeeUpdated
export function handleWithdrawalFeeUpdated(event: WithdrawalFeeUpdatedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  vault.withdrawalFee = event.params.newFee;
  vault.save();
}

// Event Handler: MinDepositUpdated
export function handleMinDepositUpdated(event: MinDepositUpdatedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  vault.minDeposit = event.params.newMin;
  vault.save();
}

// Event Handler: MinWithdrawalSharesUpdated
export function handleMinWithdrawalSharesUpdated(event: MinWithdrawalSharesUpdatedEvent): void {
  let vault = Vault.load(event.address.toHex());
  if (!vault) return;
  
  vault.minWithdrawalShares = event.params.newMin;
  vault.save();
}
