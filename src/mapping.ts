import {
  Deposit,
  RewardDistribution,
  WindAndCheck,
  Withdraw,
} from "../generated/WindAndCheck/WindAndCheck";
import { NewVault } from "../generated/WindAndCheckAggregator/WindAndCheckAggregator";
import {
  Vault,
  VaultDeposit,
  VaultReward,
  VaultWithdraw,
} from "../generated/schema";
import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

export function handleNewVault(event: NewVault): void {
  log.info("New vault detected!", []);
  if (Vault.load(event.params.vault.toHex())) {
    return;
  }
  let vault = new Vault(event.params.vault.toHex());
  vault.underlying = event.params.underlying;
  vault.decimals = event.params.decimals;
  vault.tvl = BigInt.fromI32(0);
  vault.apr = BigInt.fromI32(0);
  vault.tokenName = event.params.tokenName;
  vault.save();
}

export function handleNewDeposit(event: Deposit): void {
  log.info("New deposit detected!", []);
  let vaultDeposit = new VaultDeposit(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount;
  vaultDeposit.vault = event.address.toHex();
  vaultDeposit.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.plus(event.params.amount);
    vault.save();
  }
}

export function handleNewWithdraw(event: Withdraw): void {
  log.info("New withdraw detected!", []);
  let vaultWithdraw = new VaultWithdraw(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultWithdraw.user = event.params.user;
  vaultWithdraw.amount = event.params.amount;
  vaultWithdraw.vault = event.address.toHex();
  vaultWithdraw.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.minus(event.params.amount);
    vault.save();
  }
}

export function handleNewReward(event: RewardDistribution): void {
  log.info("New reward detected!", []);
  let vaultReward = new VaultReward(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultReward.reward = event.params.amount;
  vaultReward.apr = event.params.apy.div(BigInt.fromI32(1000));
  vaultReward.vault = event.address.toHex();
  vaultReward.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.plus(event.params.amount);
    vault.apr = event.params.apy.div(BigInt.fromI32(1000));
    vault.save();
  }
}
