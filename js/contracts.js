/* Contract adapters.
   The UI asks for operations ("getAsset", "submitAttestation", ...) and never
   touches ABIs, addresses or ethers directly. Two sources implement them:

     DemoSource  reads the static catalogue. Onchain fields stay empty and
                 writes are refused, so nothing fake ever looks anchored.
     LiveSource  calls the deployed contracts on Robinhood Chain through the
                 function named in BINDINGS for each operation.

   The final contract interfaces are not published yet, so no function names
   are guessed. Every binding below starts as null. When the ABIs arrive, fill
   the matching entry; the Registry page lists anything still unbound. */
import { APP_CONFIG, CHAIN, CONTRACTS, ABI_PATHS, MODULES, DEPLOYMENT_BLOCKS, ETHERS_URL } from "./config.js";
import { loadCatalogue, findAircraft, findEvidence, findAttestations } from "./data.js";
import { wallet, isCorrectChain, rpc, trackTransaction, readableError } from "./web3.js";

/* ---------- the operations the app needs ---------- */
export const OPERATIONS = {
  // AircraftAssetRegistry
  getAsset: { contract: "aircraftAssetRegistry", kind: "read", label: "Read registry record by asset ID" },
  findAssetByRegistration: { contract: "aircraftAssetRegistry", kind: "read", label: "Find asset ID by registration" },
  registerAsset: { contract: "aircraftAssetRegistry", kind: "write", label: "Register asset" },
  // AssetMetadata
  getMetadataRef: { contract: "assetMetadata", kind: "read", label: "Read metadata reference" },
  updateMetadata: { contract: "assetMetadata", kind: "write", label: "Update metadata reference" },
  // ProvenanceRegistry
  getEvidenceForAsset: { contract: "provenanceRegistry", kind: "read", label: "List evidence for an asset" },
  getEvidenceByHash: { contract: "provenanceRegistry", kind: "read", label: "Look up evidence by hash" },
  attachProvenance: { contract: "provenanceRegistry", kind: "write", label: "Anchor evidence hash" },
  // AssetAttestation
  getAttestation: { contract: "assetAttestation", kind: "read", label: "Read attestation by ID" },
  getAttestationsForAsset: { contract: "assetAttestation", kind: "read", label: "List attestations for an asset" },
  submitAttestation: { contract: "assetAttestation", kind: "write", label: "Submit attestation" }
};

/* ---------- TRONAUT_DEPLOYMENT: bind operations to the deployed ABIs ----------
   Each binding is one of:
     { fn: "functionName", args(input) => [...], map(result, input) => shape }
     { event: "EventName", filter(input) => [...indexed args], map(log, input) => shape }
   `input` is what the UI collected (see the input notes). `map` must return the
   shapes documented at the end of this file. Example only, not a real ABI:

     getAsset: {
       fn: "getAsset",
       args: (input) => [BigInt(input.assetId)],
       map: (r) => ({ assetId: r.id.toString(), registration: r.registration,
                      metadataRef: r.metadataURI, evidenceRoot: r.evidenceRoot,
                      registeredBy: r.registrar, registeredAt: Number(r.createdAt) })
     },
*/
export const BINDINGS = {
  getAsset: null,                 // input { assetId }            -> RegistryRecord
  findAssetByRegistration: null,  // input { registration }       -> RegistryRecord
  registerAsset: null,            // input { registration, manufacturer, model, msn, metadataRef }
  getMetadataRef: null,           // input { assetId }            -> { metadataRef, updatedAt }
  updateMetadata: null,           // input { assetId, metadataRef }
  getEvidenceForAsset: null,      // input { assetId }            -> Evidence[]
  getEvidenceByHash: null,        // input { hash }               -> Evidence
  attachProvenance: null,         // input { assetId, hash, reference, uri }
  getAttestation: null,           // input { attestationId }      -> Attestation
  getAttestationsForAsset: null,  // input { assetId }            -> Attestation[]
  submitAttestation: null         // input { assetId, type, evidenceHash, state }
};

/* ---------- errors the UI renders as states, not crashes ---------- */
export class NotBoundError extends Error {
  constructor(op) { super(OPERATIONS[op].label + " is not wired to the contract yet."); this.name = "NotBoundError"; this.op = op; }
}
export class DemoWriteError extends Error {
  constructor() { super("Demo mode. Contracts are not deployed yet, so nothing was sent."); this.name = "DemoWriteError"; }
}
export class WalletRequiredError extends Error {
  constructor(msg) { super(msg); this.name = "WalletRequiredError"; }
}

export function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

