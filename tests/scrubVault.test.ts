import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  handleVaultInitialized,
  handleDepositRequested,
  handleDepositProcessed,
  handleWithdrawalRequested,
  handleWithdrawalProcessed,
  handleRewardDistributed,
} from "../src/mappingScrubVault";
import { createVaultInitializedEvent, createDepositRequestedEvent, createDepositProcessedEvent } from "./scrubVault-utils";

// Test constants
const VAULT_ADDRESS = "0x7BFf6c730dA681dF03364c955B165576186370Bc";
const USER_ADDRESS = "0x1234567890123456789012345678901234567890";
const USDT_ADDRESS = "0x919C1c267BC06a7039e03fcc2eF738525769109c";
const SHARE_TOKEN_ADDRESS = "0x31ce80494b2D285637929E6d64E1ac045dB77CA1";
const STRATEGY_ADDRESS = "0xD47D2f1543CdaE1284f20705a32B1362422cB652";

describe("ScrubVault", () => {
  afterAll(() => {
    clearStore();
  });

  test("VaultInitialized creates vault entity with correct fields", () => {
    // Initialize vault
    let vaultInitializedEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS), // treasury
      BigInt.fromI32(1000000) // initialShareValue
    );
    handleVaultInitialized(vaultInitializedEvent);
    
    const vaultId = VAULT_ADDRESS.toLowerCase();
    assert.fieldEquals("Vault", vaultId, "vaultType", "scrub");
    assert.fieldEquals("Vault", vaultId, "underlying", USDT_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "shareToken", SHARE_TOKEN_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "strategy", STRATEGY_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "treasury", STRATEGY_ADDRESS.toLowerCase());
    assert.fieldEquals("Vault", vaultId, "totalShares", "0");
    assert.fieldEquals("Vault", vaultId, "totalPendingWithdrawalShares", "0");
    assert.fieldEquals("Vault", vaultId, "paused", "false");
    assert.fieldEquals("Vault", vaultId, "decimals", "6");
    assert.fieldEquals("Vault", vaultId, "tokenName", "USDT Vault");
  });

  test("DepositRequested creates deposit and updates user stats", () => {
    clearStore(); // Fresh start
    
    // Initialize vault first
    let vaultInitializedEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(vaultInitializedEvent);
    
    let depositId = BigInt.fromI32(1);
    let amount = BigInt.fromI32(1000000000); // 1000 USDT (6 decimals)
    let fee = BigInt.fromI32(1000000); // 1 USDT fee
    let timestamp = BigInt.fromI32(1706270400);

    let depositRequestedEvent = createDepositRequestedEvent(
      depositId,
      Address.fromString(USER_ADDRESS),
      amount,
      fee,
      timestamp
    );
    depositRequestedEvent.address = Address.fromString(VAULT_ADDRESS);

    handleDepositRequested(depositRequestedEvent);

    // Check deposit entity
    let depositEntityId = VAULT_ADDRESS.toLowerCase() + "-" + depositId.toString();
    assert.fieldEquals("VaultDeposit", depositEntityId, "vault", VAULT_ADDRESS.toLowerCase());
    assert.fieldEquals("VaultDeposit", depositEntityId, "user", USER_ADDRESS.toLowerCase());
    assert.fieldEquals("VaultDeposit", depositEntityId, "amount", amount.toString());
    assert.fieldEquals("VaultDeposit", depositEntityId, "fee", fee.toString());
    assert.fieldEquals("VaultDeposit", depositEntityId, "status", "pending");
    assert.fieldEquals("VaultDeposit", depositEntityId, "sharesMinted", "0");

    // Check user stats
    let vaultUserId = VAULT_ADDRESS.toLowerCase() + "-" + USER_ADDRESS.toLowerCase();
    assert.fieldEquals("VaultUser", vaultUserId, "vault", VAULT_ADDRESS.toLowerCase());
    assert.fieldEquals("VaultUser", vaultUserId, "user", USER_ADDRESS.toLowerCase());
    assert.fieldEquals("VaultUser", vaultUserId, "pendingDepositCount", "1");
    assert.fieldEquals("VaultUser", vaultUserId, "totalDeposited", (amount.plus(fee)).toString());
  });

  test("DepositProcessed updates deposit, user, and vault", () => {
    clearStore(); // Fresh start
    
    // Initialize and process a deposit
    let vaultInitializedEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(vaultInitializedEvent);
    
    let depositId = BigInt.fromI32(1);
    let amount = BigInt.fromI32(1000000000);
    let fee = BigInt.fromI32(1000000);
    
    let depositRequestedEvent = createDepositRequestedEvent(
      depositId,
      Address.fromString(USER_ADDRESS),
      amount,
      fee,
      BigInt.fromI32(1706270400)
    );
    depositRequestedEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(depositRequestedEvent);
    
    let sharesMinted = BigInt.fromI32(1000000000); // 1000 shares
    let usdAmount = BigInt.fromI32(1000000000);
    let timestamp = BigInt.fromI32(1706270500);

    let depositProcessedEvent = createDepositProcessedEvent(
      depositId,
      Address.fromString(USER_ADDRESS),
      usdAmount,
      sharesMinted,
      timestamp
    );
    depositProcessedEvent.address = Address.fromString(VAULT_ADDRESS);

    handleDepositProcessed(depositProcessedEvent);

    // Check deposit updated to processed
    let depositEntityId = VAULT_ADDRESS.toLowerCase() + "-" + depositId.toString();
    assert.fieldEquals("VaultDeposit", depositEntityId, "status", "processed");
    assert.fieldEquals("VaultDeposit", depositEntityId, "sharesMinted", sharesMinted.toString());

    // Check user stats updated
    let vaultUserId = VAULT_ADDRESS.toLowerCase() + "-" + USER_ADDRESS.toLowerCase();
    assert.fieldEquals("VaultUser", vaultUserId, "shareBalance", sharesMinted.toString());
    assert.fieldEquals("VaultUser", vaultUserId, "pendingDepositCount", "0");

    // Check vault totalShares updated
    assert.fieldEquals("Vault", VAULT_ADDRESS.toLowerCase(), "totalShares", sharesMinted.toString());

    // Check VaultInfo created
    let infoId = VAULT_ADDRESS.toLowerCase() + "-" + timestamp.toString();
    assert.fieldEquals("VaultInfo", infoId, "vault", VAULT_ADDRESS.toLowerCase());
    assert.fieldEquals("VaultInfo", infoId, "tvl", usdAmount.toString());
  });

  test("Complete deposit flow works correctly", () => {
    clearStore();
    
    // 1. Initialize vault
    let vaultInitializedEvent = createVaultInitializedEvent(
      Address.fromString(VAULT_ADDRESS),
      Address.fromString(USDT_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      Address.fromString(SHARE_TOKEN_ADDRESS),
      Address.fromString(STRATEGY_ADDRESS),
      BigInt.fromI32(1000000)
    );
    handleVaultInitialized(vaultInitializedEvent);

    // 2. Request deposit
    let depositId = BigInt.fromI32(1);
    let sharesMinted = BigInt.fromI32(1000000000);
    
    let depositRequestedEvent = createDepositRequestedEvent(
      depositId,
      Address.fromString(USER_ADDRESS),
      BigInt.fromI32(1000000000),
      BigInt.fromI32(1000000),
      BigInt.fromI32(1706270400)
    );
    depositRequestedEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositRequested(depositRequestedEvent);

    // 3. Process deposit
    let depositProcessedEvent = createDepositProcessedEvent(
      depositId,
      Address.fromString(USER_ADDRESS),
      BigInt.fromI32(1000000000),
      sharesMinted,
      BigInt.fromI32(1706270500)
    );
    depositProcessedEvent.address = Address.fromString(VAULT_ADDRESS);
    handleDepositProcessed(depositProcessedEvent);

    // Verify final state
    assert.fieldEquals("Vault", VAULT_ADDRESS.toLowerCase(), "totalShares", sharesMinted.toString());
    let vaultUserId = VAULT_ADDRESS.toLowerCase() + "-" + USER_ADDRESS.toLowerCase();
    assert.fieldEquals("VaultUser", vaultUserId, "shareBalance", sharesMinted.toString());
  });
});
