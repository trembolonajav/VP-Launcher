import { normalizeEndpoint } from "./Redactor.js";

export class CDPCollector {
  constructor(repository, events) { this.repository = repository; this.events = events; this.attached = new Map(); this.intentional = new Set(); }
  async attach(accountId, webContents) {
    if (this.attached.has(accountId) || webContents.isDestroyed()) return;
    try { webContents.debugger.attach("1.3"); await webContents.debugger.sendCommand("Network.enable"); await webContents.debugger.sendCommand("Runtime.enable"); await webContents.debugger.sendCommand("Log.enable"); }
    catch (error) { this.events.add({ accountId, type: "COLLECTOR_ATTACH_FAILED", severity: "WARN", payload: { error: error.message } }); return; }
    const message = (_event, method, params) => this.onMessage(accountId, method, params);
    const detach = (_event, reason) => { const intentional = this.intentional.delete(accountId); this.attached.delete(accountId); if (!intentional) this.events.add({ accountId, type: "COLLECTOR_DETACHED", severity: "WARN", payload: { reason } }); if (!intentional && !webContents.isDestroyed()) setTimeout(() => void this.attach(accountId, webContents), 2000); };
    webContents.debugger.on("message", message); webContents.debugger.once("detach", detach); this.attached.set(accountId, { webContents, message });
  }
  onMessage(accountId, method, params) {
    if (method === "Network.requestWillBeSent") { const endpoint = normalizeEndpoint(params.request?.url); if (endpoint) this.repository.endpoint({ ...endpoint, method: params.request?.method || "GET", resourceType: params.type || "Other" }); }
    else if (method === "Network.webSocketCreated") { const endpoint = normalizeEndpoint(params.url); if (endpoint) this.repository.endpoint({ ...endpoint, method: "WS", resourceType: "WebSocket" }); }
    else if (method === "Runtime.exceptionThrown") this.events.add({ accountId, type: "PAGE_EXCEPTION", severity: "WARN", payload: { text: params.exceptionDetails?.text || "Runtime exception" } });
    else if (method === "Log.entryAdded" && ["error","warning"].includes(params.entry?.level)) this.events.add({ accountId, type: "PAGE_LOG", severity: params.entry.level === "error" ? "ERROR" : "WARN", payload: { level: params.entry.level, text: String(params.entry.text || "").slice(0,1000) } });
  }
  detach(accountId) { const item = this.attached.get(accountId); if (!item) return; this.intentional.add(accountId); this.attached.delete(accountId); if (!item.webContents.isDestroyed() && item.webContents.debugger.isAttached()) item.webContents.debugger.detach(); else this.intentional.delete(accountId); }
}
