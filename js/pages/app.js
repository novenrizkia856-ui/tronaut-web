/* Registry app: AircraftAssetRegistry, ProvenanceRegistry, AssetAttestation
   and the network panel. All reads and writes go through js/contracts.js, so
   the same screens work in demo mode today and live mode after deployment. */
import { CHAIN, CONTRACTS, MODULES, APP_CONFIG } from "../config.js";
import { loadCatalogue, findAircraft, findEvidence, findAttestations, overallState, squash } from "../data.js";
import { getSource, OPERATIONS, BINDINGS, NotBoundError, DemoWriteError, WalletRequiredError, hashFile } from "../contracts.js";
import { wallet, onWallet, connect, disconnect, switchNetwork, isCorrectChain, shortAddress, latestBlock, explorer, readableError } from "../web3.js";
import { esc, badge, demoBadge, kv, hashCell, txCell, linkOut, notRecorded, fmtDate, fmtDateTime, stateBlock, loadingBlock, goIcon, ctaButton, toast, afterRender, params } from "../ui.js";

let source = null;
let modeState = null;
let catalogue = null;

/* ---------- tabs ---------- */
const TABS = ["registry", "provenance", "attestations", "network"];
function selectTab(key, focus) {
  if (TABS.indexOf(key) < 0) key = "registry";
  TABS.forEach(function (k) {
    const on = k === key;
    document.getElementById("tab-" + k).setAttribute("aria-selected", String(on));
    document.getElementById("tab-" + k).tabIndex = on ? 0 : -1;
    document.getElementById("panel-" + k).hidden = !on;
  });
  if (location.hash !== "#" + key) history.replaceState(null, "", location.pathname + location.search + "#" + key);
  if (focus) document.getElementById("tab-" + key).focus();
  if (window.TronautMotion) window.TronautMotion.refresh();
}
document.querySelectorAll("[data-tab]").forEach(function (t) {
  t.addEventListener("click", function () { selectTab(t.getAttribute("data-tab")); });
  t.addEventListener("keydown", function (e) {
    const i = TABS.indexOf(t.getAttribute("data-tab"));
    if (e.key === "ArrowRight") { e.preventDefault(); selectTab(TABS[(i + 1) % TABS.length], true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); selectTab(TABS[(i + TABS.length - 1) % TABS.length], true); }
  });
});
window.addEventListener("hashchange", function () { selectTab(location.hash.slice(1)); });
document.addEventListener("tronaut:show-network", function () { selectTab("network"); });
selectTab((location.hash || "#registry").slice(1));

/* ---------- helpers ---------- */
function isHash(v) { return /^0x[0-9a-fA-F]{64}$/.test(String(v || "").trim()); }
function isAssetId(v) { return /^trn\d{4}$/i.test(String(v || "").trim()) || /^\d+$/.test(String(v || "").trim()); }

function readError(e) {
  if (e instanceof NotBoundError) return stateBlock("Not wired yet", e.message + " Add the binding in js/contracts.js once the ABI is final.");
  return stateBlock("The read failed", readableError(e));
}

function lookupInput(key) { return document.getElementById("lookup-" + key); }
function onLookup(key, fn) {
  const form = document.querySelector('[data-lookup="' + key + '"]');
  form.addEventListener("submit", function (e) { e.preventDefault(); fn(lookupInput(key).value.trim()); });
}

/* ---------- registry ---------- */
const registryResult = document.getElementById("registry-result");

