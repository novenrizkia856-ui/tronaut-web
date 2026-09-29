/* Bindings from UI operations to the deployed TRONAUT contracts.
   They match the ABIs in abi/, exported from tronaut-contracts. If a contract
   changes, re-export its ABI and update the matching binding here.

   Each binding is one of:
     { fn: "functionName", args(input) => [...] }   a single write
     { call: async (live, input) => shape }         a read, may touch several contracts
   `live` is the LiveSource in js/contracts.js; live.contract(key) returns an
   ethers Contract. Reads return the shapes listed at the end of js/contracts.js,
   or null when nothing matches.

   Onchain IDs are integers from 1. The UI shows them as TRN0001 (asset),
   PRV0001 (provenance) and ATT0001 (attestation). */
import { DEPLOYMENT_BLOCKS } from "./config.js";

const ZERO_HASH = "0x" + "0".repeat(64);
const PAGE = 200;

// AssetAttestation.VerificationState, by index. Keep in step with the contract.
export const VERIFICATION_STATES = ["unknown", "unverified", "reported", "verified"];
// AircraftAssetRegistry.AssetStatus, by index. Keep in step with the contract.
export const ASSET_STATUSES = ["None", "Active", "In maintenance", "Stored", "Suspended", "Retired"];

/* "TRN0001", "trn1" or "1" -> 1n. Anything else, or zero, -> null. */
export function parseId(value, prefix) {
  const m = new RegExp("^(?:" + prefix + ")?0*([0-9]+)$", "i").exec(String(value || "").trim());
  return m ? BigInt(m[1]) : null;
}
export function formatId(id, prefix) { return prefix + String(id).padStart(4, "0"); }
const toAssetId = (v) => parseId(v, "TRN");

function need(value, what) {
  if (value === null || value === undefined || String(value).trim() === "") throw new Error(what + " is required.");
  return String(value).trim();
}
function needAsset(v) {
  const id = toAssetId(v);
  if (!id) throw new Error("A valid asset ID such as TRN0001 is required.");
  return id;
}
function needHash(v) {
  const h = String(v || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(h)) throw new Error("A 32 byte hash is required: 0x and 64 hex characters.");
  return h;
}

/* Transaction and block per record, from the contract's creation events. A node
   that refuses the log range leaves tx and block empty rather than failing the read. */
async function txIndex(c, key, eventName, filterArgs, idField) {
  const out = {};
  try {
    const logs = await c.queryFilter(c.filters[eventName].apply(null, filterArgs), DEPLOYMENT_BLOCKS[key] || 0, "latest");
    logs.forEach(function (log) { out[log.args[idField].toString()] = { tx: log.transactionHash, block: log.blockNumber }; });
  } catch (e) { /* tx stays null */ }
  return out;
}

async function recordById(live, id) {
  const reg = await live.contract("aircraftAssetRegistry");
  if (!id || !(await reg.assetExists(id))) return null;
  const prov = await live.contract("provenanceRegistry");
  const [a, root, txs] = await Promise.all([
    reg.getAircraft(id),
    prov.evidenceRoot(id),
    txIndex(reg, "aircraftAssetRegistry", "AircraftRegistered", [id], "assetId")
  ]);
  const t = txs[id.toString()] || {};
  return {
    assetId: formatId(a.assetId, "TRN"), registration: a.registration, manufacturer: a.manufacturer, model: a.model, msn: a.msn,
    year: Number(a.year) || null, status: ASSET_STATUSES[Number(a.status)] || null,
    metadataRef: a.metadataURI || null, metadataHash: a.metadataHash === ZERO_HASH ? null : a.metadataHash,
    evidenceRoot: root === ZERO_HASH ? null : root,
    registeredBy: a.registeredBy, registeredAt: Number(a.createdAt), updatedAt: Number(a.updatedAt),
    tx: t.tx || null, block: t.block || null
  };
}

async function registrationOf(live, id) {
  const reg = await live.contract("aircraftAssetRegistry");
  return (await reg.getAircraft(id)).registration;
}

function evidenceFrom(p, registration, t) {
  return {
    id: formatId(p.provenanceId, "PRV"), hash: p.evidenceHash, title: p.label, reference: p.label, uri: p.uri || null,
    assetId: formatId(p.assetId, "TRN"), registration: registration || null, timestamp: Number(p.timestamp),
    submitter: p.submitter, tx: (t && t.tx) || null, block: (t && t.block) || null
  };
}

function attestationFrom(a, registration, t) {
  return {
    id: formatId(a.attestationId, "ATT"), assetId: formatId(a.assetId, "TRN"), registration: registration || null,
    type: a.attestationType, issuer: null, issuerAddress: a.issuer, timestamp: Number(a.timestamp),
    evidence: a.evidenceHash, evidenceTitle: null, provenanceId: formatId(a.provenanceId, "PRV"),
    reference: a.referenceURI || null, state: VERIFICATION_STATES[Number(a.state)] || "unknown",
    revoked: a.revoked, revokedAt: a.revoked ? Number(a.revokedAt) : null,
    tx: (t && t.tx) || null, block: (t && t.block) || null
  };
}

