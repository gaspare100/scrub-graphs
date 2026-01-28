import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    afterEach,
    assert,
    clearStore,
    describe,
    test,
} from "matchstick-as/assembly/index";
import {
    handleDepositProcessed,
    handleDepositRequested,
    handleRewardDistributed,
    handleVaultInitialized,
    handleWithdrawalProcessed,
    handleWithdrawalRequested,
    handleDepositFeeUpdated,
    handleWithdrawalFeeUpdated,
    handleMinDepositUpdated,
    handleMinWithdrawalSharesUpdated,
} from "../src/mappingScrubVault";
import {
    createDepositProcessedEvent,
    createDepositRequestedEvent,
    createRewardDistributedEvent,
    createVaultInitializedEvent,
    createWithdrawalProcessedEvent,
    createWithdrawalRequestedEvent,
    createDepositFeeUpdatedEvent,
    createWithdrawalFeeUpdatedEvent,
    createMinDepositUpdatedEvent,
    createMinWithdrawalSharesUpdatedEvent,
} from "./scrubVault-utils";

// Test constants
const VAULT_ADDRESS = "0x7BFf6c730dA681dF03364c955B165576186370Bc";
const USER1_ADDRESS = "0x1234567890123456789012345678901234567890";
const USER2_ADDRESS = "0x2345678901234567890123456789012345678901";
const USDT_ADDRESS = "0x919C1c267BC06a7039e03fcc2eF738525769109c";
const SHARE_TOKEN_ADDRESS = "0x31ce80494b2D285637929E6d64E1ac045dB77CA1";
const STRATEGY_ADDRESS = "0xD47D2f1543CdaE1284f20705a32B1362422cB652";