function recordView(r) {
  const demo = !!r.demo;
  const a = r.aircraft || (catalogue && findAircraft(catalogue.aircraft, r.registration || r.assetId));
  const empty = demo ? "Not anchored" : "Not recorded";
  return '<div class="line-h"></div><div class="unit-12"></div><div class="tr-between"><div class="p5">' + esc(r.registration || r.assetId) + "</div>" +
    '<div class="tr-inline">' + (demo ? demoBadge("Demo record") : badge("verified", "Onchain")) + (a ? badge(overallState(a)) : "") + "</div></div><div class=\"unit-24\"></div>" +
    '<div class="tr-kv">' +
    kv("Asset ID", esc(r.assetId) + (demo ? ' <span class="text-gray">catalogue ID</span>' : "")) +
    kv("Aircraft", esc([r.manufacturer, r.model].filter(Boolean).join(" ") || "Not recorded")) +
    kv("Serial / MSN", r.msn ? esc(r.msn) : notRecorded()) +
    kv("Metadata reference", r.metadataRef ? '<span class="tr-wrap">' + esc(r.metadataRef) + "</span>" : notRecorded(empty)) +
    kv("Evidence root", r.evidenceRoot ? hashCell(r.evidenceRoot, { demo: demo, demoLabel: "Computed locally" }) : notRecorded(empty)) +
    kv("Registered by", r.registeredBy ? linkOut("address", r.registeredBy) : notRecorded(empty)) +
    kv("Registered at", r.registeredAt ? esc(fmtDateTime(r.registeredAt)) : notRecorded(empty)) +
    kv("Transaction", txCell(r.tx, empty)) +
    kv("Block", r.block ? linkOut("block", r.block) : notRecorded(empty)) +
    '</div><div class="unit-36"></div><div class="tr-inline">' +
    (a ? '<a href="aircraft.html?reg=' + encodeURIComponent(a.registration) + '" hover="link" class="link w-inline-block"><div class="link_label"><div hover="text" class="l1">Open profile</div><div hover="text" class="l1 is-2">Open profile</div></div></a>' : "") +
    '<button type="button" hover="link" class="link w-inline-block" data-show="provenance" data-q="' + esc(r.assetId) + '"><div class="link_label"><div hover="text" class="l1">View provenance</div><div hover="text" class="l1 is-2">View provenance</div></div></button>' +
    '<button type="button" hover="link" class="link w-inline-block" data-show="attestations" data-q="' + esc(r.assetId) + '"><div class="link_label"><div hover="text" class="l1">View attestations</div><div hover="text" class="l1 is-2">View attestations</div></div></button>' +
    "</div>";
}

async function lookupRegistry(q) {
  if (!q) { registryResult.innerHTML = ""; return; }
  registryResult.innerHTML = loadingBlock("Reading AircraftAssetRegistry");
  try {
    let rec = null;
    if (isAssetId(q)) rec = await source.read("getAsset", { assetId: q });
    if (!rec) rec = await source.read("findAssetByRegistration", { registration: q });
    registryResult.innerHTML = rec ? recordView(rec) : stateBlock("No record found", "Nothing in the registry matches " + q + ". Try an asset ID such as TRN0001 or a registration such as N650TR.");
  } catch (e) {
    registryResult.innerHTML = readError(e);
  }
  afterRender(registryResult);
}
onLookup("registry", lookupRegistry);

function renderRegistryList() {
  const list = document.getElementById("registry-list");
  const countEl = document.getElementById("registry-count");
  if (source.kind !== "demo") {
    countEl.textContent = "";
    list.innerHTML = stateBlock("Look up a record", "Enter an asset ID or registration above to read it from " + CHAIN.CHAIN_NAME + ".");
    return;
  }
  countEl.textContent = catalogue.aircraft.length + " demo records";
  list.innerHTML = catalogue.aircraft.map(function (a) {
    return '<button type="button" class="tr-row tr-plain" style="width:100%" data-record="' + esc(a.assetId) + '"><span class="tr-row_bg"></span>' +
      '<div class="c12 m-main"><div class="p5">' + esc(a.registration) + '</div><div class="l1 text-gray">' + esc(a.assetId) + "</div></div>" +
      '<div class="c34 m-full l1">' + esc(a.manufacturer + " " + a.model) + '</div><div class="c5 m-half l1 text-gray">Not anchored</div>' +
      '<div class="c6 m-half2 l1">' + a.evidence.length + " evidence</div>" +
      '<div class="c7 m-side tr-between" style="align-items:center">' + badge(overallState(a)) + goIcon() + "</div></button>";
  }).join("");
}
document.getElementById("registry-list").addEventListener("click", function (e) {
  const b = e.target.closest("[data-record]");
  if (!b) return;
  lookupInput("registry").value = b.getAttribute("data-record");
  lookupRegistry(b.getAttribute("data-record"));
  if (window.TronautMotion) window.TronautMotion.scrollTo(document.getElementById("panel-registry"));
});

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-show]");
  if (!b) return;
  const tab = b.getAttribute("data-show");
  selectTab(tab);
  lookupInput(tab).value = b.getAttribute("data-q");
  (tab === "provenance" ? lookupProvenance : lookupAttestations)(b.getAttribute("data-q"));
});

