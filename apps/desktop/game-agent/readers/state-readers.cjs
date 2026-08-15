const clean = (value, limit = 10000) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

function readIdentity(text, state) {
  const match = text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i);
  if (match) state.identity = { player: match[1], level: Number(match[2]), xpPercent: Number(match[4]) };
  const location = text.match(/(?:Mapa|Local|Localiza[cÃ§][aÃ£]o)\s*[:\-]\s*(.{2,60}?)(?=\s+(?:XP|HP|Gold|Dinheiro|Capacidade|Mochila|Invent[aÃ¡]rio)\b|$)/iu);
  if (location) state.location = { ...state.location, current: clean(location[1], 60) };
}
function readPokemon(text, state) {
  const match = text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i);
  if (match) state.pokemon = { name: clean(match[1], 40), level: Number(match[2]), hp: Number(match[3]), maxHp: Number(match[4]), xpPercent: Number(match[5]) };
}
function readInventory(text, state) {
  const inventory = text.match(/(?:Capacidade|Mochila|Invent[aÃ¡]rio)[^\d]{0,40}(\d+)\s*\/\s*(\d+)/i);
  if (inventory) state.inventory = { used: Number(inventory[1]), capacity: Number(inventory[2]) };
  const collection = text.match(/Cole[cç][aã]o\s+(\d+)\s*\/\s*(\d+)/i); if (collection) state.collection = { used: Number(collection[1]), total: Number(collection[2]) };
}
function readGame(text, state) {
  const current = state.location?.current || null;
  const inCity = /^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(current || "");
  state.game = { hunting: Boolean(current && !inCity), inCity, combat: /Batalha|Combate|Turno/i.test(text), disconnected: /desconect|reconect|offline|sess[aã]o expirada/i.test(text), penalty: /Puni[cç][aã]o:\s*-\d+%\s*XP/i.test(text) };
}
function readWallet(text, state) { const match = text.match(/(?:Gold|Dinheiro|\$)\s*[: ]?\s*([\d.]+)/i); if (match) state.wallet = { gold: Number(match[1].replace(/\./g, "")) }; }

function applyReaders(rawText, state) { const text = clean(rawText); if (!text) return state; readIdentity(text, state); readPokemon(text, state); readInventory(text, state); readWallet(text, state); readGame(text, state); return state; }
module.exports = { applyReaders, clean };
