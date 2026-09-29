/* TRONAUT configuration. This is the only file a deployment needs to touch.

   Going live after the contracts are deployed to Robinhood Chain:
     1. Paste the four contract addresses into CONTRACTS below.
     2. Set DEPLOYMENT_BLOCKS from tronaut-contracts/deployments/<chainId>.json.
     3. Set APP_CONFIG.mode to "live".
   The ABIs in abi/ and the bindings in js/bindings.js already match the
   contracts. Re-copy the ABIs from tronaut-contracts/abi/ if they change.
   Until every required piece is present the app stays in demo mode on its own
   and says why on the Registry page, so a half finished deployment can never
   show demo data as if it came from the chain. */

export const APP_CONFIG = {
  // "demo": everything reads the static sample data in data/.
  // "live": onchain panels read Robinhood Chain through js/contracts.js.
  mode: "live",

  // Hash used when a document is fingerprinted in the browser before it is
  // anchored. Match whatever ProvenanceRegistry expects: "sha256" or "keccak256".
  evidenceHash: "sha256",

  // Confirmations to wait for before a write is shown as confirmed.
  confirmations: 1
};

// TRONAUT_TOKEN: the token contract address shown on the landing page.
// Leave it empty ("") or null and the page shows "Coming soon".
// At launch, paste the address between the quotes. Whatever is here is shown as is.
export const TOKEN_ADDRESS = "";

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
  aircraftAssetRegistry: "0xB920299eb97c77e0dCB021B2352f399745E6293e",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed AssetMetadata address here.
  assetMetadata: "0xe3F2a11456689FBb627ab83eD918B884fB4ACF99",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed AssetAttestation address here.
  assetAttestation: "0x588Fb23112fF4003f38F43c2A86cFC93550169f5",

  // TRONAUT_DEPLOYMENT:
  // Insert deployed ProvenanceRegistry address here.
  provenanceRegistry: "0xbc107eB644e567Aa6E052D2B000a9F68cE9F2d1d"
};

// Block each contract was deployed in. Event scans start here instead of block 0.
export const DEPLOYMENT_BLOCKS = {
  aircraftAssetRegistry: 75346923,
  assetMetadata: 75346923,
  assetAttestation: 75346923,
  provenanceRegistry: 75346923
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
