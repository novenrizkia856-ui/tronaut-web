# TRONAUT web

**Private aviation, brought onchain.** TRONAUT is the asset layer for private
aviation: aircraft records as structured, verifiable assets on Robinhood Chain.

This repository is the website and the dapp. It is static HTML, CSS and
JavaScript with no build step and no backend.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Landing page. The client reference design with TRONAUT copy |
| `assets.html` | Explore assets: search by registration, model, manufacturer or serial |
| `aircraft.html?reg=N650TR` | Aircraft asset profile (`/aircraft/N650TR` on Vercel) |
| `app.html` | Registry dapp: AircraftAssetRegistry, ProvenanceRegistry, AssetAttestation, network and wallet |
| `about.html` | Product explanation, verification states, onchain and offchain, legal boundaries |

## Design source

The landing page is the client reference (the Jesko Jets Webflow page they
supplied) with its markup, stylesheet, images and motion kept. Only copy,
logo and product pieces changed.

- `css/template.css` is the reference stylesheet, verbatim, with asset URLs
  pointed at local files. Do not edit it; override in `css/tronaut.css`.
- `js/motion.js` is the reference animation code (GSAP, ScrollTrigger,
  SplitText, Lenis, globe.gl), made readable. Barba became a plain page fade.
- Inner pages are built only from reference components: the header nav items,
  spec rows, accordion rows, booking form fields, the floating CTA pill, the
  booking modal (now the transaction sheet) and its boarding pass card (now
  the transaction receipt).
- Shared header, mobile menu, footer and CTA live in `partials/`. After
  editing one, run `npm run sync` to stamp it into every page.

## Code map

```
js/config.js      the only file a deployment edits: mode, chain, addresses, ABI paths
js/contracts.js   operations, BINDINGS table, DemoSource and LiveSource, mode resolution
js/web3.js        wallet (EIP-1193 / EIP-6963), network switch, public RPC, tx tracking
js/data.js        aircraft catalogue service: load, search, filter (swap for an API later)
js/ui.js          render helpers: badges, rows, hashes, explorer links, states
js/site.js        header wallet and network controls, live block, contract status
js/pages/*.js     assets, aircraft profile and registry app screens
abi/*.json        placeholder ABIs ([]) until the contracts are compiled
data/aircraft.json  demo catalogue: fictional aircraft, flagged demo
```

UI never touches addresses, ABIs or ethers directly. Screens ask for an
operation (`getAsset`, `submitAttestation` ...) and `js/contracts.js` answers
from the demo catalogue or from the chain.

## Demo mode and live mode

**Demo mode** (today): the contracts are not deployed. Everything reads the
static catalogue. Onchain fields stay empty and say "Not anchored". Writes can
be prepared, and documents can be fingerprinted in the browser, but nothing is
ever sent. No transaction hash, block or address is invented.

**Live mode** needs every one of these, or the app stays in demo mode and the
Registry page (Network tab, Deployment) lists what is missing:

1. `APP_CONFIG.mode = "live"` in `js/config.js`
2. The four addresses in `CONTRACTS` (`js/config.js`, marked `TRONAUT_DEPLOYMENT`)
3. The four ABIs in `abi/` (bare array or Foundry / Hardhat artifact)
4. The RPC really answering as the configured chain ID

## Going live after deployment

1. Paste the addresses into `CONTRACTS` and the deployment blocks into
   `DEPLOYMENT_BLOCKS` in `js/config.js`. Confirm `CHAIN` (Robinhood Chain,
   4663, RPC, explorer).
2. Replace each file in `abi/` with the compiled ABI.
3. In `js/contracts.js`, fill `BINDINGS`: map each operation to its real
   function (`fn`, `args`, `map`) or event (`event`, `filter`, `map`). The
   expected return shapes are documented at the bottom of that file. No
   function signatures were guessed, so every binding starts as `null`.
4. Set `APP_CONFIG.evidenceHash` to the hash the ProvenanceRegistry expects
   (`sha256` or `keccak256`).
5. Set `APP_CONFIG.mode = "live"`, run the checks, deploy.

Unbound operations show "Not wired yet" instead of failing silently, so a
partial wiring is safe to ship. ethers v6 is loaded from jsDelivr only in live
mode; demo mode loads no chain library.

## Product boundaries

The site keeps legal ownership, economic rights and token representation
apart, and says so on every profile. Only hashes and references go onchain,
never documents. There is no booking, charter, marketplace, fractional
investment or trading feature.

## Checks

```bash
npm run check
```

Runs the partial sync check, the copy rules (no hyphens or dashes in visible
copy, no sentence over 15 words) and the unit tests (`test/`).

```bash
node tools/check-browser.mjs --shots
```

Serves the site on a throwaway port, opens every page in headless Chrome at
1440 px and 390 px, and fails on console errors, uncaught exceptions, failed
requests or horizontal overflow. Screenshots go to `work/shots/`.

## Local preview

Any static server works, for example:

```bash
python -m http.server 5300 --directory .
```

The `/aircraft/N650TR` form needs the Vercel rewrite; locally use
`aircraft.html?reg=N650TR`.

## Open items

- **Fonts.** GT America (Grilli Type) is a commercial font. The files came
  embedded in the client reference. Confirm TRONAUT holds a web licence before
  launch, or swap the three files in `assets/fonts/`.
- **Imagery.** Photos, window renders and the globe map come from the client
  reference. Confirm usage rights before launch.
- **Landscape cover.** The reference blocked phones held sideways. Its image
  was not in the save, and blocking would lock users out of the dapp, so it
  was left out.
