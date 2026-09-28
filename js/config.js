/* TRONAUT configuration. This is the only file a deployment needs to touch.

   Going live after the contracts are deployed to Robinhood Chain:
     1. Paste the four contract addresses into CONTRACTS below.
     2. Replace the placeholder ABIs in abi/ with the compiled ABIs.
     3. Wire the read and write functions in js/contracts.js (BINDINGS).
     4. Set APP_CONFIG.mode to "live".
   Until every required piece is present the app stays in demo mode on its own
   and says why on the Registry page, so a half finished deployment can never
   show demo data as if it came from the chain. */

export const APP_CONFIG = {
  // "demo": everything reads the static sample data in data/.
  // "live": onchain panels read Robinhood Chain through js/contracts.js.
  mode: "demo",

  // Hash used when a document is fingerprinted in the browser before it is
  // anchored. Match whatever ProvenanceRegistry expects: "sha256" or "keccak256".
  evidenceHash: "sha256",

  // Confirmations to wait for before a write is shown as confirmed.
  confirmations: 1
};

export const CHAIN = {
  // TRONAUT_DEPLOYMENT: confirm these against the network the contracts use.
  CHAIN_ID: 4663,
  CHAIN_NAME: "Robinhood Chain",
  RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
  BLOCK_EXPLORER_URL: "https://robinhoodchain.blockscout.com",
  NATIVE_CURRENCY: { name: "Ether", symbol: "ETH", decimals: 18 }
};

export const CONTRACTS = {
  // TRONAUT_DEPLOYMENT:
  // Insert deployed AircraftAssetRegistry address here.
  aircraftAssetRegistry: "",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed AssetMetadata address here.
  assetMetadata: "",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed AssetAttestation address here.
  assetAttestation: "",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed ProvenanceRegistry address here.
  provenanceRegistry: ""
};

// Block each contract was deployed in. Event scans start here instead of block 0.
export const DEPLOYMENT_BLOCKS = {
  aircraftAssetRegistry: 0,
  assetMetadata: 0,
  assetAttestation: 0,
  provenanceRegistry: 0
};

// Where each ABI lives. The files may hold a bare ABI array or a compiler
// artifact with an "abi" field (Foundry and Hardhat output both work).
export const ABI_PATHS = {
  aircraftAssetRegistry: "abi/AircraftAssetRegistry.json",
  assetMetadata: "abi/AssetMetadata.json",
  assetAttestation: "abi/AssetAttestation.json",
  provenanceRegistry: "abi/ProvenanceRegistry.json"
};

// Offchain catalogue of aircraft profiles. Swap for an API endpoint later;
// js/data.js is the only reader.
export const DATA_SOURCES = {
  aircraft: "data/aircraft.json"
};

// Human names for the four modules, used across the UI.
export const MODULES = {
  aircraftAssetRegistry: "AircraftAssetRegistry",
  assetMetadata: "AssetMetadata",
  assetAttestation: "AssetAttestation",
  provenanceRegistry: "ProvenanceRegistry"
};

// Library used for ABI encoding in live mode only. Demo mode never loads it.
export const ETHERS_URL = "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";
