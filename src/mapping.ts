import { Deposit } from "../generated/WindAndCheck/WindAndCheck";
import { VaultDeposit } from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";
export function handleNewDeposit(event: Deposit): void {
  log.info("New deposit detected!", []);
  let vaultDeposit = new VaultDeposit(event.transaction.hash);
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount;
  vaultDeposit.save();
}