/* ---------- provenance ---------- */
const provResult = document.getElementById("provenance-result");

function evidenceRows(items) {
  return '<div class="tr-row head"><div class="c12 l1">Evidence</div><div class="c34 l1">Aircraft and reference</div><div class="c5 l1">Hash</div><div class="c6 l1">Anchor</div><div class="c7 l1">State</div></div>' +
    '<div class="tr-list">' + items.map(function (e) {
      return '<div class="tr-row"><div class="c12 m-main"><div class="p6">' + esc(e.title || "Evidence") + '</div><div class="l1 text-gray">' + esc(e.type || "") + (e.timestamp ? " · " + esc(fmtDate(e.timestamp)) : "") + "</div></div>" +
        '<div class="c34 m-full"><div class="l1">' + esc(e.registration || e.assetId || "") + '</div><div class="l1 text-gray">' + esc(e.reference || "No reference") + "</div></div>" +
        '<div class="c5 m-full l1">' + hashCell(e.hash, { demo: e.demo }) + "</div>" +
        '<div class="c6 m-half l1">' + (e.tx ? txCell(e.tx) + (e.block ? '<div class="l1 text-gray">Block ' + linkOut("block", e.block) + "</div>" : "") : notRecorded(e.demo ? "Not anchored, demo" : "Not anchored")) +
        (e.submitter ? '<div class="l1 text-gray">By ' + linkOut("address", e.submitter) + "</div>" : "") + "</div>" +
        '<div class="c7 m-side">' + (e.state ? badge(e.state) : badge("verified", "Anchored")) + "</div></div>";
    }).join("") + "</div>";
}

async function lookupProvenance(q, opts) {
  if (!q) { provResult.innerHTML = ""; return; }
  provResult.innerHTML = loadingBlock("Reading ProvenanceRegistry");
  try {
    let items = [];
    if (source.kind === "demo") {
      items = findEvidence(catalogue.aircraft, q).map(function (x) {
        return Object.assign({}, x.evidence, { assetId: x.aircraft.assetId, registration: x.aircraft.registration, demo: true, tx: null, block: null });
      });
    } else if (isHash(q)) {
      const one = await source.read("getEvidenceByHash", { hash: q });
      items = one ? [one] : [];
    } else {
      let assetId = q;
      if (!isAssetId(q)) { const rec = await source.read("findAssetByRegistration", { registration: q }); assetId = rec && rec.assetId; }
      items = assetId ? await source.read("getEvidenceForAsset", { assetId: assetId }) : [];
    }
    if (items.length) provResult.innerHTML = evidenceRows(items);
    else if (isHash(q)) {
      provResult.innerHTML = stateBlock(opts && opts.file ? "No anchored evidence matches this document" : "No evidence with this hash",
        "Fingerprint " + q.slice(0, 12) + "… is not anchored. If the file is genuine, it can be anchored by an authorized submitter.",
        '<div class="unit-24"></div>' + ctaButton("Anchor this hash", 'data-action="attachProvenance" data-prefill-hash="' + esc(q) + '"'));
    } else provResult.innerHTML = stateBlock("No evidence found", "Nothing matches " + q + ". Try N650TR, TRN0001 or a full content hash.");
  } catch (e) {
    provResult.innerHTML = readError(e);
  }
  afterRender(provResult);
}
onLookup("provenance", lookupProvenance);

document.getElementById("fingerprint").addEventListener("change", async function (e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  provResult.innerHTML = loadingBlock("Hashing " + file.name + " in your browser");
  try {
    const h = await hashFile(file);
    lookupInput("provenance").value = h;
    toast("Fingerprint ready. The file never left your device");
    lookupProvenance(h, { file: true });
  } catch (err) {
    provResult.innerHTML = stateBlock("The file could not be hashed", readableError(err));
  }
});

/* ---------- attestations ---------- */
const attResult = document.getElementById("attestations-result");