export const BINDINGS = {
  getAsset: { call: (live, input) => recordById(live, toAssetId(input.assetId)) },

  findAssetByRegistration: {
    call: async function (live, input) {
      const reg = await live.contract("aircraftAssetRegistry");
      let id;
      try { id = await reg.assetIdByRegistration(String(input.registration || "").trim()); } catch (e) { return null; } // malformed mark
      return id ? recordById(live, id) : null;
    }
  },

  // Year and content hash are optional; 0 and the zero hash record them as not given.
  registerAsset: {
    fn: "registerAircraft",
    args: (input) => [{
      registration: need(input.registration, "Registration"), manufacturer: need(input.manufacturer, "Manufacturer"),
      model: need(input.model, "Model"), msn: need(input.msn, "Serial / MSN"), year: Number(input.year) || 0,
      metadataURI: String(input.metadataRef || "").trim(), metadataHash: input.contentHash ? needHash(input.contentHash) : ZERO_HASH
    }]
  },

  getMetadataRef: {
    call: async function (live, input) {
      const id = toAssetId(input.assetId);
      const rec = id && (await recordById(live, id));
      if (!rec) return null;
      const meta = await live.contract("assetMetadata");
      if (!Number(await meta.metadataVersionCount(id))) {
        return { metadataRef: rec.metadataRef, contentHash: rec.metadataHash, version: 0, updatedAt: rec.registeredAt };
      }
      const m = await meta.getLatestMetadata(id);
      return { metadataRef: m.uri, contentHash: m.contentHash, version: Number(m.version), updatedAt: Number(m.timestamp), updatedBy: m.updatedBy };
    }
  },

  updateMetadata: {
    fn: "setMetadata",
    args: (input) => [needAsset(input.assetId), need(input.metadataRef, "Metadata reference"), needHash(input.contentHash)]
  },

  getEvidenceForAsset: {
    call: async function (live, input) {
      const id = toAssetId(input.assetId);
      if (!id) return [];
      const prov = await live.contract("provenanceRegistry");
      const [list, txs] = await Promise.all([
        prov.getProvenanceForAsset(id, 0, PAGE),
        txIndex(prov, "provenanceRegistry", "ProvenanceAdded", [null, id], "provenanceId")
      ]);
      if (!list.length) return [];
      const registration = await registrationOf(live, id);
      return list.map((p) => evidenceFrom(p, registration, txs[p.provenanceId.toString()]));
    }
  },

  getEvidenceByHash: {
    call: async function (live, input) {
      const prov = await live.contract("provenanceRegistry");
      const ids = await prov.getProvenanceIdsByHash(needHash(input.hash));
      if (!ids.length) return null;
      const p = await prov.getProvenance(ids[0]);
      const txs = await txIndex(prov, "provenanceRegistry", "ProvenanceAdded", [ids[0]], "provenanceId");
      return evidenceFrom(p, await registrationOf(live, p.assetId), txs[ids[0].toString()]);
    }
  },

  attachProvenance: {
    fn: "addProvenance",
    args: (input) => [needAsset(input.assetId), needHash(input.hash), need(input.reference, "Reference"), String(input.uri || "").trim()]
  },

  getAttestation: {
    call: async function (live, input) {
      const id = parseId(input.attestationId, "ATT");
      const att = await live.contract("assetAttestation");
      if (!id || !(await att.attestationExists(id))) return null;
      const a = await att.getAttestation(id);
      const txs = await txIndex(att, "assetAttestation", "AttestationCreated", [id], "attestationId");
      return attestationFrom(a, await registrationOf(live, a.assetId), txs[id.toString()]);
    }
  },

  getAttestationsForAsset: {
    call: async function (live, input) {
      const id = toAssetId(input.assetId);
      if (!id) return [];
      const att = await live.contract("assetAttestation");
      const [list, txs] = await Promise.all([
        att.getAttestationsForAsset(id, 0, PAGE),
        txIndex(att, "assetAttestation", "AttestationCreated", [null, id], "attestationId")
      ]);
      if (!list.length) return [];
      const registration = await registrationOf(live, id);
      return list.map((a) => attestationFrom(a, registration, txs[a.attestationId.toString()]));
    }
  },

  // The contract refuses "unknown" and needs the evidence hash anchored for this asset first.
  submitAttestation: {
    fn: "createAttestation",
    args: function (input) {
      const state = VERIFICATION_STATES.indexOf(String(input.state || ""));
      if (state < 1) throw new Error("Choose Verified, Reported or Unverified.");
      return [needAsset(input.assetId), need(input.type, "Attestation type"), state, needHash(input.evidenceHash), String(input.reference || "").trim()];
    }
  }
};
