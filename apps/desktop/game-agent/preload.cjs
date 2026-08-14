const { ipcRenderer } = require("electron");
const { applyReaders } = require("./readers/state-readers.cjs");
const { readUi } = require("./readers/ui-reader.cjs");

if (process.isMainFrame && /^(?:test\.)?pokewg\.com$/i.test(location.hostname)) {
  const state = { identity: null, location: {}, pokemon: null, inventory: null, collection: null, wallet: null, game: {}, ui: {} };
  let previous = "", reconcileTimer;
  const publish = reason => {
    const serialized = JSON.stringify(state);
    if (serialized !== previous) { previous = serialized; ipcRenderer.send("vp:agent-delta", { reason, snapshot: { capturedAt: new Date().toISOString(), ready: Boolean(state.identity?.player), ...state } }); }
  };
  const reconcile = reason => { applyReaders(document.body?.innerText || "", state); state.ui = readUi(document); publish(reason); };
  const onMutations = mutations => {
    const roots = [...new Set(mutations.map(mutation => mutation.target?.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target?.parentElement).filter(Boolean))].slice(0, 30);
    for (const root of roots) applyReaders(root.innerText || root.textContent || "", state);
    if (roots.some(root => /Mapa|Mercado|Mochila|Inventário|Loja|Nv\s*\d+/i.test(root.textContent || ""))) state.ui = readUi(document);
    clearTimeout(reconcileTimer); reconcileTimer = setTimeout(() => publish("mutation"), 120);
  };
  const start = () => { reconcile("bootstrap"); new MutationObserver(onMutations).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "aria-hidden"] }); setInterval(() => reconcile("safety-reconcile"), 30000); };
  addEventListener("click", event => { const control = event.target?.closest?.("button,[role=button],a"); if (!control) return; const label = String(control.innerText || control.textContent || control.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 160); if (label) ipcRenderer.send("vp:agent-action", { label, at: new Date().toISOString() }); }, true);
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", start, { once: true }); else start();
}
