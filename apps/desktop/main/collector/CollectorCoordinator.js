import crypto from "node:crypto";

export class CollectorCoordinator {
  constructor(repository, events, sessionRunIds) { this.repository = repository; this.events = events; this.sessionRunIds = sessionRunIds; this.states = new Map(); this.lastSamples = new Map(); this.contexts = new Map(); }
  ingest(accountId, payload) {
    if (!payload?.snapshot || typeof payload.snapshot !== "object") return null;
    const current = payload.snapshot, previous = this.states.get(accountId); this.states.set(accountId, current);
    const sessionRunId = this.sessionRunIds.get(accountId);
    if (current.ready && !previous?.ready) this.emit(accountId, sessionRunId, "GAME_READY", { player: current.identity?.player });
    const from = previous?.location?.current, to = current.location?.current; if (from && to && from !== to) this.emit(accountId, sessionRunId, "MAP_ENTERED", { from, to });
    const oldHp = previous?.pokemon?.hp, hp = current.pokemon?.hp; if (oldHp != null && hp != null && hp !== oldHp) this.emit(accountId, sessionRunId, "POKEMON_HP_CHANGED", { previous: oldHp, current: hp });
    const oldGold = previous?.wallet?.gold, gold = current.wallet?.gold; if (oldGold != null && gold != null && gold !== oldGold) this.emit(accountId, sessionRunId, "GOLD_CHANGED", { previous: oldGold, current: gold, delta: gold-oldGold });
    for (const map of current.ui?.maps || []) this.repository.observeMap(map);
    for (const label of current.ui?.controls || []) { const surface = this.surface(label); if (surface) this.repository.discoverUi({ fingerprint: crypto.createHash("sha256").update(`${surface}:${label}`).digest("hex"), surface, label }); }
    const opened = current.ui?.marketOpen ? "MARKET" : current.ui?.inventoryOpen ? "INVENTORY" : current.ui?.mapModalOpen ? "MAP" : null; const previousOpened = previous?.ui?.marketOpen ? "MARKET" : previous?.ui?.inventoryOpen ? "INVENTORY" : previous?.ui?.mapModalOpen ? "MAP" : null; if (opened && opened !== previousOpened) this.emit(accountId, sessionRunId, "UI_SURFACE_OPENED", { surface: opened }); this.contexts.set(accountId, { uiSurface: opened, location: current.location?.current || null, changedAt: Date.now() });
    const now = Date.now(), last = this.lastSamples.get(accountId) || 0; if (!last || now-last >= 15000 || from !== to) { this.repository.sample(accountId, sessionRunId, current); this.lastSamples.set(accountId, now); }
    return current;
  }
  emit(accountId, sessionRunId, type, payload) { this.repository.gameEvent(accountId, sessionRunId, type, payload); this.events.add({ accountId, sessionRunId, type, payload }); }
  surface(label) { if (/^Mapa$/i.test(label)) return "MAP_BUTTON"; if (/Mercado/i.test(label)) return "MARKET_BUTTON"; if (/Mochila|Inventário/i.test(label)) return "INVENTORY_BUTTON"; if (/Voltar\s+(à|a)\s+Cidade/i.test(label)) return "RETURN_CITY_BUTTON"; return null; }
  state(accountId) { return this.states.get(accountId) || null; }
  context(accountId) { return this.contexts.get(accountId) || {}; }
}
