import { Create_lockCall } from "../generated/VotingEscrow/VotingEscrow";
import { VoteCall } from "../generated/Voter/Voter";

import { Lock, Vote } from "../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";

export function handleNewLock(call: Create_lockCall): void {
  log.info("New lock detected!", []);

}

export function handleNewVote(call: VoteCall): void {
  log.info("New vote detected!", []);

}
