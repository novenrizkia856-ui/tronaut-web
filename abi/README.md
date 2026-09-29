# Contract ABIs

These are the compiled ABIs from `tronaut-contracts` (`forge inspect <Contract> abi --json`),
copied from `tronaut-contracts/abi/`. If a contract changes, copy the new files over.

| File | Contract | Address goes in |
| --- | --- | --- |
| `AircraftAssetRegistry.json` | Registry of aircraft asset records | `CONTRACTS.aircraftAssetRegistry` in `js/config.js` |
| `AssetMetadata.json` | Versioned references to aircraft metadata | `CONTRACTS.assetMetadata` |
| `AssetAttestation.json` | Attestations about aircraft and asset records | `CONTRACTS.assetAttestation` |
| `ProvenanceRegistry.json` | Anchored evidence hashes and references | `CONTRACTS.provenanceRegistry` |

Each app operation is mapped to these functions in `js/bindings.js`.
