import { Deposit, DepositCall } from "../generated/WindAndCheck/WindAndCheck";
import { VaultDeposit } from "../generated/schema";
import { log } from "@graphprotocol/graph-ts";

export function handleNewDeposit(call: DepositCall): void {
  log.info("New deposit detected!", []);
  let vaultDeposit = new VaultDeposit(call.transaction.hash);

  vaultDeposit.user = call.from;
  vaultDeposit.amount = call.inputs.amount;
  vaultDeposit.save();
}
