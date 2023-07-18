import { Deposit } from "../generated/WindAndCheck/WindAndCheck";
import { Transfer } from "../generated/ERC20/ERC20";
import { TransferEntity, VaultDeposit } from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";

export function handleNewDeposit(event: Deposit): void {
  log.info("New deposit detected!", []);
  let vaultDeposit = new VaultDeposit(event.transaction.hash.toHex()+"-"+event.logIndex.toString()));
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount;
  vaultDeposit.save();
}

export function handleNewTransfer(event: Transfer): void {
  log.info("New transfer detected!", []);
  let transfer = new TransferEntity(event.transaction.hash.toHex()+"-"+event.logIndex.toString()));
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.amount = event.params.value;
  transfer.save();
}
