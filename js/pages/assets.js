/* Explore assets: search and filter the aircraft catalogue.
   Filters live in the URL, so a search can be shared or bookmarked. */
import { loadCatalogue, searchAircraft, facets, overallState } from "../data.js";
import { esc, badge, goIcon, stateBlock, loadingBlock, afterRender } from "../ui.js";

const form = document.getElementById("search");
const results = document.getElementById("results");
const count = document.getElementById("result-count");
const reset = document.getElementById("reset");
const controls = ["q", "field", "manufacturer", "status", "state", "sort"].reduce(function (o, id) { o[id] = document.getElementById(id); return o; }, {});

let catalogue = null;

function readUrl() {
  const p = new URLSearchParams(location.search);
  Object.keys(controls).forEach(function (k) { if (p.has(k)) controls[k].value = p.get(k); });
}

function writeUrl() {
  const p = new URLSearchParams();
  Object.keys(controls).forEach(function (k) {
    const v = controls[k].value;
    if (v && !(k === "field" && v === "any") && !(k === "sort" && v === "registration")) p.set(k, v);
  });
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
}

function fillSelect(select, values) {
  const current = select.value;
  values.forEach(function (v) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
  select.value = current;
}

function row(a) {
  const href = "aircraft.html?reg=" + encodeURIComponent(a.registration);
  return '<a class="tr-row" href="' + href + '" aria-label="Open ' + esc(a.registration) + " " + esc(a.manufacturer + " " + a.model) + '">' +
    '<span class="tr-row_bg"></span>' +
    '<div class="c12 m-main"><div class="p5">' + esc(a.registration) + '</div>' + (a.demo ? '<div class="l1 text-gray">Demo record</div>' : "") + "</div>" +
    '<div class="c34 m-full"><div class="l1">' + esc(a.manufacturer + " " + a.model) + '</div><div class="l1 text-gray">' + esc(a.category) + "</div></div>" +
    '<div class="c5 m-half"><div class="l1 text-gray">Serial / MSN</div><div class="l1">' + esc(a.msn) + "</div></div>" +
    '<div class="c6 m-half2"><div class="l1 text-gray">' + esc(a.year) + '</div><div class="l1">' + esc(a.status) + "</div></div>" +
    '<div class="c7 m-side tr-between" style="align-items:center">' + badge(overallState(a)) + goIcon() + "</div>" +
    "</a>";
}

function render() {
  if (!catalogue) return;
  const list = searchAircraft(catalogue.aircraft, controls.q.value, {
    field: controls.field.value, manufacturer: controls.manufacturer.value, status: controls.status.value,
    state: controls.state.value, sort: controls.sort.value
  });
  const filtered = controls.q.value || controls.manufacturer.value || controls.status.value || controls.state.value || controls.field.value !== "any";
  reset.hidden = !filtered;
  count.textContent = list.length === 1 ? "1 aircraft" : list.length + " aircraft";
  if (!list.length) {
    results.innerHTML = stateBlock("No aircraft match", "Try a registration like N650TR or a model like Global 7500. Or clear the filters.",
      '<div class="unit-24"></div><button type="button" class="tr-copy l1" data-clear>Clear search and filters</button>');
  } else {
    results.innerHTML = '<div class="tr-row head m-hide-head"><div class="c12 l1">Registration</div><div class="c34 l1">Aircraft</div><div class="c5 l1">Serial</div><div class="c6 l1">Year / status</div><div class="c7 l1">Verification</div></div>' +
      list.map(row).join("");
  }
  writeUrl();
  afterRender(results);
}

function clearAll() {
  controls.q.value = ""; controls.field.value = "any"; controls.manufacturer.value = ""; controls.status.value = ""; controls.state.value = "";
  render();
  controls.q.focus();
}

async function init() {
  results.innerHTML = loadingBlock("Loading aircraft");
  readUrl();
  try {
    catalogue = await loadCatalogue();
  } catch (e) {
    count.textContent = "Unavailable";
    results.innerHTML = stateBlock("The catalogue could not be loaded", "Check your connection and reload the page.");
    return;
  }
  const f = facets(catalogue.aircraft);
  fillSelect(controls.manufacturer, f.manufacturer);
  fillSelect(controls.status, f.status);
  readUrl();
  if (!catalogue.dataset.demo) document.querySelectorAll("[data-mode-notice]").forEach(function (n) { n.hidden = true; });
  render();
  if (location.hash === "#search") controls.q.focus();
}

let timer = null;
controls.q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(render, 120); });
["field", "manufacturer", "status", "state", "sort"].forEach(function (k) { controls[k].addEventListener("change", render); });
form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
reset.addEventListener("click", clearAll);
results.addEventListener("click", function (e) { if (e.target.closest("[data-clear]")) clearAll(); });

init();