function attestationRows(items) {
  return '<div class="tr-row head"><div class="c12 l1">Attestation</div><div class="c34 l1">Aircraft and issuer</div><div class="c5 l1">Evidence</div><div class="c6 l1">Timestamp</div><div class="c7 l1">State</div></div>' +
    '<div class="tr-list">' + items.map(function (t) {
      return '<div class="tr-row"><div class="c12 m-main"><div class="p6">' + esc(t.type) + '</div><div class="l1 text-gray">' + esc(t.id) + "</div></div>" +
        '<div class="c34 m-full"><div class="l1">' + esc(t.registration || t.assetId) + " · " + esc(t.issuer || "Unknown issuer") + '</div><div class="l1 text-gray">' + (t.issuerAddress ? linkOut("address", t.issuerAddress) : "No issuer address") + "</div></div>" +
        '<div class="c5 m-full l1">' + (t.evidenceTitle ? esc(t.evidenceTitle) + "<br/>" : "") + hashCell(t.evidence, { demo: t.demo }) + "</div>" +
        '<div class="c6 m-half l1">' + esc(fmtDateTime(t.timestamp) || "Not recorded") + '<div class="l1 text-gray">' + txCell(t.tx, t.demo ? "Not anchored, demo" : "No transaction") + "</div></div>" +
        '<div class="c7 m-side">' + badge(t.state) + "</div></div>";
    }).join("") + "</div>";
}

async function lookupAttestations(q) {
  if (!q) { attResult.innerHTML = ""; return; }
  attResult.innerHTML = loadingBlock("Reading AssetAttestation");
  try {
    let items = [];
    if (source.kind === "demo") {
      items = findAttestations(catalogue.aircraft, q).map(function (x) {
        const ev = x.aircraft.evidence.find(function (e) { return e.id === x.attestation.evidence; });
        return Object.assign({}, x.attestation, { registration: x.aircraft.registration, evidence: ev ? ev.hash : null, evidenceTitle: ev ? ev.title : null, demo: true });
      });
    } else if (!isAssetId(q) && /att|^\d+$/i.test(q) === false) {
      const rec = await source.read("findAssetByRegistration", { registration: q });
      items = rec ? await source.read("getAttestationsForAsset", { assetId: rec.assetId }) : [];
    } else if (isAssetId(q)) {
      items = await source.read("getAttestationsForAsset", { assetId: q });
    } else {
      const one = await source.read("getAttestation", { attestationId: q });
      items = one ? [one] : [];
    }
    attResult.innerHTML = items.length ? attestationRows(items) : stateBlock("No attestations found", "Nothing matches " + q + ". Try N650TR, TRN0001 or an issuer name.");
  } catch (e) {
    attResult.innerHTML = readError(e);
  }
  afterRender(attResult);
}
onLookup("attestations", lookupAttestations);

/* ---------- authorized actions (the action sheet) ---------- */
const STATES = [["verified", "Verified"], ["reported", "Reported"], ["unverified", "Unverified"], ["unknown", "Unknown"]];
const ACTIONS = {
  registerAsset: {
    title: "Register asset", desc: "Creates a registry record for an airframe. Metadata stays offchain behind its reference.",
    fields: [["registration", "Registration", "N650TR"], ["manufacturer", "Manufacturer", "Gulfstream"], ["model", "Model", "G650ER"], ["msn", "Serial / MSN", "6501"], ["metadataRef", "Metadata reference", "ipfs:// or https://"]]
  },
  updateMetadata: {
    title: "Update metadata", desc: "Points an asset at a new metadata reference. The previous reference stays in history.",
    fields: [["assetId", "Asset ID", "TRN0001"], ["metadataRef", "Metadata reference", "ipfs:// or https://"]]
  },
  attachProvenance: {
    title: "Anchor evidence", desc: "Anchors a document fingerprint and its reference. The document itself is never uploaded.",
    fields: [["assetId", "Asset ID", "TRN0001"], ["file", "Document to fingerprint", "", "file"], ["hash", "Content hash", "0x…"], ["reference", "Reference", "Registry extract, ref 0001"]]
  },
  submitAttestation: {
    title: "Submit attestation", desc: "Records your attestation, as issuer, about an asset. It is backed by anchored evidence.",
    fields: [["assetId", "Asset ID", "TRN0001"], ["type", "Attestation type", "Registration confirmed"], ["evidenceHash", "Evidence hash", "0x…"], ["state", "Verification state", "", "state"]]
  }
};
let currentAction = null;

