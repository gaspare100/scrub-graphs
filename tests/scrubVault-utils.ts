import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import {
  VaultInitialized,
  DepositRequested,
  DepositProcessed,
  WithdrawalRequested,
  WithdrawalProcessed,
  RewardDistributed,
} from "../generated/ScrubDepositVault/DepositVault";

export function createVaultInitializedEvent(
  vault: Address,
  stablecoin: Address,
  strategy: Address,
  shareToken: Address,
  treasury: Address,
  initialShareValue: BigInt
): VaultInitialized {
  let vaultInitializedEvent = changetype<VaultInitialized>(newMockEvent());

  vaultInitializedEvent.parameters = new Array();

  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault))
  );
  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("stablecoin", ethereum.Value.fromAddress(stablecoin))
  );
  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("strategy", ethereum.Value.fromAddress(strategy))
  );
  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("shareToken", ethereum.Value.fromAddress(shareToken))
  );
  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("treasury", ethereum.Value.fromAddress(treasury))
  );
  vaultInitializedEvent.parameters.push(
    new ethereum.EventParam("initialShareValue", ethereum.Value.fromUnsignedBigInt(initialShareValue))
  );

  vaultInitializedEvent.address = vault;

  return vaultInitializedEvent;
}

export function createDepositRequestedEvent(
  depositId: BigInt,
  user: Address,
  amount: BigInt,
  fee: BigInt,
  timestamp: BigInt
): DepositRequested {
  let depositRequestedEvent = changetype<DepositRequested>(newMockEvent());

  depositRequestedEvent.parameters = new Array();

  depositRequestedEvent.parameters.push(
    new ethereum.EventParam("depositId", ethereum.Value.fromUnsignedBigInt(depositId))
  );
  depositRequestedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  );
  depositRequestedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  );
  depositRequestedEvent.parameters.push(
    new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee))
  );
  depositRequestedEvent.parameters.push(
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp))
  );

  return depositRequestedEvent;
}

export function createDepositProcessedEvent(
  depositId: BigInt,
  user: Address,
  usdAmount: BigInt,
  sharesMinted: BigInt,
  timestamp: BigInt
): DepositProcessed {
  let depositProcessedEvent = changetype<DepositProcessed>(newMockEvent());

  depositProcessedEvent.parameters = new Array();

  depositProcessedEvent.parameters.push(
    new ethereum.EventParam("depositId", ethereum.Value.fromUnsignedBigInt(depositId))
  );
  depositProcessedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  );
  depositProcessedEvent.parameters.push(
    new ethereum.EventParam("usdAmount", ethereum.Value.fromUnsignedBigInt(usdAmount))
  );
  depositProcessedEvent.parameters.push(
    new ethereum.EventParam("sharesMinted", ethereum.Value.fromUnsignedBigInt(sharesMinted))
  );
  depositProcessedEvent.parameters.push(
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp))
  );

  return depositProcessedEvent;
}

export function createWithdrawalRequestedEvent(
  withdrawalId: BigInt,
  user: Address,
  shares: BigInt,
  shareValueAtRequest: BigInt,
  expectedUsdAmount: BigInt,
  canBeApprovedAt: BigInt
): WithdrawalRequested {
  let withdrawalRequestedEvent = changetype<WithdrawalRequested>(newMockEvent());

  withdrawalRequestedEvent.parameters = new Array();

  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("withdrawalId", ethereum.Value.fromUnsignedBigInt(withdrawalId))
  );
  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  );
  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares))
  );
  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("shareValueAtRequest", ethereum.Value.fromUnsignedBigInt(shareValueAtRequest))
  );
  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("expectedUsdAmount", ethereum.Value.fromUnsignedBigInt(expectedUsdAmount))
  );
  withdrawalRequestedEvent.parameters.push(
    new ethereum.EventParam("canBeApprovedAt", ethereum.Value.fromUnsignedBigInt(canBeApprovedAt))
  );

  return withdrawalRequestedEvent;
}

export function createWithdrawalProcessedEvent(
  withdrawalId: BigInt,
  user: Address,
  shares: BigInt,
  shareValueAtProcessing: BigInt,
  usdAmount: BigInt,
  fee: BigInt,
  timestamp: BigInt
): WithdrawalProcessed {
  let withdrawalProcessedEvent = changetype<WithdrawalProcessed>(newMockEvent());

  withdrawalProcessedEvent.parameters = new Array();

  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("withdrawalId", ethereum.Value.fromUnsignedBigInt(withdrawalId))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("shareValueAtProcessing", ethereum.Value.fromUnsignedBigInt(shareValueAtProcessing))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("usdAmount", ethereum.Value.fromUnsignedBigInt(usdAmount))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee))
  );
  withdrawalProcessedEvent.parameters.push(
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp))
  );

  return withdrawalProcessedEvent;
}

export function createRewardDistributedEvent(
  rewardAmount: BigInt,
  newShareValue: BigInt,
  newTotalVaultValue: BigInt
): RewardDistributed {
  let rewardDistributedEvent = changetype<RewardDistributed>(newMockEvent());

  rewardDistributedEvent.parameters = new Array();

  rewardDistributedEvent.parameters.push(
    new ethereum.EventParam("rewardAmount", ethereum.Value.fromSignedBigInt(rewardAmount))
  );
  rewardDistributedEvent.parameters.push(
    new ethereum.EventParam("newShareValue", ethereum.Value.fromUnsignedBigInt(newShareValue))
  );
  rewardDistributedEvent.parameters.push(
    new ethereum.EventParam("newTotalVaultValue", ethereum.Value.fromUnsignedBigInt(newTotalVaultValue))
  );

  return rewardDistributedEvent;
}