describe("ScrubVault Complete Tests", () => {
  afterEach(() => {
    clearStore();
  });

  test("VaultInitialized creates vault with all fields", () => {
    let event = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    
    handleVaultInitialized(event);

    const vaultId = VAULT_ADDRESS.toLowerCase();
    assert.entityCount("Vault", 1);
    assert.fieldEquals("Vault", vaultId, "vaultType", "scrub");
    assert.fieldEquals("Vault", vaultId, "underlying", USDT_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "shareToken", SHARE_TOKEN_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "strategy", STRATEGY_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "totalShares", "0");
    assert.fieldEquals("Vault", vaultId, "totalPendingWithdrawalShares", "0");
    assert.fieldEquals("Vault", vaultId, "paused", "false");
  });

  test("Complete deposit flow - request and process", () => {
    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    // Request deposit
    let depositId = BigInt.fromI32(1);
    let amount = BigInt.fromI32(1000000000); // 1000 USDT
    let fee = BigInt.fromI32(1000000); // 1 USDT
    
    let requestEvent = createDepositRequestedEvent(
      depositId,
      Address.fromString(USER1_ADDRESS),
      amount,
      fee,
      BigInt.fromI32(1706270400)
    );
    requestEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(requestEvent);

    // Verify pending deposit
    const vaultId = VAULT_ADDRESS.toLowerCase();
    const depositEntityId = vaultId + "-" + depositId.toString();
    assert.fieldEquals("VaultDeposit", depositEntityId, "status", "pending");
    assert.fieldEquals("VaultDeposit", depositEntityId, "amount", amount.toString());
    assert.fieldEquals("VaultDeposit", depositEntityId, "fee", fee.toString());

    // Verify user stats updated
    const userId = vaultId + "-" + USER1_ADDRESS.toLowerCase();
    assert.fieldEquals("VaultUser", userId, "pendingDepositCount", "1");
    assert.fieldEquals("VaultUser", userId, "totalDeposited", amount.plus(fee).toString());

    // Process deposit
    let sharesMinted = BigInt.fromI32(1000000000);
    let processEvent = createDepositProcessedEvent(
      depositId,
      Address.fromString(USER1_ADDRESS),
      amount,
      sharesMinted,
      BigInt.fromI32(1706270500)
    );
    processEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(processEvent);

    // Verify deposit processed
    assert.fieldEquals("VaultDeposit", depositEntityId, "status", "processed");
    assert.fieldEquals("VaultDeposit", depositEntityId, "sharesMinted", sharesMinted.toString());

    // Verify user shares updated
    assert.fieldEquals("VaultUser", userId, "shareBalance", sharesMinted.toString());
    assert.fieldEquals("VaultUser", userId, "pendingDepositCount", "0");

    // Verify vault totals
    assert.fieldEquals("Vault", vaultId, "totalShares", sharesMinted.toString());

    // Verify VaultInfo created
    assert.entityCount("VaultInfo", 1);
  });

  test("Complete withdrawal flow - request and process", () => {
    // Setup: Initialize vault and process a deposit first
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    let depositId = BigInt.fromI32(1);
    let depositAmount = BigInt.fromI32(1000000000);
    let sharesMinted = BigInt.fromI32(1000000000);
    
    let requestDepositEvent = createDepositRequestedEvent(
      depositId,
      Address.fromString(USER1_ADDRESS),
      depositAmount,
      BigInt.fromI32(1000000),
      BigInt.fromI32(1706270400)
    );
    requestDepositEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(requestDepositEvent);

    let processDepositEvent = createDepositProcessedEvent(
      depositId,
      Address.fromString(USER1_ADDRESS),
      depositAmount,
      sharesMinted,
      BigInt.fromI32(1706270500)
    );
    processDepositEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(processDepositEvent);

    // Request withdrawal
    let withdrawalId = BigInt.fromI32(1);
    let sharesToWithdraw = BigInt.fromI32(500000000); // Withdraw half
    let expectedUsdAmount = BigInt.fromI32(500000000);
    let canBeApprovedAt = BigInt.fromI32(1706270600);
    
    let requestWithdrawalEvent = createWithdrawalRequestedEvent(
      withdrawalId,
      Address.fromString(USER1_ADDRESS),
      sharesToWithdraw,
      BigInt.fromI32(1000000), // shareValueAtRequest
      expectedUsdAmount,
      canBeApprovedAt,
      BigInt.fromI32(1706270550)
    );
    requestWithdrawalEvent.address = Address.fromString(VAULT_ADDRESS);
    handleWithdrawalRequested(requestWithdrawalEvent);

    // Verify pending withdrawal
    const vaultId = VAULT_ADDRESS.toLowerCase();
    const withdrawalEntityId = vaultId + "-" + withdrawalId.toString();
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "status", "pending");
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "shares", sharesToWithdraw.toString());
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "amount", expectedUsdAmount.toString());

    // Verify user stats
    const userId = vaultId + "-" + USER1_ADDRESS.toLowerCase();
    assert.fieldEquals("VaultUser", userId, "pendingWithdrawalCount", "1");

    // Verify vault pending shares
    assert.fieldEquals("Vault", vaultId, "totalPendingWithdrawalShares", sharesToWithdraw.toString());

    // Process withdrawal
    let actualUsdAmount = BigInt.fromI32(498000000); // 500 USDT - 2 USDT fee
    let withdrawalFee = BigInt.fromI32(2000000);
    
    let processWithdrawalEvent = createWithdrawalProcessedEvent(
      withdrawalId,
      Address.fromString(USER1_ADDRESS),
      sharesToWithdraw,
      BigInt.fromI32(1000000), // shareValueAtProcessing
      actualUsdAmount,
      withdrawalFee,
      BigInt.fromI32(1706270650)
    );
    processWithdrawalEvent.address = Address.fromString(VAULT_ADDRESS);
    handleWithdrawalProcessed(processWithdrawalEvent);

    // Verify withdrawal processed
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "status", "processed");
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "amount", actualUsdAmount.toString());
    assert.fieldEquals("VaultWithdraw", withdrawalEntityId, "fee", withdrawalFee.toString());

    // Verify user shares reduced
    const remainingShares = sharesMinted.minus(sharesToWithdraw);
    assert.fieldEquals("VaultUser", userId, "shareBalance", remainingShares.toString());
    assert.fieldEquals("VaultUser", userId, "pendingWithdrawalCount", "0");
    assert.fieldEquals("VaultUser", userId, "totalWithdrawn", actualUsdAmount.toString());

    // Verify vault totals
    assert.fieldEquals("Vault", vaultId, "totalShares", remainingShares.toString());
    assert.fieldEquals("Vault", vaultId, "totalPendingWithdrawalShares", "0");
  });

  test("Multiple users - independent tracking", () => {
    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    // User 1 deposits
    let deposit1Event = createDepositRequestedEvent(
      BigInt.fromI32(1),
      Address.fromString(USER1_ADDRESS),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1000000),
      BigInt.fromI32(1706270400)
    );
    deposit1Event.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(deposit1Event);

    let process1Event = createDepositProcessedEvent(
      BigInt.fromI32(1),
      Address.fromString(USER1_ADDRESS),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1706270500)
    );
    process1Event.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(process1Event);

    // User 2 deposits
    let deposit2Event = createDepositRequestedEvent(
      BigInt.fromI32(2),
      Address.fromString(USER2_ADDRESS),
      BigInt.fromI32(500000000),
      BigInt.fromI32(500000),
      BigInt.fromI32(1706270600)
    );
    deposit2Event.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(deposit2Event);

    let process2Event = createDepositProcessedEvent(
      BigInt.fromI32(2),
      Address.fromString(USER2_ADDRESS),
      BigInt.fromI32(500000000),
      BigInt.fromI32(500000000),
      BigInt.fromI32(1706270700)
    );
    process2Event.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(process2Event);

    // Verify separate user tracking
    const vaultId = VAULT_ADDRESS.toLowerCase();
    const user1Id = vaultId + "-" + USER1_ADDRESS.toLowerCase();
    const user2Id = vaultId + "-" + USER2_ADDRESS.toLowerCase();

    assert.fieldEquals("VaultUser", user1Id, "shareBalance", "1000000000");
    assert.fieldEquals("VaultUser", user2Id, "shareBalance", "500000000");

    // Verify combined vault totals
    assert.fieldEquals("Vault", vaultId, "totalShares", "1500000000");
  });

  test("Reward distribution updates vault info", () => {
    // Initialize vault with deposits
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    let depositEvent = createDepositRequestedEvent(
      BigInt.fromI32(1),
      Address.fromString(USER1_ADDRESS),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1000000),
      BigInt.fromI32(1706270400)
    );
    depositEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(depositEvent);

    let processEvent = createDepositProcessedEvent(
      BigInt.fromI32(1),
      Address.fromString(USER1_ADDRESS),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1706270500)
    );
    processEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(processEvent);

    // Distribute reward
    let rewardEvent = createRewardDistributedEvent(
      BigInt.fromI32(50000000), // 50 USDT reward
      BigInt.fromI32(1050000), // New share value
      BigInt.fromI32(1050000000) // New total vault value
    );
    rewardEvent.address = Address.fromString(VAULT_ADDRESS);
    handleRewardDistributed(rewardEvent);

    // Verify reward entity created
    assert.entityCount("VaultReward", 1);

    // Verify VaultInfo updated
    assert.entityCount("VaultInfo", 2); // One from deposit, one from reward
  });

  test("Deposit fee update changes vault config", () => {    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    const vaultId = VAULT_ADDRESS.toLowerCase();
    
    // Update deposit fee
    let updateEvent = createDepositFeeUpdatedEvent(
      BigInt.fromI32(1000000), // Old: $1
      BigInt.fromI32(2000000)  // New: $2
    );
    updateEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositFeeUpdated(updateEvent);

    assert.fieldEquals("Vault", vaultId, "depositFee", "2000000");
  });

  test("Withdrawal fee update changes vault config", () => {
    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    const vaultId = VAULT_ADDRESS.toLowerCase();
    
    // Update withdrawal fee
    let updateEvent = createWithdrawalFeeUpdatedEvent(
      BigInt.fromI32(1000000), // Old: $1
      BigInt.fromI32(3000000)  // New: $3
    );
    updateEvent.address = Address.fromString(VAULT_ADDRESS);
    handleWithdrawalFeeUpdated(updateEvent);

    assert.fieldEquals("Vault", vaultId, "withdrawalFee", "3000000");
  });

  test("Min deposit update changes vault config", () => {
    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    const vaultId = VAULT_ADDRESS.toLowerCase();
    
    // Update min deposit
    let updateEvent = createMinDepositUpdatedEvent(
      BigInt.fromI32(100000000), // Old: $100
      BigInt.fromI32(10000000)   // New: $10
    );
    updateEvent.address = Address.fromString(VAULT_ADDRESS);
    handleMinDepositUpdated(updateEvent);

    assert.fieldEquals("Vault", vaultId, "minDeposit", "10000000");
  });

  test("Min withdrawal shares update changes vault config", () => {
    // Initialize vault
    let initEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(initEvent);

    const vaultId = VAULT_ADDRESS.toLowerCase();
    
    // Update min withdrawal shares
    let updateEvent = createMinWithdrawalSharesUpdatedEvent(
      BigInt.fromString("100000000000000000000"), // Old: 100 shares
      BigInt.fromString("10000000000000000000")   // New: 10 shares
    );
    updateEvent.address = Address.fromString(VAULT_ADDRESS);
    handleMinWithdrawalSharesUpdated(updateEvent);

    assert.fieldEquals("Vault", vaultId, "minWithdrawalShares", "10000000000000000000");
  });
});