function renderActions() {
  document.getElementById("actions").innerHTML = Object.keys(ACTIONS).map(function (op) {
    const a = ACTIONS[op];
    const status = source.kind === "demo" ? "Preview only" : BINDINGS[op] ? "Ready" : "Not wired";
    return '<button type="button" class="tr-row tr-plain" style="width:100%" data-action="' + op + '"><span class="tr-row_bg"></span>' +
      '<div class="c12 m-main p5">' + esc(a.title) + '</div><div class="c35 m-full"><p class="p7">' + esc(a.desc) + '</p></div>' +
      '<div class="c6 m-half l1 text-gray">' + esc(MODULES[OPERATIONS[op].contract]) + '</div><div class="c7 m-side tr-between" style="align-items:center"><span class="l1">' + status + "</span>" + goIcon() + "</div></button>";
  }).join("");
}

function field(name, label, placeholder, kind) {
  const id = "action-" + name;
  let control;
  if (kind === "state") control = '<select class="input_field p6 w-input" id="' + id + '" name="' + name + '">' + STATES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + "</option>"; }).join("") + "</select>";
  else if (kind === "file") control = '<input class="input_field p6 w-input" type="file" id="' + id + '" name="' + name + '"/>';
  else control = '<input class="input_field p6 w-input" type="text" id="' + id + '" name="' + name + '" placeholder="' + esc(placeholder) + '" autocomplete="off" spellcheck="false"/>';
  return '<div class="input tr-field tr-modal-field"><div class="input_label"><label class="l1" for="' + id + '">' + esc(label) + "</label></div>" + control + "</div>";
}

function setTx(html) { document.querySelector("[data-tx]").innerHTML = html; }

function openAction(op, prefill) {
  const a = ACTIONS[op];
  if (!a) return;
  currentAction = op;
  document.getElementById("action-title").textContent = a.title;
  document.getElementById("action-desc").textContent = a.desc;
  document.querySelector("[data-action-fields]").innerHTML = a.fields.map(function (f) { return field(f[0], f[1], f[2], f[3]); }).join("");
  document.getElementById("authorized").checked = false;
  syncCheck();
  setTx(source.kind === "demo" ? badge("demo", "Demo") + '<span class="l1 text-gray">Contracts are not deployed. You can prepare the record, but nothing will be sent.</span>' : "");
  Object.keys(prefill || {}).forEach(function (k) { const el = document.getElementById("action-" + k); if (el) el.value = prefill[k]; });
  const fileInput = document.getElementById("action-file");
  if (fileInput) fileInput.addEventListener("change", async function () {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    document.getElementById("action-hash").value = "Hashing…";
    try { document.getElementById("action-hash").value = await hashFile(f); } catch (err) { document.getElementById("action-hash").value = ""; toast(readableError(err)); }
  });
  if (window.TronautMotion && window.TronautMotion.openPopup) window.TronautMotion.openPopup("action");
  else document.querySelector('[pop-up="action"]').style.display = "block";
  setTimeout(function () { const first = document.querySelector("[data-action-fields] input, [data-action-fields] select"); if (first) first.focus(); }, 400);
}

function syncCheck() {
  document.querySelector("[data-check-box]").classList.toggle("w--redirected-checked", document.getElementById("authorized").checked);
}
document.getElementById("authorized").addEventListener("change", syncCheck);

document.addEventListener("click", function (e) {
  const b = e.target.closest("[data-action]");
  if (!b || !source) return;
  e.preventDefault();
  const hash = b.getAttribute("data-prefill-hash");
  openAction(b.getAttribute("data-action"), hash ? { hash: hash } : null);
});

function collect() {
  const values = {};
  const errors = [];
  ACTIONS[currentAction].fields.forEach(function (f) {
    if (f[3] === "file") return;
    const el = document.getElementById("action-" + f[0]);
    const v = el.value.trim();
    values[f[0]] = v;
    el.setAttribute("aria-invalid", "false");
    if (!v) { errors.push(f[1] + " is required"); el.setAttribute("aria-invalid", "true"); }
    else if ((f[0] === "hash" || f[0] === "evidenceHash") && !isHash(v)) { errors.push(f[1] + " must be a 32 byte hex hash"); el.setAttribute("aria-invalid", "true"); }
  });
  if (!document.getElementById("authorized").checked) errors.push("Confirm you are authorized");
  return { values: values, errors: errors };
}

