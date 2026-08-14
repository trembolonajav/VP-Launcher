function visible(element) { const style = getComputedStyle(element), rect = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; }
function readUi(root = document) {
  const controls = [...root.querySelectorAll?.("button,[role=button],a") || []].filter(visible).map(element => String(element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  return { controls: controls.slice(0, 120), maps: controls.filter(text => /\bNv\s*\d+/i.test(text)).slice(0, 80), mapModalOpen: controls.some(text => /^Mapa$/i.test(text)) && controls.some(text => /\bNv\s*\d+/i.test(text)), marketOpen: controls.some(text => /Loja do Mark|Comprar Agora|Vender selecionados/i.test(text)), inventoryOpen: controls.some(text => /Mochila|Inventário|Capacidade/i.test(text)) };
}
module.exports = { readUi };
