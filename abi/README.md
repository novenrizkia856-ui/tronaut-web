# Contract ABIs

Each file here is a placeholder holding an empty ABI (`[]`). The contracts are not
deployed yet, so no function signatures are guessed.

When the contracts are compiled, replace each file with its ABI. Either shape works:

- a bare ABI array, as in `forge inspect AircraftAssetRegistry abi`
- a full Foundry or Hardhat artifact with an `abi` field

| File | Contract | Address goes in |
| --- | --- | --- |
| `AircraftAssetRegistry.json` | Registry of aircraft asset records | `CONTRACTS.aircraftAssetRegistry` in `js/config.js` |
| `AssetMetadata.json` | Structured references to aircraft metadata | `CONTRACTS.assetMetadata` |
| `AssetAttestation.json` | Attestations about aircraft and asset records | `CONTRACTS.assetAttestation` |
| `ProvenanceRegistry.json` | Anchored evidence hashes and references | `CONTRACTS.provenanceRegistry` |

After the ABIs are in, map each app operation to a real function in the
`BINDINGS` table of `js/contracts.js`. The Registry page lists every operation
that is still unbound.
