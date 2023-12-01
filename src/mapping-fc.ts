import { MatchUpdated } from "../generated/templates/Competition/ICompetition";
import {
  IEventCenter,
  MatchAdded,
} from "../generated/EventCenter/IEventCenter";

import {
  CompetitionInfo,
  BasicInfo,
  AdditionalInfo,
  BetInfo,
  BetInfoLoader,
  MatchedBet,
} from "../generated/schema";
import { Address, store } from "@graphprotocol/graph-ts";

import { Bytes, DataSourceContext, log } from "@graphprotocol/graph-ts";
import { Competition } from "../generated/templates";

const eventCenterAddress = Address.fromBytes(
  Bytes.fromHexString("0xa07deE8FF35fE2e2961a7e1006EAdA98E24aE82E")
);

export function handleMatchUpdated(event: MatchUpdated): void {
  //create or update competition
  createOrUpdateCompetitionInfo(event.address);
}

export function handleNewMatch(event: MatchAdded): void {
  //create or update competition
  createOrUpdateCompetitionInfo(event.params.param0);
  let context = new DataSourceContext();
  Competition.createWithContext(event.params.param0, context);
}

function createOrUpdateCompetitionInfo(competitionAddress: Address): void {
  let userAddress = "0x0000000000000000000000000000000000000000";
  // create new competition if not already created
  let competition = CompetitionInfo.load(competitionAddress.toHexString());
  if (competition == null) {
    competition = new CompetitionInfo(competitionAddress.toHexString());
  }
  //fetch info from contract proxy
  let eventCenter = IEventCenter.bind(eventCenterAddress);
  let info = eventCenter.getCompetitionInfo(
    competitionAddress,
    eventCenterAddress
  );
  //basic info create if not already created

  let basicInfo = BasicInfo.load(competitionAddress.toHexString());
  if (basicInfo == null) {
    basicInfo = new BasicInfo(competitionAddress.toHexString());
  }
  /*
    competitionId: BigInt!
  contractAddress: Bytes!
  openStatus: Boolean!
  host: BigInt!
  guest: BigInt!
  result: BigInt!
  currentBetId: BigInt!
  totalAmountMatchedEffective: BigInt!
  competitionPendingAmount: BigInt!
  outright: Boolean!
  live: Boolean!
  hidden: Boolean!
  fee: BigInt!
  competitionsAddress: Bytes!
  startDate: BigInt!
  */
  basicInfo.competitionId = info.basicInfo.id;
  basicInfo.contractAddress = competitionAddress;
  basicInfo.openStatus = info.basicInfo.openStatus;
  basicInfo.host = info.basicInfo.host;
  basicInfo.guest = info.basicInfo.guest;
  basicInfo.result = info.basicInfo.result;
  basicInfo.currentBetId = info.basicInfo.currentBetId;
  basicInfo.totalAmountMatchedEffective =
    info.basicInfo.totalAmountMatchedEffective;
  basicInfo.competitionPendingAmount = info.basicInfo.competitionPendingAmount;
  basicInfo.outright = info.basicInfo.outright;
  basicInfo.live = info.basicInfo.live;
  basicInfo.hidden = info.basicInfo.hidden;
  basicInfo.fee = info.basicInfo.fee;
  basicInfo.competitionsAddress = info.basicInfo.competitionsAddress;
  basicInfo.startDate = info.basicInfo.startDate;
  basicInfo.save();
  //additional info create if not already created
  let additionalInfo = AdditionalInfo.load(competitionAddress.toHexString());
  if (additionalInfo == null) {
    additionalInfo = new AdditionalInfo(competitionAddress.toHexString());
  }
  /*
    id: String!
    additionalHome: String!
    additionalAway: String!
    betType: String!
    preview: Boolean!
  */
  additionalInfo.additionalHome = info.additionalInfo.additionalHome;
  additionalInfo.additionalAway = info.additionalInfo.additionalAway;
  additionalInfo.betType = info.additionalInfo.betType;
  additionalInfo.preview = info.additionalInfo.preview;
  additionalInfo.save();
  //remove all previous bets completely
  let bets = competition.bets.load();
  for (let i = 0; i < bets.length; i++) {
    //remove all previous matched bets completely
    let matchedBets = bets[i].matchedBetsList.load();
    for (let j = 0; j < matchedBets.length; j++) {
      store.remove("MatchedBet", matchedBets[j].id);
    }
    store.remove("BetInfo", bets[i].id);
  }
  // create new bets
  let betsList = info.bets;
  for (let i = 0; i < betsList.length; i++) {
    //create BetInfo
    let betInfo = new BetInfo(
      competitionAddress.toHexString() + "-" + betsList[i].id.toString()
    );
    /*
    id: String!
    betId: BigInt!
    competition: CompetitionInfo!
    backUser: Bytes!
    team: BigInt!
    pendingAmount: BigInt!
    totalMatched: BigInt!
    odd: BigInt!
    effectiveOdd: BigInt!
    collateral: BigInt!
    matchetBetsListLength: BigInt!
    matchedBetsList: [MatchedBet!]! @derivedFrom(field: "bet")
    settled: Boolean!
    */
    betInfo.betId = betsList[i].id;
    betInfo.competition = competitionAddress.toHexString();
    betInfo.backUser = betsList[i].backUser;
    betInfo.team = betsList[i].team;
    betInfo.pendingAmount = betsList[i].pendingAmount;
    betInfo.totalMatched = betsList[i].totalMatched;
    betInfo.odd = betsList[i].odd;
    betInfo.effectiveOdd = betsList[i].effectiveOdd;
    betInfo.collateral = betsList[i].collateral;
    betInfo.settled = betsList[i].settled;
    betInfo.save();
    //create MatchedBets
    let matchedBetsList = betsList[i].matchedBetsList;
    /*
      id: String!
      bet: BetInfo!
      layUser: Bytes!
      amount: BigInt!
    */
    for (let j = 0; j < matchedBetsList.length; j++) {
      let matchedBet = new MatchedBet(
        competitionAddress.toHexString() +
          "-" +
          betsList[i].id.toString() +
          "-" +
          j.toString()
      );
      matchedBet.bet = betInfo.id;
      matchedBet.layUser = matchedBetsList[j].layUser;
      matchedBet.amount = matchedBetsList[j].amount;
      matchedBet.save();
    }
  }

  //save
  competition.save();
}