/* ---------- ABI loading ---------- */
let abiCache = null;
export async function loadAbis() {
  if (abiCache) return abiCache;
  const entries = await Promise.all(Object.keys(ABI_PATHS).map(async function (key) {
    try {
      const res = await fetch(ABI_PATHS[key], { cache: "no-cache" });
      if (!res.ok) return [key, []];
      const json = await res.json();
      return [key, Array.isArray(json) ? json : Array.isArray(json.abi) ? json.abi : []];
    } catch (e) {
      return [key, []];
    }
  }));
  abiCache = Object.fromEntries(entries);
  return abiCache;
}

/* ---------- mode resolution ---------- */
/* Live mode needs every piece. Anything missing keeps the app in demo mode and
   is listed, so the Registry page can say exactly what is left to configure. */
export async function resolveMode() {
  const abis = await loadAbis();
  const checks = [
    { label: 'APP_CONFIG.mode set to "live"', ok: APP_CONFIG.mode === "live" },
    { label: "Robinhood Chain ID and RPC configured", ok: !!(CHAIN.CHAIN_ID && CHAIN.RPC_URL) }
  ];
  Object.keys(CONTRACTS).forEach(function (key) {
    checks.push({ label: MODULES[key] + " address", ok: isAddress(CONTRACTS[key]), key: key });
    checks.push({ label: MODULES[key] + " ABI", ok: abis[key] && abis[key].length > 0, key: key });
  });
  const unbound = Object.keys(OPERATIONS).filter(function (op) { return !BINDINGS[op]; });
  const ready = checks.every(function (c) { return c.ok; });
  return { mode: ready ? "live" : "demo", requested: APP_CONFIG.mode, checks: checks, unbound: unbound, abis: abis };
}

/* ---------- ethers (live mode only) ---------- */
let ethersPromise = null;
export function loadEthers() {
  if (!ethersPromise) ethersPromise = import(ETHERS_URL).catch(function (e) { ethersPromise = null; throw e; });
  return ethersPromise;
}

/* ---------- demo source ---------- */
class DemoSource {
  constructor(catalogue) { this.kind = "demo"; this.catalogue = catalogue; }

  record(a) {
    if (!a) return null;
    return {
      assetId: a.assetId, registration: a.registration, manufacturer: a.manufacturer, model: a.model, msn: a.msn,
      metadataRef: a.onchain.metadataRef, evidenceRoot: a.onchain.evidenceRoot, evidenceRootComputed: !!a.onchain.evidenceRootComputed,
      registeredBy: null, registeredAt: null, tx: null, block: null, demo: true, aircraft: a
    };
  }

  async read(op, input) {
    const list = this.catalogue.aircraft;
    switch (op) {
      case "getAsset": return this.record(findAircraft(list, input.assetId));
      case "findAssetByRegistration": return this.record(findAircraft(list, input.registration));
      case "getMetadataRef": { const a = findAircraft(list, input.assetId); return a ? { metadataRef: a.onchain.metadataRef, updatedAt: null, demo: true } : null; }
      case "getEvidenceForAsset": {
        const a = findAircraft(list, input.assetId);
        return a ? a.evidence.map(function (e) { return evidenceShape(a, e); }) : [];
      }
      case "getEvidenceByHash": {
        const hit = findEvidence(list, input.hash)[0];
        return hit ? evidenceShape(hit.aircraft, hit.evidence) : null;
      }
      case "getAttestation": {
        const hit = findAttestations(list, input.attestationId).find(function (x) { return x.attestation.id.toLowerCase() === String(input.attestationId).trim().toLowerCase(); });
        return hit ? attestationShape(hit.aircraft, hit.attestation) : null;
      }
      case "getAttestationsForAsset": {
        const a = findAircraft(list, input.assetId);
        return a ? a.attestations.map(function (t) { return attestationShape(a, t); }) : [];
      }
      default: throw new Error("Unknown read " + op);
    }
  }

  async write() { throw new DemoWriteError(); }
}

function evidenceShape(a, e) {
  return {
    hash: e.hash, hashAlgorithm: e.hashAlgorithm, id: e.id, title: e.title, type: e.type, reference: e.reference, uri: e.uri,
    source: e.source, assetId: a.assetId, registration: a.registration, timestamp: e.timestamp, state: e.state,
    attestation: e.attestation, submitter: null, tx: null, block: null, demo: !!a.demo
  };
}

