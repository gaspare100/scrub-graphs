import { Create_lockCall } from "../generated/VotingEscrow/VotingEscrow";
import { VoteCall } from "../generated/Voter/Voter";

import { Lock, Vote } from "../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";

export function handleNewLock(call: Create_lockCall): void {
  log.info("New lock detected!", []);
  let newLock = new Lock(call.outputs.value0.toString());
  newLock.nftID = call.outputs.value0;
  newLock.user = call.from;
  newLock.amount = call.inputs._value;
  newLock.timestamp = call.block.timestamp;
  newLock.save();
}

export function handleNewVote(call: VoteCall): void {
  log.info("New vote detected!", []);
  /*
  let lock = Lock.load(
    call.inputs.tokenId + "-" + call.transaction.hash.toHex()
  );

  if (lock != null) {
    let totalWeight = BigInt.fromI32(0);
    for (let i = 0; i < call.inputs._weights.length; i++) {
      totalWeight = totalWeight.plus(call.inputs._weights[i]);
    }
    for (let i = 0; i < call.inputs._poolVote.length; i++) {
      let newVote = new Vote(
        call.inputs.tokenId +
          "-" +
          call.inputs._poolVote[i] +
          "-" +
          call.transaction.hash.toHex() +
          "-" +
          i
      );

      newVote.nftID = call.inputs.tokenId;
      newVote.user = call.from;
      newVote.pool = call.inputs._poolVote[i];
      newVote.amount = call.inputs._weights[i]
        .times(lock?.amount)
        .div(totalWeight);
      newVote.timestamp = call.block.timestamp;
      newVote.save();
    }
  } else {
    log.info("Lock not found! Not tracking", []);
  }
  */
}
