import { Deposit } from "../generated/WindAndCheck/WindAndCheck";
import { VaultDeposit } from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";
export function handleNewDeposit(event: Deposit): void {
  let vaultDeposit = new VaultDeposit(event.transaction.hash.toHex());
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount;
  log.info("New deposit: {}", [vaultDeposit.id]);
  vaultDeposit.save();
}
