import { Deposit } from "../generated/VotingEscrow/VotingEscrow";
import { Voted, Voter } from "../generated/Voter/Voter";

import { Lock, Vote } from "../generated/schema";
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";

export function handleNewLock(event: Deposit): void {
  if (event.receipt == null) {
    log.info("Transaction not complete!", []);
    return;
  }
  if (event.receipt != null) {
    const receipt = event.receipt as ethereum.TransactionReceipt;
    const status = receipt.status as BigInt;
    if (status != null && !status.equals(BigInt.fromI32(1))) {
      log.info("Transaction failed!", []);
      return;
    }
  } else {
    log.info("Transaction failed!", []);
    return;
  }

  let lock = Lock.load(event.params.tokenId.toString());

  if (
    lock == null &&
    BigInt.fromI32(1).equals(BigInt.fromI32(event.params.deposit_type))
  ) {
    let newLock = new Lock(event.params.tokenId.toString());
    newLock.nftID = event.params.tokenId;
    newLock.user = event.transaction.from;
    newLock.amount = event.params.value.div(BigInt.fromI32(10).pow(18));
    newLock.deposited = event.params.value.div(BigInt.fromI32(10).pow(18));
    newLock.tx = event.transaction.hash;
    newLock.timestamp = event.block.timestamp;
    newLock.merged = false;
    newLock.save();
  } else if (
    lock != null &&
    BigInt.fromI32(2).equals(BigInt.fromI32(event.params.deposit_type))
  ) {
    log.info("Lock {} increased!", [event.params.tokenId.toString()]);
    lock.amount = lock.amount.plus(
      event.params.value.div(BigInt.fromI32(10).pow(18))
    );
    lock.deposited = lock.deposited.plus(
      event.params.value.div(BigInt.fromI32(10).pow(18))
    );
    lock.save();
  } else if (
    lock != null &&
    BigInt.fromI32(4).equals(BigInt.fromI32(event.params.deposit_type))
  ) {
    log.info("Lock {} merged!", [event.params.tokenId.toString()]);
    lock.merged = true;
    lock.amount = lock.amount.plus(
      event.params.value.div(BigInt.fromI32(10).pow(18))
    );
    lock.save();
  }
}

export function handleNewVote(event: Voted): void {
  if (event.receipt == null) {
    log.info("Transaction not complete!", []);
    return;
  }
  if (event.receipt != null) {
    const receipt = event.receipt as ethereum.TransactionReceipt;
    const status = receipt.status as BigInt;
    if (status != null && !status.equals(BigInt.fromI32(1))) {
      log.info("Transaction failed!", []);
      return;
    }
  } else {
    log.info("Transaction failed!", []);
    return;
  }

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
  newVote.amount = votes.div(BigInt.fromI32(10).pow(18));
  newVote.timestamp = event.block.timestamp;
  newVote.lock = lock ? lock.id : "";
  newVote.save();
}
