// Points the dapp at a tronaut-contracts deployment and switches it to live mode.
//   node tools/connect-deployment.mjs [path/to/deployments/<chainId>.json]
// Default: ../tronaut-contracts/deployments/4663.json. Edits js/config.js only.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(process.argv[2] || resolve(root, "../tronaut-contracts/deployments/4663.json"));
const dep = JSON.parse(readFileSync(manifestPath, "utf8"));
const configPath = resolve(root, "js/config.js");
let src = readFileSync(configPath, "utf8");

const KEYS = {
  aircraftAssetRegistry: "AircraftAssetRegistry",
  assetMetadata: "AssetMetadata",
  assetAttestation: "AssetAttestation",
  provenanceRegistry: "ProvenanceRegistry"
};

const chainId = Number((/CHAIN_ID:\s*(\d+)/.exec(src) || [])[1]);
if (Number(dep.chainId) !== chainId) throw new Error("Manifest chain " + dep.chainId + " does not match CHAIN.CHAIN_ID " + chainId);
const block = Number(dep.deploymentBlock) || 0;

// Rewrites `key: value` inside one exported object only.
function setIn(objectName, key, value) {
  const start = src.indexOf("export const " + objectName + " = {");
  if (start < 0) throw new Error(objectName + " not found in js/config.js");
  const end = src.indexOf("\n};", start);
  const body = src.slice(start, end);
  const re = new RegExp("(\\n\\s*" + key + ":\\s*)[^,\\n]+");
  if (!re.test(body)) throw new Error(objectName + "." + key + " not found");
  src = src.slice(0, start) + body.replace(re, "$1" + value) + src.slice(end);
}

for (const [key, name] of Object.entries(KEYS)) {
  const addr = dep[name];
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(addr))) throw new Error(name + " address missing in manifest");
  setIn("CONTRACTS", key, JSON.stringify(addr));
  setIn("DEPLOYMENT_BLOCKS", key, String(block));
}
setIn("APP_CONFIG", "mode", '"live"');
writeFileSync(configPath, src);
console.log("js/config.js now points at chain " + chainId + " (block " + block + "), mode live:");
for (const [key, name] of Object.entries(KEYS)) console.log("  " + key.padEnd(22) + dep[name]);
