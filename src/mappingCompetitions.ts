import { Bet, MatchedBet, Competition } from "../generated/schema";
import {
  NewMatch,
  UnmatchedBet,
  MatchedBet as MatchedBetEvent,
  EventCenter,
  EventCenter__getCompetitionInfoResultValue0Struct,
  EventCenter__getCompetitionInfoResultValue0BetsStruct,
  EventCenter__getCompetitionInfoResultValue0BetsMatchedBetsListStruct,
  CancelledBet,
  MatchClosed,
  MatchSettled,
} from "../generated/EventCenter/EventCenter";
import { Address, BigInt, Bytes, log, store } from "@graphprotocol/graph-ts";

function getCompetitionInfo(eventAddress: Bytes, match: Bytes) {
  let eventCenter = EventCenter.bind(eventAddress);
  let competitionInfo = eventCenter.getCompetitionInfo(match, match);
  return competitionInfo;
}

function updateMatchInfo(
  competition: Competition,
  competitionInfo: EventCenter__getCompetitionInfoResultValue0Struct
) {
  competition.matchId = competitionInfo.basicInfo.id;
  competition.openStatus = competitionInfo.basicInfo.openStatus;
  competition.host = competitionInfo.basicInfo.host;
  competition.guest = competitionInfo.basicInfo.guest;
  competition.result = competitionInfo.basicInfo.result;
  competition.currentBetId = competitionInfo.basicInfo.currentBetId;
  competition.totalAmountMatchedEffective =
    competitionInfo.basicInfo.totalAmountMatchedEffective;
  competition.competitionPendingAmount =
    competitionInfo.basicInfo.competitionPendingAmount;
  competition.outright = competitionInfo.basicInfo.outright;
  competition.live = competitionInfo.basicInfo.live;
  competition.hidden = competitionInfo.basicInfo.hidden;
  competition.startDate = competitionInfo.basicInfo.startDate;
  competition.additionalHome = competitionInfo.additionalInfo.additionalHome;
  competition.additionalAway = competitionInfo.additionalInfo.additionalAway;
  competition.betType = competitionInfo.additionalInfo.betType;
  competition.preview = competitionInfo.additionalInfo.preview;
  competition.save();
}

function updateBetInfo(
  newBet: Bet,
  bet: EventCenter__getCompetitionInfoResultValue0BetsStruct,
  newCompetition: Competition
) {
  newBet.betId = bet.id;
  newBet.competition = newCompetition.id;
  newBet.backUser = bet.backUser;
  newBet.team = bet.team;
  newBet.pendingAmount = bet.pendingAmount;
  newBet.totalMatched = bet.totalMatched;
  newBet.odd = bet.odd;
  newBet.effectiveOdd = bet.effectiveOdd;
  newBet.collateral = bet.collateral;
  newBet.settled = bet.settled;
  newBet.save();
}

function updateMatchedBetInfo(
  newMatchedBet: MatchedBet,
  matchedBet: EventCenter__getCompetitionInfoResultValue0BetsMatchedBetsListStruct,
  newBet: Bet
) {
  newMatchedBet.bet = newBet.id;
  newMatchedBet.layUser = matchedBet.layUser;
  newMatchedBet.amount = matchedBet.amount;
  newMatchedBet.save();
}

function createOrUpdateCompetition(
  eventAddress: Address,
  matchAddress: Address
) {
  let competition: Competition =
    Competition.load(matchAddress.toHex()) ??
    new Competition(matchAddress.toHex());
  let competitionInfo = getCompetitionInfo(eventAddress, matchAddress);

  updateMatchInfo(competition, competitionInfo);
  for (let i = 0; i < competitionInfo.bets.length; i++) {
    let bet = competitionInfo.bets[i];
    let newBet = Bet.load(matchAddress.toHex() + "-" + bet.id.toString());
    if (newBet == null) {
      newBet = new Bet(matchAddress.toHex() + "-" + bet.id.toString());
    }
    // remove all previos bets
    for (let j = 0; j < competition.bets.length; j++) {
      store.remove("Bet", competition.bets[j]);
    }
    updateBetInfo(newBet, bet, competition);
    for (let j = 0; j < bet.matchedBetsList.length; j++) {
      let matchedBet = bet.matchedBetsList[j];
      let newMatchedBet =
        MatchedBet.load(
          matchAddress.toHex() + "-" + bet.id.toString() + "-" + j.toString()
        ) ??
        new MatchedBet(
          matchAddress.toHex() + "-" + bet.id.toString() + "-" + j.toString()
        );

      updateMatchedBetInfo(newMatchedBet, matchedBet, newBet);
    }
  }
}

export function handleNewMatch(event: NewMatch): void {
  log.info("New match detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}

export function handleUnmatchedBet(event: UnmatchedBet): void {
  log.info("Unmatched bet detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}

export function handleMatchedBet(event: MatchedBetEvent): void {
  log.info("Matched bet detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}

export function handleCancelledBet(event: CancelledBet): void {
  log.info("Cancelled bet detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}

export function handleMatchClosed(event: MatchClosed): void {
  log.info("Match closed detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}

export function handleCompetitionSettled(event: MatchSettled): void {
  log.info("Competition settled detected!", []);
  let eventAddress = event.address;
  let matchAddress = event.params.param0;
  createOrUpdateCompetition(eventAddress, matchAddress);
}
