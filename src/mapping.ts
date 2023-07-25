import {
  Deposit,
  RewardDistribution,
  Withdraw,
} from "../generated/WindAndCheck/WindAndCheck";

import { WindAndCheck } from "../generated/templates";

import {
  NewVault,
  UpdateVault,
} from "../generated/WindAndCheckAggregator/WindAndCheckAggregator";
import {
  Vault,
  VaultDeposit,
  VaultInfo,
  VaultReward,
  VaultWithdraw,
} from "../generated/schema";
import { BigInt, Bytes, DataSourceContext, log } from "@graphprotocol/graph-ts";
import { dataSource } from "@graphprotocol/graph-ts";

export function handleNewVault(event: NewVault): void {
  log.info("New vault detected!", []);
  let vault = Vault.load(event.params.vault.toHex());
  if (!vault) {
    vault = new Vault(event.params.vault.toHex()+);
  }
  vault.underlying = event.params.underlying;
  vault.decimals = event.params.decimals;
  vault.tokenName = event.params.tokenName;
  vault.save();
  // create new info
  const info = new VaultInfo(event.params.vault.toHex()+event.block.timestamp.toString());
  info.vault = event.params.vault.toHex();
  info.timestamp = event.block.timestamp;
  

  info.tvl = BigInt.fromI32(0);
  info.apr = BigInt.fromI32(0);
  info.totalSupplied = BigInt.fromI32(0);
  info.totalBorrowed = BigInt.fromI32(0);
  info.totalBorrowable = BigInt.fromI32(0);
  info.lastCompoundTimestamp = BigInt.fromI32(0);
  info.save();

  let context = new DataSourceContext();
  context.setBigInt("decimals", vault.decimals);
  context.setBytes("underlying", vault.underlying);
  context.setString("tokenName", vault.tokenName);
  WindAndCheck.createWithContext(event.params.vault, context);
}

export function handleUpdateVault(event: UpdateVault): void {
  log.info("Update vault detected!", []);
  let vault = Vault.load(event.params.vault.toHex());
  if (vault) {
    const info  = new VaultInfo(event.params.vault.toHex()+event.block.timestamp.toString());
    info.vault = event.params.vault.toHex();
    info.timestamp = event.block.timestamp;
    info.apr = event.params.apr.div(BigInt.fromI32(100000));
    info.tvl = event.params.tvl.div(
      BigInt.fromI32(10).pow(vault.decimals.toI32() as u8)
    );
    info.totalSupplied = event.params.totalSupplied.div(
      BigInt.fromI32(10).pow(vault.decimals.toI32() as u8)
    );
    info.totalBorrowed = event.params.totalBorrowed.div(
      BigInt.fromI32(10).pow(vault.decimals.toI32() as u8)
    );
    info.totalBorrowable = event.params.totalBorrowable.div(
      BigInt.fromI32(10).pow(vault.decimals.toI32() as u8)
    );
    info.lastCompoundTimestamp = event.params.lastCompounTime;

    vault.save();
  }
}

export function handleNewDeposit(event: Deposit): void {
  log.info("New deposit detected!", []);
  let context = dataSource.context();

  let vaultDeposit = new VaultDeposit(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount.div(
    BigInt.fromI32(10).pow(context.getBigInt("decimals").toI32() as u8)
  );
  vaultDeposit.vault = event.address.toHex();
  vaultDeposit.save();
}

export function handleNewWithdraw(event: Withdraw): void {
  log.info("New withdraw detected!", []);
  let context = dataSource.context();

  let vaultWithdraw = new VaultWithdraw(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultWithdraw.user = event.params.user;
  vaultWithdraw.amount = event.params.amount.div(
    BigInt.fromI32(10).pow(context.getBigInt("decimals").toI32() as u8)
  );
  vaultWithdraw.vault = event.address.toHex();
  vaultWithdraw.save();
 
}

export function handleNewReward(event: RewardDistribution): void {
  log.info("New reward detected!", []);
  return;
  let context = dataSource.context();

  let vaultReward = new VaultReward(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  vaultReward.reward = event.params.amount.div(
    BigInt.fromI32(10).pow(context.getBigInt("decimals").toI32() as u8)
  );
  vaultReward.apr = event.params.apy.div(BigInt.fromI32(10000));
  vaultReward.vault = event.address.toHex();
  vaultReward.timestamp = event.block.timestamp;
  vaultReward.save();
  const vault = Vault.load(event.address.toHex());
  
}
