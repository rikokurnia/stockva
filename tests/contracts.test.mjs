import test from "node:test";
import assert from "node:assert/strict";
import {
  BSC_TESTNET_CHAIN_ID,
  MOCK_USD_ADDRESS,
  VAULT_ADDRESS,
  bscAddressLink,
  bscTxLink,
  MOCK_USD_ABI,
  VAULT_ABI,
} from "../lib/contracts.ts";

test("BSC Testnet contract configuration and ABIs are valid", () => {
  assert.equal(BSC_TESTNET_CHAIN_ID, 97);
  assert.match(MOCK_USD_ADDRESS, /^0x[a-fA-F0-9]{40}$/);
  assert.match(VAULT_ADDRESS, /^0x[a-fA-F0-9]{40}$/);

  assert.equal(
    bscAddressLink(MOCK_USD_ADDRESS),
    `https://testnet.bscscan.com/address/${MOCK_USD_ADDRESS}`,
  );
  assert.equal(
    bscTxLink("0x123"),
    "https://testnet.bscscan.com/tx/0x123",
  );

  // Validate ABI presence
  const mockUsdFunctions = MOCK_USD_ABI.filter((item) => item.type === "function").map((f) => f.name);
  assert.ok(mockUsdFunctions.includes("claimFaucet"), "MockUSD must have claimFaucet");
  assert.ok(mockUsdFunctions.includes("balanceOf"), "MockUSD must have balanceOf");

  const vaultFunctions = VAULT_ABI.filter((item) => item.type === "function").map((f) => f.name);
  assert.ok(vaultFunctions.includes("buyPosition"), "Vault must have buyPosition");
  assert.ok(vaultFunctions.includes("sellPosition"), "Vault must have sellPosition");
  assert.ok(vaultFunctions.includes("updateTier"), "Vault must have updateTier");
  assert.ok(vaultFunctions.includes("getUserPositionIds"), "Vault must have getUserPositionIds");

  // getUserPositions must match StockCityVault.sol: single Position[] return
  const getUserPositions = VAULT_ABI.find((f) => f.type === "function" && f.name === "getUserPositions");
  assert.ok(getUserPositions, "Vault must have getUserPositions");
  assert.equal(getUserPositions.outputs.length, 1);
  assert.equal(getUserPositions.outputs[0].type, "tuple[]");
});
