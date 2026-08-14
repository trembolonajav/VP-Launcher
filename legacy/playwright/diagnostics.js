import fs from "node:fs";
import path from "node:path";

const MAX_EVENTS = 5000;

function clean(value, limit = 180) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export function createDiagnostics(reportDir) {
  fs.mkdirSync(reportDir, { recursive: true });
  const eventsFile = path.join(reportDir, "network-events.jsonl");
  let eventCount = 0;

  function appendEvent(event) {
    if (eventCount >= MAX_EVENTS) return;
    eventCount += 1;
    fs.appendFileSync(eventsFile, `${JSON.stringify(event)}\n`, "utf8");
  }

  function attach(page) {
    page.on("request", request => {
      const type = request.resourceType();
      if (!["xhr", "fetch", "websocket"].includes(type)) return;
      appendEvent({
        at: new Date().toISOString(),
        kind: "request",
        method: request.method(),
        resourceType: type,
        url: safeUrl(request.url())
      });
    });

    page.on("response", response => {
      const request = response.request();
      if (!["xhr", "fetch"].includes(request.resourceType())) return;
      appendEvent({
        at: new Date().toISOString(),
        kind: "response",
        status: response.status(),
        resourceType: request.resourceType(),
        url: safeUrl(response.url())
      });
    });

    page.on("websocket", socket => {
      appendEvent({ at: new Date().toISOString(), kind: "websocket", url: safeUrl(socket.url()) });
    });
  }

  async function snapshot(page) {
    const state = await page.evaluate(() => {
      const visible = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const describe = element => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: [...element.classList].slice(0, 8),
        role: element.getAttribute("role"),
        ariaLabel: element.getAttribute("aria-label"),
        text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180)
      });
      const controls = [...document.querySelectorAll("button, [role=button], a")]
        .filter(visible).slice(0, 250).map(describe);
      const keywordPattern = /mapa|map|mochila|bag|invent[aá]rio|inventory|n[ií]vel|level|loot|vender|sell|ca[cç]a|hunt/i;
      const candidates = [...document.querySelectorAll("[id], [class], [data-testid], [aria-label]")]
        .filter(visible)
        .filter(element => keywordPattern.test(`${element.id} ${element.className} ${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`))
        .slice(0, 250).map(describe);
      return {
        title: document.title,
        url: `${location.origin}${location.pathname}`,
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
        controls,
        candidates
      };
    });

    const output = {
      capturedAt: new Date().toISOString(),
      ...state,
      title: clean(state.title),
      controls: state.controls.map(item => ({ ...item, text: clean(item.text), ariaLabel: clean(item.ariaLabel) })),
      candidates: state.candidates.map(item => ({ ...item, text: clean(item.text), ariaLabel: clean(item.ariaLabel) }))
    };
    fs.writeFileSync(path.join(reportDir, "latest-state.json"), JSON.stringify(output, null, 2), "utf8");
    return output;
  }

  return { attach, snapshot, eventsFile };
}
