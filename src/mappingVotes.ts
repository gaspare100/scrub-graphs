import { Deposit } from "../generated/VotingEscrow/VotingEscrow";
import { Voted, Voter } from "../generated/Voter/Voter";

import { Lock, Vote } from "../generated/schema";
import { Address, BigInt, log } from "@graphprotocol/graph-ts";

export function handleNewLock(event: Deposit): void {
  log.info("New lock detected!", []);
  if (Lock.load(event.params.tokenId.toString()) != null) {
    let newLock = new Lock(event.params.tokenId.toString());
    newLock.nftID = event.params.tokenId;
    newLock.user = event.transaction.from;
    newLock.amount = event.params.value;
    newLock.timestamp = event.block.timestamp;
    newLock.save();
  }
}

export function handleNewVote(event: Voted): void {
  log.info("New vote detected!", []);

  let lock = Lock.load(
    event.params.tokenId.toString() + "-" + event.transaction.hash.toHex()
  );

  if (lock != null) {
    let newVote = new Vote(
      event.params.tokenId.toString() + "-" + event.transaction.hash.toHex()
    );

    newVote.nftID = event.params.tokenId;
    newVote.user = event.transaction.from;
    let voter = Voter.bind(event.address);

    newVote.timestamp = event.block.timestamp;
    newVote.save();
  } else {
    log.info("Lock not found! Not tracking", []);
  }
}
