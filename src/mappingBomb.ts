import { BombExploded, BombReset, BombStarted } from "../generated/Bomb/Bomb";

import { Reset, Bomb } from "../generated/schema";
import { BigInt, Bytes, DataSourceContext, log } from "@graphprotocol/graph-ts";
import { dataSource } from "@graphprotocol/graph-ts";

export function handleBombReset(event: BombReset): void {
  log.info("New reset detected!", []);
  let reset = Reset.load(event.transaction.hash.toHexString());
  if (reset == null) {
    reset = new Reset(event.transaction.hash.toHexString());
  }
  reset.bomb = event.address.toHexString() + "-" + event.params.run;
  reset.user = event.params.currentWinner;
  reset.timestamp = event.block.timestamp;
  reset.save();
}

export function handleBombStart(event: BombStarted): void {
  log.info("New bomb start detected!", []);
  let bomb = Bomb.load(event.address.toHexString() + "-" + event.params.run);
  if (bomb == null) {
    bomb = new Bomb(event.address.toHexString());
  }
  bomb.run = event.params.run;
  bomb.currentJackpot = event.params.currentBalance;
  bomb.currentWinner = Bytes.fromHexString(
    "0xD47D2f1543CdaE1284f20705a32B1362422cB652"
  );
  bomb.resets = [];
  bomb.save();
}

export function handleBombExploded(event: BombExploded): void {
  log.info("New bomb exploded detected!", []);
  let bomb = Bomb.load(event.address.toHexString()+"-"+event.params.run);
  if (bomb == null) {
    bomb = new Bomb(event.address.toHexString());
  }
  bomb.currentJackpot = event.params.wonAmount;
  bomb.currentWinner = event.params.winner;
  bomb.save();
}
