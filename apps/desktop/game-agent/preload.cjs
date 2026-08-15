// Sandboxed Electron preload: intentionally self-contained (no local require()).
const { ipcRenderer } = require("electron");

try {
  if (window === window.top && /^(?:[^.]+\.)?pokewg\.com$/i.test(location.hostname)) {
    const clean = (value, limit = 10000) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
    const visible = element => { const style = getComputedStyle(element), rect = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; };
    const readUi = (root = document) => { const controls = [...root.querySelectorAll?.("button,[role=button],a") || []].filter(visible).map(element => clean(element.innerText || element.textContent || element.getAttribute("aria-label"), 160)).filter(Boolean); return { controls:controls.slice(0,120), maps:controls.filter(text => /\bNv\s*\d+/i.test(text)).slice(0,80), mapModalOpen:controls.some(text => /^Mapa$/i.test(text)) && controls.some(text => /\bNv\s*\d+/i.test(text)), marketOpen:controls.some(text => /Loja do Mark|Comprar Agora|Vender selecionados/i.test(text)), inventoryOpen:controls.some(text => /Mochila|Inventário|Capacidade/i.test(text)) }; };
    const applyReaders = (rawText, state) => {
      const text = clean(rawText); if (!text) return state;
      const identity = text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i); if (identity) { state.identity = { player:identity[1], level:Number(identity[2]), xpPercent:Number(identity[4]) }; state.location = { ...state.location, current:clean(identity[3],120) }; }
      const pokemon = text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i); if (pokemon) state.pokemon = { name:clean(pokemon[1],40), level:Number(pokemon[2]), hp:Number(pokemon[3]), maxHp:Number(pokemon[4]), xpPercent:Number(pokemon[5]) };
      const values = [...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map(match => ({ used:Number(match[1]),capacity:Number(match[2]) })).filter(value => value.capacity >= 100 && value.used <= value.capacity), inventory = values.find(value => value.capacity === 335) || values.at(-1); if (inventory) state.inventory = inventory;
      const collection = text.match(/Coleção\s+(\d+)\s*\/\s*(\d+)/i); if (collection) state.collection = { used:Number(collection[1]),total:Number(collection[2]) };
      const wallet = text.match(/(?:Gold|Dinheiro|\$)\s*[: ]?\s*([\d.]+)/i); if (wallet) state.wallet = { gold:Number(wallet[1].replace(/\./g,"")) };
      const current = state.location?.current || null, inCity = /^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(current || ""); state.game = { hunting:Boolean(current && !inCity),inCity,combat:/Batalha|Combate|Turno/i.test(text),disconnected:/desconect|reconect|offline|sessão expirada/i.test(text),penalty:/Punição:\s*-\d+%\s*XP/i.test(text) }; return state;
    };
    const state = { identity:null,location:{},pokemon:null,inventory:null,collection:null,wallet:null,game:{},ui:{} }; let previous = "", reconcileTimer;
    const publish = reason => { const serialized = JSON.stringify(state); if (serialized !== previous) { previous = serialized; ipcRenderer.send("vp:agent-delta",{ reason,snapshot:{ capturedAt:new Date().toISOString(),ready:Boolean(state.identity?.player),...state } }); } };
    const reconcile = reason => { applyReaders(document.body?.innerText || "",state); state.ui = readUi(document); publish(reason); };
    const onMutations = mutations => { const roots = [...new Set(mutations.map(mutation => mutation.target?.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target?.parentElement).filter(Boolean))].slice(0,30); for (const root of roots) applyReaders(root.innerText || root.textContent || "",state); if (roots.some(root => /Mapa|Mercado|Mochila|Inventário|Loja|Nv\s*\d+/i.test(root.textContent || ""))) state.ui = readUi(document); clearTimeout(reconcileTimer); reconcileTimer = setTimeout(() => publish("mutation"),120); };
    const start = () => { reconcile("bootstrap"); new MutationObserver(onMutations).observe(document.documentElement,{ childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","hidden","aria-hidden"] }); setInterval(() => reconcile("safety-reconcile"),30000); ipcRenderer.send("vp:agent-status",{ state:"READY",at:new Date().toISOString() }); };
    addEventListener("click",event => { const control = event.target?.closest?.("button,[role=button],a"); if (!control) return; const label = clean(control.innerText || control.textContent || control.getAttribute("aria-label"),160); if (label) ipcRenderer.send("vp:agent-action",{ label,at:new Date().toISOString() }); },true);
    if (document.readyState === "loading") addEventListener("DOMContentLoaded",start,{ once:true }); else start();
  }
} catch (error) { ipcRenderer.send("vp:agent-status",{ state:"ERROR",error:String(error?.stack || error).slice(0,2000),at:new Date().toISOString() }); }
