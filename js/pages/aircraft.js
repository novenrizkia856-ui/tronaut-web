/* Aircraft asset profile. Route: aircraft.html?reg=N650TR, or /aircraft/N650TR
   where the host rewrites it (see vercel.json). Catalogue facts come from
   js/data.js; the onchain record comes from js/contracts.js, which is empty
   in demo mode rather than invented. */
import { loadCatalogue, findAircraft, overallState, STATE_TEXT } from "../data.js";
import { getSource, NotBoundError } from "../contracts.js";
import { CHAIN, CONTRACTS, MODULES } from "../config.js";
import { esc, badge, demoBadge, kv, sectionHead, hashCell, txCell, linkOut, notRecorded, fmtDate, fmtDateTime, stateBlock, loadingBlock, ctaButton, afterRender, params } from "../ui.js";

const root = document.getElementById("profile");

function routeKey() {
  const q = params().get("reg") || params().get("asset");
  if (q) return q;
  const m = location.pathname.match(/\/aircraft\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function evidenceRef(a, id) {
  if (!id) return notRecorded("No evidence");
  const e = a.evidence.find(function (x) { return x.id === id; });
  if (!e) return notRecorded("No evidence");
  return '<button type="button" class="tr-copy l1" style="padding:0;color:inherit;text-decoration:underline;text-underline-offset:.2em" data-jump="ev-' + esc(e.id) + '">' + esc(e.title) + "</button>";
}

function stateCell(state, evidenceHtml) {
  return badge(state) + (evidenceHtml ? '<div class="unit-6"></div><div class="l1 text-gray">' + evidenceHtml + "</div>" : "");
}

function hero(a) {
  const state = overallState(a);
  return '<div class="grid">' +
    '<div class="tr-a tr-stack">' +
      '<a href="assets.html" hover="link" class="link w-inline-block"><div class="link_label"><div hover="text" class="l1">Back to assets</div><div hover="text" class="l1 is-2">Back to assets</div></div></a>' +
      '<div class="unit-60"></div><div class="line-h"></div><div class="unit-12"></div>' +
      '<div class="p5">' + esc(a.manufacturer) + '</div><div class="unit-24"></div><h1 class="h3">' + esc(a.model) + "</h1>" +
      '<div class="unit-60"></div><div class="line-h"></div><div class="unit-12"></div>' +
      '<div class="tr-kv two">' +
        kv("Registration", esc(a.registration)) + kv("Serial / MSN", esc(a.msn)) +
        kv("Year", esc(a.year)) + kv("Category", esc(a.category)) +
        kv("Status", esc(a.status)) + kv("Verification", badge(state)) +
      "</div>" +
    "</div>" +
    '<div class="tr-b"><div class="tr-figure"><img class="blueprint" src="assets/img/jet-blueprint.avif" alt="" aria-hidden="true" style="opacity:.35"/><img class="tr-jet" src="assets/img/jet.webp" alt="Business jet seen from above"/></div>' +
      '<div class="l1 text-gray" style="text-align:center">Illustration. Not this airframe.</div></div>' +
    '<div class="tr-c tr-stack"><div class="line-h"></div><div class="unit-12"></div><h2 class="p5">Aircraft Asset Profile</h2><div class="unit-24"></div>' +
      '<div class="tr-inline">' + (a.demo ? demoBadge("Demo record") : "") + '<span class="l1 text-gray">Asset ' + esc(a.assetId) + "</span></div>" +
      '<div class="unit-60"></div><div class="line-h"></div><div class="unit-12"></div><h3 class="l1">Structured, sourced, anchored</h3><div class="unit-24"></div>' +
      '<p class="p7">' + (a.demo ? "This is a fictional aircraft used to demonstrate the profile. Registrations, owners and documents are placeholders. " : "") +
      "Each field names its source and verification state. The record describes the aircraft; it does not confer title.</p>" +
      '<div class="unit-36"></div>' + ctaButton("Verify in Registry", 'data-go="app.html?asset=' + encodeURIComponent(a.assetId) + '#registry"') +
    "</div></div>";
}

const SECTIONS = [["information", "Asset information"], ["rights", "Ownership and rights"], ["history", "History"], ["evidence", "Evidence"], ["onchain", "Onchain record"], ["attestations", "Attestations"]];

function sectionNav() {
  return '<div class="unit-96"></div><nav class="tr-tabs" aria-label="Profile sections">' + SECTIONS.map(function (s) {
    return '<button type="button" data-jump="' + s[0] + '" hover="nav-item" class="nav-item w-inline-block"><div class="nav-item_label"><div hover="text" class="t7 text-dark">' + s[1] +
      '</div><div hover="text" class="t7 text-dark is-2">' + s[1] + '</div></div><div class="nav-item_bg"><div hover="bg" class="nav-item_bg_hover"></div></div></button>';
  }).join("") + "</nav>";
}

function information(a) {
  const identity = [["Registration", a.registration, "registration"], ["Manufacturer", a.manufacturer, "manufacturer"], ["Model", a.model, "model"],
    ["Serial / MSN", a.msn, "msn"], ["Year", a.year, "year"], ["Category", a.category, "category"], ["Status", a.status, "status"]];
  return '<section id="information" class="tr-section"><div class="unit-96"></div>' + sectionHead("Asset information", "Identity and specification") + '<div class="unit-24"></div>' +
    '<div class="tr-list">' + identity.map(function (f) {
      const ev = (a.fieldEvidence || {})[f[2]];
      return '<div class="tr-row"><div class="c12 m-full l1 text-gray">' + esc(f[0]) + '</div><div class="c35 m-main p6">' + esc(f[1]) + '</div><div class="c6 m-half l1 text-gray">' +
        (ev ? evidenceRef(a, ev) : "Catalogue") + '</div><div class="c7 m-side">' + badge((a.verification || {})[f[2]] || "unknown") + "</div></div>";
    }).join("") +
    a.specs.map(function (s) {
      return '<div class="tr-row"><div class="c12 m-full l1 text-gray">' + esc(s.label) + '</div><div class="c35 m-main p6">' + esc(s.value) + '</div><div class="c6 m-half l1 text-gray">Type figures</div><div class="c7 m-side">' + badge(s.state) + "</div></div>";
    }).join("") + "</div>" +
    '<div class="unit-24"></div><p class="p7 text-gray">Specification rows are published type figures for the model. They are not measured on this airframe.</p></section>';
}

function rights(a) {
  const r = a.rights || {};
  const rows = [r.owner, r.operator].concat(r.economic || []).concat([r.token]).filter(Boolean);
  return '<section id="rights" class="tr-section"><div class="unit-156"></div>' + sectionHead("Ownership and economic rights", "Structured information") + '<div class="unit-24"></div>' +
    '<div class="tr-list">' + rows.map(function (x) {
      return '<div class="tr-row"><div class="c12 m-full l1 text-gray">' + esc(x.label) + '</div><div class="c35 m-main p6">' + esc(x.value) + '</div><div class="c6 m-half l1 text-gray">' +
        evidenceRef(a, x.evidence) + '</div><div class="c7 m-side">' + badge(x.state) + "</div></div>";
    }).join("") + "</div>" +
    '<div class="unit-36"></div><div class="tr-notice"><div class="l1">Not a title document</div><p class="p7">These rows record what the evidence says about ownership and rights. An onchain record does not prove legal ownership, and no token here represents the aircraft.</p></div></section>';
}

function history(a) {
  const items = a.history.slice().sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
  return '<section id="history" class="tr-section"><div class="unit-156"></div>' + sectionHead("History", items.length + " events") + '<div class="unit-24"></div>' +
    '<div class="tr-list">' + items.map(function (h) {
      return '<div class="tr-row"><div class="c1 m-half l1 text-gray">' + esc(fmtDate(h.date)) + '</div><div class="c23 m-full p6">' + esc(h.event) + '</div><div class="c45 m-full"><p class="p7">' + esc(h.detail) +
        '</p></div><div class="c6 m-half l1 text-gray">' + (h.evidence ? evidenceRef(a, h.evidence) : "No evidence") + '</div><div class="c7 m-side">' + badge(h.state) + "</div></div>";
    }).join("") + "</div></section>";
}

function evidence(a) {
  return '<section id="evidence" class="tr-section"><div class="unit-156"></div>' + sectionHead("Evidence and provenance", a.evidence.length + " records") + '<div class="unit-24"></div>' +
    '<div class="tr-row head"><div class="c12 l1">Record</div><div class="c34 l1">Source and reference</div><div class="c5 l1">Content hash</div><div class="c6 l1">Anchor</div><div class="c7 l1">State</div></div>' +
    '<div class="tr-list">' + a.evidence.map(function (e) {
      const att = e.attestation ? a.attestations.find(function (t) { return t.id === e.attestation; }) : null;
      return '<div class="tr-row" id="ev-' + esc(e.id) + '"><div class="c12 m-main"><div class="p6">' + esc(e.title) + '</div><div class="l1 text-gray">' + esc(e.type) + " · " + esc(fmtDate(e.timestamp)) + "</div></div>" +
        '<div class="c34 m-full"><div class="l1">' + esc(e.source) + '</div><div class="l1 text-gray">' + esc(e.reference) + (e.uri ? ' · <a class="link-basic" href="' + esc(e.uri) + '" target="_blank" rel="noopener">Document</a>' : " · Held offchain") + "</div></div>" +
        '<div class="c5 m-full l1">' + hashCell(e.hash, { demo: a.demo }) + "</div>" +
        '<div class="c6 m-half l1">' + (e.anchor ? txCell(e.anchor.tx) : notRecorded(a.demo ? "Not anchored, demo" : "Not anchored")) + (att ? '<div class="l1 text-gray">Attested: ' + esc(att.type) + "</div>" : "") + "</div>" +
        '<div class="c7 m-side">' + badge(e.state) + "</div></div>";
    }).join("") + "</div>" +
    '<div class="unit-24"></div><p class="p7 text-gray">Documents stay with their keepers. Only content hashes and references are anchored, never the files themselves.</p></section>';
}

function onchainSkeleton() {
  return '<section id="onchain" class="tr-section"><div class="unit-156"></div>' + sectionHead("Onchain record", CHAIN.CHAIN_NAME) + '<div class="unit-36"></div><div id="onchain-body">' + loadingBlock("Reading the registry") + "</div></section>";
}

function onchainBody(a, rec, source, error) {
  const demo = source.kind === "demo";
  const registry = CONTRACTS.aircraftAssetRegistry ? linkOut("address", CONTRACTS.aircraftAssetRegistry) : notRecorded("Not deployed");
  let note = "";
  if (demo) note = '<div class="unit-36"></div><div class="tr-notice"><div class="l1">Demo mode</div><p class="p7">This record is not anchored. Onchain fields stay empty until the registry is deployed on ' + esc(CHAIN.CHAIN_NAME) + ".</p></div>";
  if (error instanceof NotBoundError) note = '<div class="unit-36"></div><div class="tr-notice"><div class="l1">Not wired yet</div><p class="p7">' + esc(error.message) + " Bind it in js/contracts.js.</p></div>";
  else if (error) note = '<div class="unit-36"></div><div class="tr-notice"><div class="l1">Read failed</div><p class="p7">' + esc(error.message || String(error)) + "</p></div>";
  if (!error && !demo && !rec) note = '<div class="unit-36"></div><div class="tr-notice"><div class="l1">Not registered</div><p class="p7">No registry entry was found for this aircraft on ' + esc(CHAIN.CHAIN_NAME) + ".</p></div>";
  const r = rec || {};
  const empty = demo ? "Not anchored" : "Not recorded";
  return '<div class="tr-kv">' +
    kv("Network", esc(CHAIN.CHAIN_NAME) + ' <span class="text-gray">' + esc(CHAIN.CHAIN_ID) + "</span>") +
    kv(MODULES.aircraftAssetRegistry, registry) +
    kv("Asset ID", !demo && r.assetId ? esc(r.assetId) : notRecorded(empty)) +
    kv("Transaction", txCell(r.tx, empty)) +
    kv("Block", r.block ? linkOut("block", r.block) : notRecorded(empty)) +
    kv("Timestamp", r.registeredAt ? esc(fmtDateTime(r.registeredAt)) : notRecorded(empty)) +
    kv("Metadata reference", r.metadataRef ? '<span class="tr-wrap">' + esc(r.metadataRef) + "</span>" : notRecorded(empty)) +
    kv("Evidence root", r.evidenceRoot ? hashCell(r.evidenceRoot, { demo: demo, demoLabel: "Computed locally" }) : notRecorded(empty)) +
    kv("Registered by", r.registeredBy ? linkOut("address", r.registeredBy) : notRecorded(empty)) +
    "</div>" + note;
}

function attestations(a) {
  return '<section id="attestations" class="tr-section"><div class="unit-156"></div>' + sectionHead("Attestations", a.attestations.length + " on file") + '<div class="unit-24"></div>' +
    (a.attestations.length ? '<div class="tr-row head"><div class="c12 l1">Type</div><div class="c34 l1">Issuer</div><div class="c5 l1">Timestamp</div><div class="c6 l1">Evidence</div><div class="c7 l1">State</div></div>' +
    '<div class="tr-list">' + a.attestations.map(function (t) {
      return '<div class="tr-row"><div class="c12 m-main"><div class="p6">' + esc(t.type) + '</div><div class="l1 text-gray">' + esc(t.id) + "</div></div>" +
        '<div class="c34 m-full"><div class="l1">' + esc(t.issuer) + '</div><div class="l1 text-gray">' + (t.issuerAddress ? linkOut("address", t.issuerAddress) : "No issuer address") + "</div></div>" +
        '<div class="c5 m-half l1">' + esc(fmtDateTime(t.timestamp)) + '<div class="l1 text-gray">' + txCell(t.tx, a.demo ? "Not anchored, demo" : "No transaction") + "</div></div>" +
        '<div class="c6 m-half2 l1">' + evidenceRef(a, t.evidence) + '</div><div class="c7 m-side">' + badge(t.state) + "</div></div>";
    }).join("") + "</div>" : stateBlock("No attestations yet", "Nobody has attested to facts about this aircraft.")) + "</section>";
}

async function init() {
  root.innerHTML = loadingBlock("Loading profile");
  const key = routeKey();
  let catalogue;
  try { catalogue = await loadCatalogue(); } catch (e) {
    root.innerHTML = stateBlock("The catalogue could not be loaded", "Check your connection and reload the page.");
    return;
  }
  const a = findAircraft(catalogue.aircraft, key);
  if (!a) {
    document.title = "Aircraft not found | TRONAUT";
    document.querySelectorAll(".cta").forEach(function (c) { c.style.display = "none"; });
    root.innerHTML = '<div class="l1 text-gray">Aircraft asset profile</div><div class="unit-24"></div><h1 class="h2">Not found</h1>' +
      stateBlock(key ? "No aircraft matches " + key : "No aircraft selected", "Search the catalogue by registration, model, manufacturer or serial.",
        '<div class="unit-24"></div>' + ctaButton("Explore assets", 'data-go="assets.html#search"'));
    afterRender(root);
    return;
  }
  document.title = a.registration + " " + a.manufacturer + " " + a.model + " | TRONAUT";
  root.innerHTML = hero(a) + sectionNav() + information(a) + rights(a) + history(a) + evidence(a) + onchainSkeleton() + attestations(a);
  afterRender(root);

  const body = document.getElementById("onchain-body");
  try {
    const { source } = await getSource();
    let rec = null, error = null;
    try { rec = await source.read("findAssetByRegistration", { registration: a.registration }); } catch (e) { error = e; }
    body.innerHTML = onchainBody(a, rec, source, error);
  } catch (e) {
    body.innerHTML = onchainBody(a, null, { kind: "demo" }, e);
  }
  afterRender(body);
}

root.addEventListener("click", function (e) {
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    const target = document.getElementById(jump.getAttribute("data-jump"));
    if (target && window.TronautMotion) window.TronautMotion.scrollTo(target);
    else if (target) target.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const go = e.target.closest("[data-go]");
  if (go) location.href = go.getAttribute("data-go");
});

init();