document.getElementById("action-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!currentAction) return;
  const { values, errors } = collect();
  if (errors.length) { setTx(badge("failed", "Check") + '<span class="l1">' + esc(errors[0]) + "</span>"); return; }
  try {
    if (source.kind === "demo") throw new DemoWriteError();
    if (wallet.status !== "connected") await connect();
    if (!isCorrectChain(wallet.chainId)) await switchNetwork();
    setTx(badge("pending", "Signing") + '<span class="l1">Confirm the transaction in your wallet</span>');
    const result = await source.write(currentAction, values, function (u) {
      if (u.status === "signing") setTx(badge("pending", "Signing") + '<span class="l1">Confirm the transaction in your wallet</span>');
      if (u.status === "pending") setTx(badge("pending", "Pending") + '<span class="l1">Waiting for ' + (APP_CONFIG.confirmations || 1) + " confirmation · " + txCell(u.hash) + "</span>");
      if (u.status === "failed") setTx(badge("failed", "Failed") + '<span class="l1">' + esc(u.error || "Transaction failed") + (u.hash ? " · " + txCell(u.hash) : "") + "</span>");
    });
    if (result && result.status === "confirmed") showSuccess(values, result);
  } catch (err) {
    if (err instanceof DemoWriteError) {
      setTx(badge("demo", "Not sent") + '<span class="l1">' + esc(err.message) + "</span>");
    } else if (err instanceof NotBoundError || err instanceof WalletRequiredError) {
      setTx(badge("failed", "Blocked") + '<span class="l1">' + esc(err.message) + "</span>");
    } else {
      setTx(badge("failed", "Failed") + '<span class="l1">' + esc(readableError(err)) + "</span>");
    }
  }
});

function showSuccess(values, result) {
  document.querySelector("[data-success-asset]").textContent = values.registration || values.assetId || "Asset";
  document.querySelector("[data-success-subtitle]").textContent = "Transaction confirmed";
  document.querySelector("[data-success-title]").textContent = currentAction === "submitAttestation" ? "Attested" : currentAction === "attachProvenance" ? "Anchored" : "Recorded";
  document.querySelector("[data-success-desc]").textContent = "Block " + (result.block || "") + " on " + CHAIN.CHAIN_NAME;
  const link = document.querySelector("[data-success-link]");
  link.href = explorer("tx", result.hash) || "#";
  if (window.TronautMotion && window.TronautMotion.showPopupSuccess) window.TronautMotion.showPopupSuccess("action");
}

