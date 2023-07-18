import { Deposit } from "../generated/WindAndCheck/WindAndCheck";
import { VaultDeposit } from "../generated/schema";
export function handleNewDposit(event: Deposit): void {
  let vaultDeposit = new VaultDeposit(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  vaultDeposit.user = event.params.user;
  vaultDeposit.amount = event.params.amount;
  console.log("New deposit: " + vaultDeposit.id);
  vaultDeposit.save();
}
