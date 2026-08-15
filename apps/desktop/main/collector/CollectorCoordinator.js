import crypto from "node:crypto";

export class CollectorCoordinator {
  constructor(repository, events, sessionRunIds) { this.repository = repository; this.events = events; this.sessionRunIds = sessionRunIds; this.states = new Map(); this.lastSamples = new Map(); this.contexts = new Map(); }
  ingest(accountId, payload, timestamp = new Date().toISOString()) {
    if (!payload?.patch || typeof payload.patch !== "object") return null;
    const previous = this.states.get(accountId) || {}, current = { ...previous,...payload.patch,capturedAt:timestamp,ready:Boolean(payload.ready ?? previous.ready) }; this.states.set(accountId, current);
    const sessionRunId = this.sessionRunIds.get(accountId);
    if (current.ready && !previous?.ready) this.emit(accountId, sessionRunId, "GAME_READY", { player: current.identity?.player });
    if (current.identity?.player && current.identity.player !== previous.identity?.player) this.emit(accountId,sessionRunId,"PLAYER_IDENTIFIED",{ player:current.identity.player,level:current.identity.level??null });
    if (previous.identity?.level != null && current.identity?.level != null && previous.identity.level !== current.identity.level) this.emit(accountId,sessionRunId,"PLAYER_LEVEL_CHANGED",{ previous:previous.identity.level,current:current.identity.level });
    if (previous.identity?.xpPercent != null && current.identity?.xpPercent != null && previous.identity.xpPercent !== current.identity.xpPercent) this.emit(accountId,sessionRunId,"PLAYER_XP_CHANGED",{ previous:previous.identity.xpPercent,current:current.identity.xpPercent,unit:"percent" });
    const from = previous?.location?.current, to = current.location?.current; if (from && to && from !== to) this.emit(accountId, sessionRunId, "MAP_ENTERED", { from, to });
    const oldHp = previous?.pokemon?.hp, hp = current.pokemon?.hp; if (oldHp != null && hp != null && hp !== oldHp) this.emit(accountId, sessionRunId, "POKEMON_HP_CHANGED", { previous: oldHp, current: hp });
    const oldGold = previous?.wallet?.gold, gold = current.wallet?.gold; if (oldGold != null && gold != null && gold !== oldGold) this.emit(accountId, sessionRunId, "GOLD_CHANGED", { previous: oldGold, current: gold, delta: gold-oldGold });
    if (previous.inventory && current.inventory && (previous.inventory.used !== current.inventory.used || previous.inventory.capacity !== current.inventory.capacity)) this.emit(accountId,sessionRunId,"INVENTORY_CHANGED",{ previous:previous.inventory,current:current.inventory });
    if (!previous.game?.disconnected && current.game?.disconnected) this.emit(accountId,sessionRunId,"GAME_DISCONNECTED",{}); else if (previous.game?.disconnected && !current.game?.disconnected) this.emit(accountId,sessionRunId,"GAME_RECONNECTED",{});
    for (const map of current.ui?.maps || []) this.repository.observeMap(map);
    for (const label of current.ui?.controls || []) { const surface = this.surface(label); if (surface) this.repository.discoverUi({ fingerprint: crypto.createHash("sha256").update(`${surface}:${label}`).digest("hex"), surface, label }); }
    const opened = current.ui?.marketOpen ? "MARKET" : current.ui?.inventoryOpen ? "INVENTORY" : current.ui?.mapModalOpen ? "MAP" : null; const previousOpened = previous?.ui?.marketOpen ? "MARKET" : previous?.ui?.inventoryOpen ? "INVENTORY" : previous?.ui?.mapModalOpen ? "MAP" : null; if (opened && opened !== previousOpened) this.emit(accountId, sessionRunId, "UI_SURFACE_OPENED", { surface: opened }); const oldContext = this.contexts.get(accountId) || {}, location = current.location?.current || null; this.contexts.set(accountId, { ...oldContext, uiSurface: opened, uiChangedAt: opened !== previousOpened ? Date.now() : oldContext.uiChangedAt, location, locationChangedAt: location !== oldContext.location ? Date.now() : oldContext.locationChangedAt });
    const now = Date.now(), last = this.lastSamples.get(accountId) || 0; if (!last || now-last >= 15000 || from !== to) { this.repository.sample(accountId, sessionRunId, current); this.lastSamples.set(accountId, now); }
    return { current,previous,changed:Array.isArray(payload.changed) ? payload.changed : [] };
  }
  emit(accountId, sessionRunId, type, payload) { this.repository.gameEvent(accountId, sessionRunId, type, payload); this.events.add({ accountId, sessionRunId, type, payload }); }
  surface(label) { if (/^Mapa$/i.test(label)) return "MAP_BUTTON"; if (/\bNv\s*\d+/i.test(label)) return "MAP_SELECTION"; if (/Mercado/i.test(label)) return "MARKET_BUTTON"; if (/Mochila|Inventário/i.test(label)) return "INVENTORY_BUTTON"; if (/Voltar\s+(à|a)\s+Cidade/i.test(label)) return "RETURN_CITY_BUTTON"; return null; }
  state(accountId) { return this.states.get(accountId) || null; }
  context(accountId) { return this.contexts.get(accountId) || {}; }
  recordUiAction(accountId, label) { const surface = this.surface(label); if (!surface) return false; const cleanLabel = String(label).slice(0,160),context = this.contexts.get(accountId) || {}; this.contexts.set(accountId,{ ...context,lastUiAction:surface,uiActionLabel:cleanLabel,uiActionAt:Date.now() }); this.events.add({ accountId,sessionRunId:this.sessionRunIds.get(accountId),type:"UI_ACTION",payload:{ surface,label:cleanLabel } }); return true; }
}
