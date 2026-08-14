(() => {
  if (window.__vpAgent?.version) return;

  const clean = (value, limit = 30000) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  const visible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const parse = text => {
    const player = text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i);
    const pokemon = text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i);
    const capacities = [...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map(match => ({ used: Number(match[1]), total: Number(match[2]) })).filter(value => value.total >= 100 && value.used <= value.total);
    const collection = text.match(/Cole[cç][aã]o\s+(\d+)\s*\/\s*(\d+)/i);
    const location = player?.[3]?.replace(/\s+/g, " ").trim() || null;
    const inCity = /^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(location || "");
    return {
      player: player ? { name: player[1], level: Number(player[2]), locationLabel: location, xpPercent: Number(player[4]) } : null,
      activePokemon: pokemon ? { name: pokemon[1].trim(), level: Number(pokemon[2]), hp: Number(pokemon[3]), maxHp: Number(pokemon[4]), xpPercent: Number(pokemon[5]) } : null,
      capacity: capacities.find(value => value.total === 335) || capacities.at(-1) || null,
      collection: collection ? { used: Number(collection[1]), total: Number(collection[2]) } : null,
      activity: { location, inCity, hunting: Boolean(location && !inCity), disconnected: /desconect|reconect|offline|sess[aã]o expirada/i.test(text) }
    };
  };
  const readMaps = () => [...document.querySelectorAll("button,[role=button],a")]
    .filter(visible)
    .map(element => clean(element.innerText || element.textContent, 160))
    .filter(text => /\bNv\s*\d+/i.test(text));
  const reconcile = () => {
    const parsed = parse(clean(document.body?.innerText));
    window.__vpAgent.snapshot = { capturedAt: new Date().toISOString(), ready: Boolean(parsed.player), parsed, maps: readMaps() };
  };
  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(reconcile, 180); };

  window.__vpAgent = { version: 1, snapshot: null, reconcile, listMaps: readMaps };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "aria-hidden"] });
  reconcile();
  setInterval(reconcile, 20000);
})();