function attestationShape(a, t) {
  const ev = a.evidence.find(function (e) { return e.id === t.evidence; });
  return {
    id: t.id, assetId: a.assetId, registration: a.registration, type: t.type, issuer: t.issuer, issuerAddress: t.issuerAddress,
    timestamp: t.timestamp, evidence: ev ? ev.hash : null, evidenceTitle: ev ? ev.title : null, state: t.state,
    tx: t.tx, block: t.block, demo: !!a.demo
  };
}

/* ---------- live source ---------- */
class LiveSource {
  constructor(abis) { this.kind = "live"; this.abis = abis; this.readProvider = null; }

  async provider() {
    if (this.readProvider) return this.readProvider;
    const ethers = await loadEthers();
    this.readProvider = new ethers.JsonRpcProvider(CHAIN.RPC_URL, Number(CHAIN.CHAIN_ID), { staticNetwork: true });
    return this.readProvider;
  }

  async contract(key, runner) {
    const ethers = await loadEthers();
    return new ethers.Contract(CONTRACTS[key], this.abis[key], runner || (await this.provider()));
  }

  async read(op, input) {
    const b = BINDINGS[op];
    if (!b) throw new NotBoundError(op);
    const c = await this.contract(OPERATIONS[op].contract);
    if (b.event) {
      const filter = c.filters[b.event].apply(null, b.filter ? b.filter(input) : []);
      const logs = await c.queryFilter(filter, DEPLOYMENT_BLOCKS[OPERATIONS[op].contract] || 0, "latest");
      return logs.map(function (log) { return b.map(log, input); });
    }
    const result = await c[b.fn].apply(null, b.args ? b.args(input) : []);
    return b.map ? b.map(result, input) : result;
  }

  /* Sends a write and reports its lifecycle through onUpdate:
     { status: "signing" | "pending" | "confirmed" | "failed", hash, error } */
  async write(op, input, onUpdate) {
    const b = BINDINGS[op];
    if (!b || !b.fn) throw new NotBoundError(op);
    if (wallet.status !== "connected" || !wallet.provider) throw new WalletRequiredError("Connect a wallet to send this transaction.");
    if (!isCorrectChain(wallet.chainId)) throw new WalletRequiredError("Switch the wallet to " + CHAIN.CHAIN_NAME + " first.");
    const ethers = await loadEthers();
    const signer = await new ethers.BrowserProvider(wallet.provider).getSigner();
    const c = await this.contract(OPERATIONS[op].contract, signer);
    onUpdate({ status: "signing" });
    let tx;
    try {
      tx = await c[b.fn].apply(null, b.args ? b.args(input) : []);
    } catch (err) {
      onUpdate({ status: "failed", error: readableError(err) });
      throw err;
    }
    return new Promise(function (resolve) {
      trackTransaction(tx.hash, function (u) {
        onUpdate(u);
        if (u.status !== "pending") resolve(u);
      });
    });
  }
}

/* ---------- entry point ---------- */
let sourcePromise = null;
export function getSource() {
  if (!sourcePromise) {
    sourcePromise = (async function () {
      const state = await resolveMode();
      if (state.mode === "live") {
        // The RPC must really be the configured chain before anything is read as onchain truth.
        try {
          const id = parseInt(await rpc("eth_chainId"), 16);
          if (id !== Number(CHAIN.CHAIN_ID)) throw new Error("RPC reports chain " + id);
          return { source: new LiveSource(state.abis), state: state };
        } catch (e) {
          state.mode = "demo";
          state.checks.push({ label: "RPC answers as chain " + CHAIN.CHAIN_ID + " (" + readableError(e) + ")", ok: false });
        }
      }
      const catalogue = await loadCatalogue();
      return { source: new DemoSource(catalogue), state: state };
    })();
  }
  return sourcePromise;
}

/* ---------- evidence fingerprinting (runs in the browser, nothing uploaded) ---------- */
export async function hashFile(file, algorithm) {
  const algo = algorithm || APP_CONFIG.evidenceHash;
  const buffer = await file.arrayBuffer();
  if (algo === "keccak256") {
    const ethers = await loadEthers();
    return ethers.keccak256(new Uint8Array(buffer));
  }
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

/* ---------- shapes the UI renders ----------
   RegistryRecord { assetId, registration, manufacturer?, model?, msn?, metadataRef,
                    evidenceRoot, registeredBy, registeredAt, tx, block }
   Evidence       { hash, reference, uri, assetId, timestamp, submitter, tx, block,
                    title?, type?, state? }
   Attestation    { id, assetId, type, issuer, issuerAddress, timestamp, evidence,
                    state, tx, block }
   Timestamps may be ISO strings or unix seconds. Unknown values stay null and
   render as "Not recorded". */
