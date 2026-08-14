(() => {
  const accountParam = new URLSearchParams(location.search).get("vpclient_account");
  if (accountParam && /^conta-\d{2}$/.test(accountParam)) {
    localStorage.setItem("vpclient:account", accountParam);
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("vpclient_account");
    history.replaceState(history.state, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
  const clean = (value, limit = 240) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  const visible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };
  const describe = element => ({
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: [...element.classList].slice(0, 10),
    role: element.getAttribute("role"),
    ariaLabel: clean(element.getAttribute("aria-label")),
    dataAttributes: Object.keys(element.dataset).slice(0, 12),
    text: clean(element.innerText || element.textContent)
  });

  const parseVisibleState = text => {
    const player = text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i);
    const activePokemon = text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i);
    const capacities = [...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)]
      .map(match => ({ used: Number(match[1]), total: Number(match[2]) }))
      .filter(value => value.total >= 100 && value.used <= value.total);
    const capacity = capacities.find(value => value.total === 335) || capacities.at(-1) || null;
    const channel = text.match(/([^\n]{1,50})\s*[·Â]+\s*Canal\s+(\d+)/i);
    const collection = text.match(/Cole[cç][aã]o\s+(\d+)\s*\/\s*(\d+)/i);
    const locationLabel = player ? clean(player[3]) : null;
    const inCity = Boolean(channel) || /^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(locationLabel || "");
    return {
      player: player ? { name: player[1], level: Number(player[2]), locationLabel: clean(player[3]), xpPercent: Number(player[4]) } : null,
      activePokemon: activePokemon ? { name: clean(activePokemon[1]), level: Number(activePokemon[2]), hp: Number(activePokemon[3]), maxHp: Number(activePokemon[4]), xpPercent: Number(activePokemon[5]) } : null,
      capacity,
      channel: channel ? { location: clean(channel[1]), number: Number(channel[2]) } : null,
      collection: collection ? { used: Number(collection[1]), total: Number(collection[2]) } : null,
      activity: {
        location: locationLabel,
        inCity,
        hunting: Boolean(locationLabel && !inCity),
        disconnected: /desconect|reconect|offline|sess[aã]o expirada/i.test(text),
        penalty: /Puni[cç][aã]o:\s*-\d+%\s*XP/i.test(text)
      },
      panels: {
        map: /\bKanto\b[\s\S]*\bOutland\b/i.test(text),
        collection: /Cole[cç][aã]o\s+\d+\s*\/\s*\d+/i.test(text),
        market: /Loja do Mark|An[uú]ncios|Comprar Agora/i.test(text),
        npcShop: /Comprar\s*[·Â]+\s*\$/i.test(text),
        sell: /\bVender\b/i.test(text)
      }
    };
  };

  function liveState() {
    const parsed = parseVisibleState(clean(document.body?.innerText, 30000));
    if (parsed.activity?.hunting) localStorage.setItem("vpclient:lastHunt", parsed.activity.location);
    return {
      capturedAt: new Date().toISOString(), hostname: location.hostname, path: location.pathname,
      parsed, lastHunt: localStorage.getItem("vpclient:lastHunt"),
      ready: location.pathname.startsWith("/play") && Boolean(parsed.player),
      mode: localStorage.getItem("vpclient:mode") || "monitor",
      cycle: readCycle()
    };
  }

  async function publishTelemetry() {
    const accountId = localStorage.getItem("vpclient:account");
    if (!accountId) return;
    try {
      await fetch("http://127.0.0.1:8789/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, state: liveState() })
      });
    } catch { /* O launcher pode estar fechado; o jogo continua normalmente. */ }
  }

  const findButton = pattern => [...document.querySelectorAll("button, [role=button], a")]
    .filter(visible).find(element => pattern.test(clean(element.innerText || element.textContent || element.getAttribute("aria-label"))));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cycleEvent = name => ({ at:new Date().toISOString(), name });
  const readCycle = () => { try { return JSON.parse(localStorage.getItem("vpclient:cycle") || "null"); } catch { return null; } };
  const writeCycle = value => { localStorage.setItem("vpclient:cycle", JSON.stringify(value)); return value; };
  const updateCycle = (status, extra={}) => { const current=readCycle() || {id:crypto.randomUUID(),startedAt:new Date().toISOString(),log:[]}; return writeCycle({...current,...extra,status,log:[...(current.log||[]),cycleEvent(status)]}); };
  const isAllowedHost = () => {
    return location.hostname === "test.pokewg.com" || location.hostname === "pokewg.com";
  };

  async function openRemoteShopTest() {
    if (!isAllowedHost()) throw new Error("Ações permitidas apenas nos domínios oficiais do PokeWG.");
    const steps = [];
    let button = findButton(/^MERCADO$|^Mercado$/i);
    if (!button) throw new Error("Botão Mercado não encontrado.");
    button.click(); steps.push("mercado"); await pause(900);
    button = findButton(/Loja do Mark/i);
    if (!button) throw new Error("Loja do Mark não apareceu no Mercado Global.");
    const locked = /🔒|faltam|ticket/i.test(clean(button.innerText || button.textContent));
    button.click(); steps.push(locked ? "loja-mark-bloqueada-clicada" : "loja-mark"); await pause(900);
    button = findButton(/Vender/i);
    if (!button) throw new Error(locked ? "Backend/cliente de teste ainda exige Ticket Mercador." : "Aba Vender não apareceu.");
    button.click(); steps.push("vender"); await pause(700);
    return { ok: true, environment: location.hostname, steps, remoteShopOpened: true };
  }

  async function sellAllTest() {
    if (!isAllowedHost()) throw new Error("Venda permitida apenas nos domínios oficiais do PokeWG.");
    const itemButtons = [...document.querySelectorAll("button.ui-card-btn")].filter(visible);
    if (!itemButtons.length) throw new Error("Nenhum loot vendável visível. Abra a aba Vender primeiro.");
    const preview = itemButtons.map(element => clean(element.innerText || element.textContent));
    const selectAll = findButton(/Selecionar tudo/i);
    if (!selectAll) throw new Error("Selecionar tudo não encontrado.");
    selectAll.click(); await pause(400);
    const confirm = findButton(/Vender selecionados\s*\([1-9]\d*\)/i);
    if (!confirm) throw new Error("Botão de confirmação não ficou habilitado; nada foi vendido.");
    const confirmationText = clean(confirm.innerText || confirm.textContent);
    confirm.click(); await pause(900);
    return { ok: true, environment: location.hostname, preview, confirmationText, executedAt: new Date().toISOString() };
  }

  function getSellPreview() {
    const items = [...document.querySelectorAll("button.ui-card-btn")].filter(visible).map(element => {
      const value = clean(element.innerText || element.textContent);
      const match = value.match(/^(.+?)\s+[×x]\s*(\d+)\s+\$([\d.]+)\s+cada\s+\$([\d.]+)$/i);
      return match ? { name: clean(match[1]), quantity: Number(match[2]), unitPrice: Number(match[3].replace(/\./g,"")), totalPrice: Number(match[4].replace(/\./g,"")) } : null;
    }).filter(Boolean);
    return { items, totalItems: items.reduce((s,i)=>s+i.quantity,0), totalValue: items.reduce((s,i)=>s+i.totalPrice,0) };
  }

  async function prepareSale() {
    if ((localStorage.getItem("vpclient:mode") || "monitor") !== "assisted") throw new Error("Ative o modo Assistido primeiro.");
    const steps=[];
    if (liveState().parsed.activity?.hunting) { const back=findButton(/Voltar\s+(à|a)\s+Cidade/i); if(!back)throw new Error("Voltar à Cidade não encontrado."); back.click();steps.push("cidade");await pause(1800); }
    const market=findButton(/^MERCADO$|^Mercado$/i);if(!market)throw new Error("Mercado não encontrado.");market.click();steps.push("mercado");await pause(900);
    const mark=findButton(/Loja do Mark/i);if(!mark)throw new Error("Loja do Mark não encontrada.");if(/🔒|ticket/i.test(clean(mark.innerText||mark.textContent)))throw new Error("Loja do Mark está bloqueada neste local.");mark.click();steps.push("loja");await pause(900);
    const sell=findButton(/Vender/i);if(!sell)throw new Error("Aba Vender não encontrada.");sell.click();steps.push("vender");await pause(700);
    return {ok:true,steps,preview:getSellPreview(),lastHunt:localStorage.getItem("vpclient:lastHunt")};
  }

  async function confirmAssistedSale() {
    if ((localStorage.getItem("vpclient:mode") || "monitor") !== "assisted") throw new Error("Ative o modo Assistido primeiro.");
    const preview=getSellPreview();if(!preview.items.length)throw new Error("Nenhum loot reconhecido.");const all=findButton(/Selecionar tudo/i);if(!all)throw new Error("Selecionar tudo não encontrado.");all.click();await pause(350);const confirm=findButton(/Vender selecionados\s*\([1-9]\d*\)/i);if(!confirm)throw new Error("Confirmação indisponível.");const confirmationText=clean(confirm.innerText||confirm.textContent);confirm.click();await pause(900);return {ok:true,preview,confirmationText};
  }

  async function returnToLastHunt() {
    if ((localStorage.getItem("vpclient:mode") || "monitor") !== "assisted") throw new Error("Ative o modo Assistido primeiro.");
    const hunt=localStorage.getItem("vpclient:lastHunt");if(!hunt)throw new Error("Última hunt desconhecida.");const closes=[...document.querySelectorAll('button[aria-label="Fechar"],button.ui-iconbtn--close')].filter(visible);closes.at(-1)?.click();await pause(350);const map=findButton(/^MAPA$|^Mapa$/i);if(!map)throw new Error("Mapa não encontrado.");map.click();await pause(900);const escaped=hunt.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const target=findButton(new RegExp(`^${escaped}\\s+Nv\\s+\\d+`,"i"));if(!target)throw new Error(`Hunt ${hunt} não encontrada.`);target.click();await pause(1200);return {ok:true,hunt};
  }

  async function startFullCycle() {
    const current=readCycle();
    if(current && !["completed","cancelled","failed"].includes(current.status)) throw new Error(`Já existe um ciclo em andamento: ${current.status}.`);
    writeCycle({id:crypto.randomUUID(),status:"preparing",startedAt:new Date().toISOString(),lastHunt:localStorage.getItem("vpclient:lastHunt"),log:[cycleEvent("preparing")]});
    const prepared = await prepareSale();
    if (!prepared.preview.items.length) { updateCycle("failed",{error:"Nenhum loot reconhecido."}); throw new Error("Nenhum loot reconhecido. Nada foi vendido."); }
    updateCycle("awaiting-confirmation",{preview:prepared.preview,lastHunt:prepared.lastHunt});
    return { ok:true, phase:"awaiting-confirmation", preview:prepared.preview, lastHunt:prepared.lastHunt };
  }

  async function completeFullCycle() {
    const cycle=readCycle();
    if(!cycle || cycle.status!=="awaiting-confirmation") throw new Error("Não há ciclo preparado aguardando confirmação.");
    updateCycle("selling");
    const sold = await confirmAssistedSale();
    updateCycle("returning",{sold:sold.preview,confirmationText:sold.confirmationText});
    const returned = await returnToLastHunt();
    const result = { ok:true, sold:sold.preview, confirmationText:sold.confirmationText, returnedTo:returned.hunt, completedAt:new Date().toISOString() };
    localStorage.setItem("vpclient:lastCycle", JSON.stringify(result));
    updateCycle("completed",{result,completedAt:result.completedAt});
    return result;
  }

  function cancelCycle() { const current=readCycle();if(!current)return {ok:true,status:"idle"};if(["selling","returning"].includes(current.status))return {ok:false,error:`Não é seguro cancelar durante ${current.status}.`};return {ok:true,...updateCycle("cancelled",{cancelledAt:new Date().toISOString()})}; }

  publishTelemetry();
  setInterval(publishTelemetry, 2000);

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "VP_GET_LIVE_STATE") { respond(liveState()); return; }
    if (message?.type === "VP_SET_MODE") {
      if (!["monitor", "assisted"].includes(message.mode)) { respond({ ok: false, error: "Modo inválido." }); return; }
      localStorage.setItem("vpclient:mode", message.mode); respond({ ok: true, mode: message.mode }); return;
    }
    if (message?.type === "VP_PREPARE_SALE") { prepareSale().then(respond).catch(e=>respond({ok:false,error:e.message})); return true; }
    if (message?.type === "VP_CONFIRM_SALE") { confirmAssistedSale().then(respond).catch(e=>respond({ok:false,error:e.message})); return true; }
    if (message?.type === "VP_RETURN_HUNT") { returnToLastHunt().then(respond).catch(e=>respond({ok:false,error:e.message})); return true; }
    if (message?.type === "VP_START_FULL_CYCLE") { startFullCycle().then(respond).catch(e=>respond({ok:false,error:e.message})); return true; }
    if (message?.type === "VP_COMPLETE_FULL_CYCLE") { completeFullCycle().then(respond).catch(e=>{updateCycle("failed",{error:e.message});respond({ok:false,error:e.message})}); return true; }
    if (message?.type === "VP_CANCEL_CYCLE") { respond(cancelCycle()); return; }
    if (message?.type === "VP_OPEN_REMOTE_SHOP_TEST") {
      openRemoteShopTest().then(respond).catch(error => respond({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "VP_SELL_ALL_TEST") {
      sellAllTest().then(respond).catch(error => respond({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type !== "VP_CAPTURE") return;
    const keyword = /mapa|map|mochila|bag|invent[aá]rio|inventory|n[ií]vel|level|loot|vender|sell|ca[cç]a|hunt|pokemon|pokémon|mercado|market/i;
    const controls = [...document.querySelectorAll("button, [role=button], a")].filter(visible).slice(0, 400).map(describe);
    const candidates = [...document.querySelectorAll("[id], [class], [data-testid], [aria-label]")]
      .filter(visible)
      .filter(element => keyword.test(`${element.id} ${element.className} ${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`))
      .slice(0, 500).map(describe);
    const bodyText = clean(document.body?.innerText, 30000);
    const sellItems = [...document.querySelectorAll("button.ui-card-btn")].map(element => {
      const text = clean(element.innerText || element.textContent);
      const match = text.match(/^(.+?)\s+[×x]\s*(\d+)\s+\$([\d.]+)\s+cada\s+\$([\d.]+)$/i);
      if (!match) return null;
      return {
        name: clean(match[1]),
        quantity: Number(match[2]),
        unitPrice: Number(match[3].replace(/\./g, "")),
        totalPrice: Number(match[4].replace(/\./g, ""))
      };
    }).filter(Boolean);
    const sellTotal = sellItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const sanitizeUrl = raw => {
      try {
        const url = new URL(raw, location.href);
        return `${url.origin}${url.pathname}`;
      } catch { return null; }
    };
    const resources = [...new Set(performance.getEntriesByType("resource").map(entry => sanitizeUrl(entry.name)).filter(Boolean))];
    const scripts = [...new Set([...document.scripts].map(script => sanitizeUrl(script.src)).filter(Boolean))];
    const publicInventory = {
      scripts,
      sameOriginResources: resources.filter(url => url.startsWith(location.origin)),
      apiCandidates: resources.filter(url => /\/api\/|graphql|socket|ws\b|market|map|hunt|inventory|bag|player/i.test(url)),
      thirdPartyOrigins: [...new Set(resources.filter(url => !url.startsWith(location.origin)).map(url => new URL(url).origin))]
    };
    respond({
      formatVersion: 1,
      capturedAt: new Date().toISOString(),
      page: { title: clean(document.title), url: `${location.origin}${location.pathname}` },
      storage: { localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage) },
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      controls,
      candidates,
      parsed: parseVisibleState(bodyText),
      sellSimulation: {
        mode: "read-only",
        items: sellItems,
        totalItems: sellItems.reduce((sum, item) => sum + item.quantity, 0),
        totalValue: sellTotal
      },
      publicInventory,
      visibleText: bodyText
    });
  });
})();
