/* Small render helpers shared by the app pages. They only emit markup built
   from the template classes (l1, p5, p7, line-h, btn-cta_btn-icon ...). */
import { explorer, shortHash, shortAddress } from "./web3.js";
import { STATE_TEXT } from "./data.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ESC[c]; });
}

export const STATE_LABEL = { verified: "Verified", reported: "Reported", unverified: "Unverified", unknown: "Unknown" };

export function badge(state, label) {
  const s = STATE_LABEL[state] ? state : "unknown";
  const text = label || STATE_LABEL[s];
  const title = STATE_TEXT[s] ? ' title="' + esc(STATE_TEXT[s]) + '"' : "";
  return '<span class="badge" data-state="' + esc(label ? state : s) + '"' + title + ">" + esc(text) + "</span>";
}

export function demoBadge(text) {
  return '<span class="badge" data-state="demo" title="Sample data, not a real aircraft">' + esc(text || "Demo") + "</span>";
}

export function notRecorded(text) {
  return '<span class="tr-muted">' + esc(text || "Not recorded") + "</span>";
}

export function fmtDate(value) {
  if (value == null || value === "") return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(value) {
  if (value == null || value === "") return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function hashCell(hash, opts) {
  if (!hash) return notRecorded((opts && opts.empty) || "Not recorded");
  const demo = opts && opts.demo ? " " + demoBadge(opts.demoLabel || "Demo hash") : "";
  return '<span class="tr-wrap" title="' + esc(hash) + '">' + esc(shortHash(hash)) + '</span><button type="button" class="tr-copy l1" data-copy="' + esc(hash) + '" aria-label="Copy hash">Copy</button>' + demo;
}

export function linkOut(kind, value, text) {
  const url = explorer(kind, value);
  const label = text || (kind === "address" ? shortAddress(value) : kind === "block" ? "#" + value : shortHash(value));
  if (!url) return esc(label);
  return '<a class="link-basic" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
}

export function txCell(tx, emptyText) {
  return tx ? linkOut("tx", tx) : notRecorded(emptyText || "No transaction");
}

export function kv(label, valueHtml) {
  return '<div class="l1-item"><div class="l1 text-gray">' + esc(label) + '</div><div class="l1">' + valueHtml + "</div></div>";
}

export function sectionHead(label, meta) {
  return '<div class="line-h"></div><div class="unit-12"></div><div class="tr-head"><h2 class="l1">' + esc(label) + "</h2>" +
    (meta ? '<div class="l1 text-gray">' + meta + "</div>" : "") + "</div>";
}

const ARROW = '<svg width="100%" height="100%" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.2 4.8 16.4 10l-5.2 5.2-.94-.94 3.59-3.6H3.6V9.34h10.25l-3.6-3.6.95-.94Z" fill="currentColor"/></svg>';
export function goIcon() {
  return '<div class="tr-go"><div class="btn-cta_btn-icon"><div class="btn-cta_btn-icon_icon"><div class="ico-20">' + ARROW + "</div></div></div></div>";
}

export function stateBlock(title, text, extraHtml) {
  return '<div class="tr-state"><div class="p5">' + esc(title) + "</div>" + (text ? '<p class="p7 text-gray">' + esc(text) + "</p>" : "") + (extraHtml || "") + "</div>";
}

export function loadingBlock(text) {
  return '<div class="tr-state tr-loading" role="status"><div class="l1 text-gray">' + esc(text || "Loading records") + "</div></div>";
}

export function ctaButton(label, attrs) {
  return '<span class="tr-cta"><button type="button" class="btn-cta w-inline-block" hover="btn-cta" ' + (attrs || "") + '>' +
    '<div class="btn-cta_btn"><div class="btn-cta_btn_label"><div hover="text" class="t7">' + esc(label) + '</div><div hover="text" class="t7 is-2">' + esc(label) + "</div></div></div>" +
    '<div class="btn-cta_btn-icon"><div class="btn-cta_btn-icon_icon"><div hover="icon" class="ico-20 w-embed">' + ARROW + '</div><div hover="icon" class="ico-20 is-2 w-embed">' + ARROW + "</div></div></div></button></span>";
}

let toastTimer = null;
export function toast(message) {
  let el = document.querySelector(".tr-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "tr-toast l1";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(function () { el.classList.add("show"); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3200);
}

/* Hover duplicates are decoration; screen readers should read each label once. */
export function hideDuplicates(scope) {
  (scope || document).querySelectorAll('[hover="text"].is-2, [hover="icon"].is-2').forEach(function (el) { el.setAttribute("aria-hidden", "true"); });
}

/* Fallback for browsers without the async clipboard API. */
function legacyCopy(value) {
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  area.remove();
  return ok;
}

/* One delegated handler for every Copy button on the page. */
if (typeof document !== "undefined") document.addEventListener("click", function (e) {
  const btn = e.target.closest && e.target.closest("[data-copy]");
  if (!btn) return;
  e.preventDefault();
  const value = btn.getAttribute("data-copy");
  (navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(value) : Promise.reject())
    .catch(function () { if (!legacyCopy(value)) throw new Error("blocked"); })
    .then(function () { toast("Copied to clipboard"); })
    .catch(function () { toast("Copy is blocked in this browser"); });
});

export function afterRender(scope) {
  hideDuplicates(scope);
  if (window.TronautMotion) {
    window.TronautMotion.bind(scope);
    window.TronautMotion.refresh();
  }
}

/* Token address rule: empty, null or whitespace means not launched yet. */
export function tokenDisplay(value) {
  const v = value == null ? "" : String(value).trim();
  return v ? { launched: true, text: v } : { launched: false, text: "Coming soon" };
}

export function params() {
  return new URLSearchParams(location.search);
}
