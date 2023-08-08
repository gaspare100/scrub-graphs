import { Deposit } from "../generated/VotingEscrow/VotingEscrow";
import { Voted, Voter } from "../generated/Voter/Voter";

import { Lock, Vote } from "../generated/schema";
import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

export function handleNewLock(event: Deposit): void {
  log.info("New lock detected!", []);
  if (
    Lock.load(event.params.tokenId.toString()) == null &&
    event.params.deposit_type == BigInt.fromI32(1)
  ) {
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

  let lock = Lock.load(event.params.tokenId.toString());

  let newVote = new Vote(
    event.params.tokenId.toString() + "-" + event.transaction.hash.toHex()
  );
  newVote.nftID = event.params.tokenId;
  newVote.user = event.transaction.from;
  let voter = Voter.bind(event.address);
  let votes = voter.votes(
    event.params.tokenId,
    Address.fromBytes(
      Bytes.fromHexString("0x78Ef6D3E3d0da9B2248C11BE11743B4C573ADd25")
    )
  );
  newVote.pool = Address.fromBytes(
    Bytes.fromHexString("0x78Ef6D3E3d0da9B2248C11BE11743B4C573ADd25")
  );
  newVote.amount = votes;
  newVote.timestamp = event.block.timestamp;
  newVote.lock = lock ? lock.id : "";
  newVote.save();
}
