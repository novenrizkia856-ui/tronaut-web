import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseCatalogue, searchAircraft, overallState, findAircraft, findEvidence, findAttestations, facets, squash, STATES } from "../js/data.js";

const raw = JSON.parse(readFileSync(new URL("../data/aircraft.json", import.meta.url), "utf8"));
const { aircraft, dataset } = normaliseCatalogue(raw);

test("catalogue is flagged as demo data", () => {
  assert.equal(dataset.demo, true);
  assert.ok(aircraft.length >= 6);
  aircraft.forEach((a) => assert.equal(a.demo, true, a.registration));
});

test("demo data never claims to be anchored", () => {
  for (const a of aircraft) {
    assert.equal(a.onchain.tx, null);
    assert.equal(a.onchain.block, null);
    assert.equal(a.onchain.registry, null);
    a.evidence.forEach((e) => assert.equal(e.anchor, null, e.id));
    a.attestations.forEach((t) => { assert.equal(t.tx, null); assert.equal(t.issuerAddress, null); });
  }
});

test("records are internally consistent", () => {
  const regs = new Set();
  for (const a of aircraft) {
    assert.ok(!regs.has(a.registration), "duplicate " + a.registration); regs.add(a.registration);
    const ids = new Set(a.evidence.map((e) => e.id));
    a.evidence.forEach((e) => { assert.ok(STATES.includes(e.state)); assert.match(e.hash, /^0x[0-9a-f]{64}$/); });
    a.attestations.forEach((t) => { assert.ok(ids.has(t.evidence), t.id); assert.ok(STATES.includes(t.state)); });
    a.history.forEach((h) => { assert.ok(STATES.includes(h.state)); if (h.evidence) assert.ok(ids.has(h.evidence), h.evidence); });
    Object.values(a.verification).forEach((s) => assert.ok(STATES.includes(s)));
    assert.equal(a.rights.token.value, "None issued");
  }
});

test("search matches registration loosely and ranks exact hits first", () => {
  assert.equal(searchAircraft(aircraft, "n 650 tr")[0].registration, "N650TR");
  assert.equal(searchAircraft(aircraft, "N650")[0].registration, "N650TR");
  assert.deepEqual(searchAircraft(aircraft, "global 7500").map((a) => a.registration), ["N750TR"]);
  assert.deepEqual(searchAircraft(aircraft, "6501", { field: "msn" }).map((a) => a.registration), ["N650TR"]);
  assert.equal(searchAircraft(aircraft, "6501", { field: "model" }).length, 0);
  assert.equal(searchAircraft(aircraft, "zzzz").length, 0);
  assert.equal(searchAircraft(aircraft, "").length, aircraft.length);
});

test("filters combine", () => {
  const g = searchAircraft(aircraft, "", { manufacturer: "Gulfstream" });
  assert.ok(g.length >= 2 && g.every((a) => a.manufacturer === "Gulfstream"));
  const unknown = searchAircraft(aircraft, "", { state: "unknown" });
  assert.ok(unknown.every((a) => overallState(a) === "unknown"));
  assert.ok(searchAircraft(aircraft, "", { sort: "year" }).every((a, i, l) => i === 0 || l[i - 1].year >= a.year));
  assert.ok(facets(aircraft).manufacturer.includes("Bombardier"));
});

test("overall state is the weakest identity field", () => {
  assert.equal(overallState({ verification: { registration: "verified", msn: "verified", year: "verified", status: "reported" } }), "reported");
  assert.equal(overallState({ verification: {} }), "unknown");
});

test("lookups by id, registration and hash", () => {
  assert.equal(findAircraft(aircraft, "trn0002").registration, "N750TR");
  assert.equal(findAircraft(aircraft, "n8x tr").model, "Falcon 8X");
  assert.equal(findAircraft(aircraft, ""), null);
  const e = aircraft[0].evidence[0];
  assert.equal(findEvidence(aircraft, e.hash)[0].evidence.id, e.id);
  assert.ok(findAttestations(aircraft, "inspector").length > 0);
  assert.equal(squash("n-650 tr"), "N650TR");
});