/* ---------- network panel ---------- */
function renderNetwork() {
  const facts = document.getElementById("network-facts");
  facts.innerHTML =
    kv("Network", esc(CHAIN.CHAIN_NAME)) + kv("Chain ID", esc(CHAIN.CHAIN_ID)) +
    kv("Latest block", '<span data-app-block>Syncing</span>') +
    kv("RPC", '<span class="tr-wrap">' + esc(CHAIN.RPC_URL) + "</span>") +
    kv("Explorer", CHAIN.BLOCK_EXPLORER_URL ? '<a class="link-basic" href="' + esc(CHAIN.BLOCK_EXPLORER_URL) + '" target="_blank" rel="noopener">' + esc(CHAIN.BLOCK_EXPLORER_URL.replace(/^https?:\/\//, "")) + "</a>" : notRecorded()) +
    kv("App mode", modeState.mode === "live" ? badge("live", "Live") : badge("demo", "Demo"));
  latestBlock().then(function (n) {
    const el = document.querySelector("[data-app-block]");
    if (el) el.innerHTML = linkOut("block", n, n.toLocaleString("en-US"));
  }).catch(function () { const el = document.querySelector("[data-app-block]"); if (el) el.textContent = "RPC offline"; });

  document.getElementById("mode-label").textContent = modeState.mode === "live" ? "Live" : 'Demo, requested "' + modeState.requested + '"';
  document.getElementById("deployment").innerHTML = modeState.checks.map(function (c) {
    return '<div class="tr-row dense"><div class="c13 m-main l1">' + esc(c.label) + '</div><div class="c46 m-full l1 text-gray">' +
      (c.key && CONTRACTS[c.key] && c.label.indexOf("address") > 0 ? linkOut("address", CONTRACTS[c.key]) : c.ok ? "Configured" : "Missing") +
      '</div><div class="c7 m-side">' + (c.ok ? badge("verified", "Ready") : badge("unknown", "Missing")) + "</div></div>";
  }).join("");
  const unbound = modeState.unbound.length;
  document.getElementById("ops-label").textContent = unbound ? unbound + " of " + Object.keys(OPERATIONS).length + " not wired" : "All wired";
  document.getElementById("operations").innerHTML = Object.keys(OPERATIONS).map(function (op) {
    const o = OPERATIONS[op];
    return '<div class="tr-row dense"><div class="c13 m-main l1">' + esc(o.label) + '</div><div class="c46 m-full l1 text-gray">' + esc(MODULES[o.contract]) + " · " + (o.kind === "read" ? "Read" : "Write") +
      '</div><div class="c7 m-side">' + (BINDINGS[op] ? badge("verified", "Bound") : badge("unknown", "Unbound")) + "</div></div>";
  }).join("");
}

function renderWalletPanel() {
  const panel = document.getElementById("wallet-panel");
  if (!panel) return;
  document.getElementById("wallet-provider").textContent = wallet.providerName || (wallet.status === "unavailable" ? "No wallet found" : "");
  let html;
  if (wallet.status === "connected") {
    const right = isCorrectChain(wallet.chainId);
    html = '<div class="tr-kv">' + kv("Address", linkOut("address", wallet.address, shortAddress(wallet.address)) + ' <button type="button" class="tr-copy l1" data-copy="' + esc(wallet.address) + '">Copy</button>') +
      kv("Wallet network", right ? badge("verified", CHAIN.CHAIN_NAME) : badge("unverified", "Chain " + wallet.chainId)) +
      kv("Status", right ? "Ready to sign" : "Switch to " + esc(CHAIN.CHAIN_NAME) + " to send transactions") + "</div>" +
      '<div class="unit-36"></div><div class="tr-inline">' + (right ? "" : ctaButton("Switch network", "data-switch")) +
      '<button type="button" hover="link" class="link w-inline-block" data-disconnect><div class="link_label"><div hover="text" class="l1">Disconnect</div><div hover="text" class="l1 is-2">Disconnect</div></div></button></div>';
  } else if (wallet.status === "unavailable") {
    html = stateBlock("No browser wallet found", "Reading works without a wallet. To sign transactions, install a wallet such as MetaMask and reload.");
  } else {
    html = stateBlock(wallet.status === "connecting" ? "Waiting for the wallet" : "No wallet connected", "Reading works without a wallet. Connect one to submit records once contracts are live.",
      '<div class="unit-24"></div>' + ctaButton("Connect wallet", "data-connect"));
  }
  panel.innerHTML = html;
  afterRender(panel);
}

document.addEventListener("click", async function (e) {
  try {
    if (e.target.closest("[data-connect]")) { await connect(); toast("Wallet connected"); }
    else if (e.target.closest("[data-switch]")) { await switchNetwork(); toast("Switched to " + CHAIN.CHAIN_NAME); }
    else if (e.target.closest("[data-disconnect]")) { await disconnect(); toast("Wallet disconnected"); }
  } catch (err) {
    toast(wallet.status === "unavailable" ? "No browser wallet found" : readableError(err));
  }
});

/* ---------- boot ---------- */
async function init() {
  document.getElementById("registry-list").innerHTML = loadingBlock("Loading registry");
  try {
    const got = await getSource();
    source = got.source; modeState = got.state;
    catalogue = await loadCatalogue();
  } catch (e) {
    document.getElementById("registry-list").innerHTML = stateBlock("The registry could not be loaded", readableError(e));
    return;
  }
  if (source.kind === "live") document.querySelectorAll("[data-mode-notice]").forEach(function (n) { n.hidden = true; });
  renderRegistryList();
  renderActions();
  renderNetwork();
  onWallet(renderWalletPanel);
  afterRender(document.getElementById("main"));

  const p = params();
  const asset = p.get("asset") || p.get("reg");
  if (asset) { lookupInput("registry").value = asset; lookupRegistry(asset); }
  if (p.get("hash")) { lookupInput("provenance").value = p.get("hash"); lookupProvenance(p.get("hash")); }
}
init();
