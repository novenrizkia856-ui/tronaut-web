import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_CONFIG, CHAIN, CONTRACTS, ABI_PATHS } from "../js/config.js";
import { OPERATIONS, BINDINGS, isAddress, resolveMode } from "../js/contracts.js";

test("mode is demo or live", () => {
  assert.ok(["demo", "live"].includes(APP_CONFIG.mode));
  assert.ok(["sha256", "keccak256"].includes(APP_CONFIG.evidenceHash));
});

test("Robinhood Chain is configured", () => {
  assert.equal(CHAIN.CHAIN_NAME, "Robinhood Chain");
  assert.ok(Number.isInteger(CHAIN.CHAIN_ID) && CHAIN.CHAIN_ID > 0);
  assert.match(CHAIN.RPC_URL, /^https:\/\//);
  assert.match(CHAIN.BLOCK_EXPLORER_URL, /^https:\/\//);
});

test("contract addresses are empty or valid, never guessed", () => {
  assert.deepEqual(Object.keys(CONTRACTS).sort(), ["aircraftAssetRegistry", "assetAttestation", "assetMetadata", "provenanceRegistry"]);
  for (const [k, v] of Object.entries(CONTRACTS)) assert.ok(v === "" || isAddress(v), k + " is not an address");
});

test("ABI files parse to an ABI array or an artifact", () => {
  for (const path of Object.values(ABI_PATHS)) {
    const json = JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
    assert.ok(Array.isArray(json) || Array.isArray(json.abi), path);
  }
});

test("every operation has a binding slot and a known contract", () => {
  assert.deepEqual(Object.keys(OPERATIONS).sort(), Object.keys(BINDINGS).sort());
  for (const op of Object.values(OPERATIONS)) assert.ok(op.contract in CONTRACTS);
});

test("a missing deployment resolves to demo mode with reasons", async () => {
  if (Object.values(CONTRACTS).every(isAddress) && APP_CONFIG.mode === "live") return; // deployed: covered by the live check
  const state = await resolveMode();
  assert.equal(state.mode, "demo");
  assert.ok(state.checks.some((c) => !c.ok));
});
