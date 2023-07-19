import {
  Deposit,
  RewardDistribution,
  Withdraw,
} from "../generated/WindAndCheck/WindAndCheck";
import {
  Vault,
  VaultDeposit,
  VaultReward,
  VaultWithdraw,
} from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";

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
    vault?.tvl.minus(event.params.amount);
    vault?.save();
  }
}

export function handleNewReward(event: RewardDistribution): void {
  log.info("New reward detected!", []);
  let vaultReward = new VaultReward(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultReward.reward = event.params.amount;
  vaultReward.apr = event.params.apy;
  vaultReward.vault = event.address.toHex();
  vaultReward.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.plus(event.params.amount);
    vault.apr = event.params.apy;
    vault.save();
  }
}
