import {
  Deposit,
  RewardDistribution,
  Withdraw,
} from "../generated/WindAndCheck/WindAndCheck";

import { WindAndCheck } from "../generated/templates";

import { NewVault } from "../generated/WindAndCheckAggregator/WindAndCheckAggregator";
import {
  Vault,
  VaultDeposit,
  VaultReward,
  VaultWithdraw,
} from "../generated/schema";
import { BigInt, Bytes, DataSourceContext, log } from "@graphprotocol/graph-ts";
import { dataSource } from "@graphprotocol/graph-ts";

export function handleNewVault(event: NewVault): void {
  log.info("New vault detected!", []);
  let vault = Vault.load(event.params.vault.toHex());
  if (!vault) {
    vault = new Vault(event.params.vault.toHex());
  }
  vault.underlying = event.params.underlying;
  vault.decimals = event.params.decimals;
  vault.tvl = BigInt.fromI32(0);
  vault.apr = BigInt.fromI32(0);
  vault.tokenName = event.params.tokenName;
  vault.save();
  let context = new DataSourceContext();
  context.setBigInt("decimals", vault.decimals);
  context.setBytes("underlying", vault.underlying);
  context.setString("tokenName", vault.tokenName);
  WindAndCheck.createWithContext(event.params.vault, context);
}

export function handleNewDeposit(event: Deposit): void {
  log.info("New deposit detected!", []);
  let context = dataSource.context();

  let vaultDeposit = new VaultDeposit(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount.div(
    BigInt.fromI32(context.getBigInt("decimals"))
  );
  vaultDeposit.vault = event.address.toHex();
  vaultDeposit.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.plus(
      event.params.amount.div(BigInt.fromI32(context.getBigInt("decimals")))
    );
    vault.save();
  }
}

export function handleNewWithdraw(event: Withdraw): void {
  log.info("New withdraw detected!", []);
  let context = dataSource.context();

  let vaultWithdraw = new VaultWithdraw(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultWithdraw.user = event.params.user;
  vaultWithdraw.amount = event.params.amount.div(
    BigInt.fromI32(context.getBigInt("decimals"))
  );
  vaultWithdraw.vault = event.address.toHex();
  vaultWithdraw.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.minus(
      event.params.amount.div(BigInt.fromI32(context.getBigInt("decimals")))
    );
    vault.save();
  }
}

export function handleNewReward(event: RewardDistribution): void {
  log.info("New reward detected!", []);
  let context = dataSource.context();

  let vaultReward = new VaultReward(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  vaultReward.reward = event.params.amount.div(
    BigInt.fromI32(context.getBigInt("decimals"))
  );
  vaultReward.apr = event.params.apy.div(BigInt.fromI32(10000));
  vaultReward.vault = event.address.toHex();
  vaultReward.save();
  const vault = Vault.load(event.address.toHex());
  if (vault) {
    vault.tvl.plus(
      event.params.amount.div(BigInt.fromI32(context.getBigInt("decimals")))
    );
    vault.apr = event.params.apy.div(BigInt.fromI32(10000));
    vault.save();
  }
}
