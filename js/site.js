/* Shared behaviour for every page: header wallet and network controls, the
   current page marker and live chain facts. Wallet controls reuse the header
   nav items, so they look like the rest of the navigation. */
import { CHAIN, CONTRACTS, TOKEN_ADDRESS } from "./config.js";
import { wallet, onWallet, connect, switchNetwork, isCorrectChain, shortAddress, latestBlock, explorer, readableError } from "./web3.js";
import { resolveMode } from "./contracts.js";
import { toast, hideDuplicates, tokenDisplay } from "./ui.js";

let mode = null;

function setLabels(el, text) {
  el.querySelectorAll("[data-label]").forEach(function (l) { l.textContent = text; });
}

function renderWallet() {
  document.querySelectorAll("[data-wallet-button]").forEach(function (btn) {
    const short = btn.hasAttribute("data-short");
    let text = short ? "Connect" : "Connect wallet";
    if (wallet.status === "connecting") text = "Connecting";
    if (wallet.status === "connected" && wallet.address) text = shortAddress(wallet.address);
    setLabels(btn, text);
    btn.dataset.state = wallet.status;
    btn.setAttribute("aria-label", wallet.status === "connected" ? "Wallet " + text + ", open wallet details" : "Connect wallet");
  });

  document.querySelectorAll("[data-network-status]").forEach(function (el) {
    let text = mode === "live" ? CHAIN.CHAIN_NAME : "Demo mode";
    let state = mode === "live" ? "live" : "demo";
    if (wallet.status === "connected" && wallet.chainId != null) {
      if (isCorrectChain(wallet.chainId)) { text = CHAIN.CHAIN_NAME; state = "ok"; }
      else { text = "Wrong network"; state = "wrong"; }
    }
    setLabels(el, text);
    el.dataset.state = state;
    el.setAttribute("aria-label", state === "wrong" ? "Wrong network. Switch to " + CHAIN.CHAIN_NAME : text);
  });
}

async function onWalletClick(e) {
  e.preventDefault();
  if (window.TronautMotion && window.TronautMotion.closeMenu) window.TronautMotion.closeMenu();
  if (wallet.status === "connected") {
    // Details, network switch and disconnect live on the Registry page.
    if (location.pathname.endsWith("app.html") || location.pathname.endsWith("/app")) {
      const target = document.getElementById("network");
      if (target && window.TronautMotion) window.TronautMotion.scrollTo(target);
      document.dispatchEvent(new CustomEvent("tronaut:show-network"));
    } else {
      location.href = "app.html#network";
    }
    return;
  }
  try {
    await connect();
    if (wallet.status === "connected" && !isCorrectChain(wallet.chainId)) toast("Connected. Switch to " + CHAIN.CHAIN_NAME + " to send transactions");
    else if (wallet.status === "connected") toast("Wallet connected");
  } catch (err) {
    toast(wallet.status === "unavailable" ? "No browser wallet found" : readableError(err));
  }
}

async function onNetworkClick(e) {
  if (wallet.status !== "connected" || isCorrectChain(wallet.chainId)) return; // plain link to the network panel
  e.preventDefault();
  try {
    await switchNetwork();
    toast("Switched to " + CHAIN.CHAIN_NAME);
  } catch (err) {
    toast(readableError(err));
  }
}

function renderToken() {
  const token = tokenDisplay(TOKEN_ADDRESS);
  document.querySelectorAll("[data-token]").forEach(function (block) {
    const text = block.querySelector("[data-token-address]");
    const copy = block.querySelector("[data-token-copy]");
    text.textContent = token.text;
    block.dataset.state = token.launched ? "live" : "soon";
    if (copy) {
      copy.hidden = !token.launched;
      if (token.launched) { copy.setAttribute("data-copy", token.text); copy.setAttribute("aria-label", "Copy token address"); }
    }
  });
}

function markCurrentPage() {
  const page = document.documentElement.getAttribute("data-page");
  document.querySelectorAll("[data-nav]").forEach(function (a) {
    if (a.getAttribute("data-nav") === page) a.setAttribute("aria-current", "page");
  });
}

async function chainFacts() {
  document.querySelectorAll("[data-chain-name]").forEach(function (el) { el.textContent = CHAIN.CHAIN_NAME; });
  document.querySelectorAll("[data-chain-id]").forEach(function (el) { el.textContent = String(CHAIN.CHAIN_ID); });
  document.querySelectorAll("[data-contract-status]").forEach(function (el) {
    const addr = CONTRACTS[el.getAttribute("data-contract-status")];
    if (!addr) { el.textContent = "Not deployed"; return; }
    const url = explorer("address", addr);
    el.innerHTML = "";
    const a = document.createElement(url ? "a" : "span");
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; a.className = "link-basic"; }
    a.textContent = addr.slice(0, 6) + "…" + addr.slice(-4);
    el.appendChild(a);
  });
  document.querySelectorAll("[data-explorer-home]").forEach(function (el) { if (CHAIN.BLOCK_EXPLORER_URL) el.href = CHAIN.BLOCK_EXPLORER_URL; });
  const blocks = document.querySelectorAll("[data-latest-block]");
  if (!blocks.length) return;
  async function tick() {
    try {
      const n = await latestBlock();
      blocks.forEach(function (el) {
        el.textContent = n.toLocaleString("en-US");
        el.title = "Latest block on " + CHAIN.CHAIN_NAME;
        const url = explorer("block", n);
        if (url && el.closest("a") == null) el.dataset.href = url;
      });
    } catch (e) {
      blocks.forEach(function (el) { el.textContent = "Offline"; el.title = "The public RPC did not answer"; });
    }
  }
  tick();
  setInterval(function () { if (!document.hidden) tick(); }, 12000);
}

document.querySelectorAll("[data-wallet-button]").forEach(function (b) { b.addEventListener("click", onWalletClick); });
document.querySelectorAll("[data-network-status]").forEach(function (b) { b.addEventListener("click", onNetworkClick); });
markCurrentPage();
renderToken();
hideDuplicates(document);
onWallet(renderWallet);
resolveMode().then(function (s) { mode = s.mode; renderWallet(); }).catch(function () { mode = "demo"; renderWallet(); });
chainFacts();
