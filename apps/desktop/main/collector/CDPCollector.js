import crypto from "node:crypto";
import { normalizeEndpoint, redactFrame } from "./Redactor.js";

export class CDPCollector {
  constructor(repository, events, contextProvider = () => ({})) { this.repository = repository; this.events = events; this.contextProvider = contextProvider; this.attached = new Map(); this.intentional = new Set(); this.discovery = new Map(); this.sockets = new Map(); }
  async attach(accountId, webContents) {
    if (this.attached.has(accountId) || webContents.isDestroyed()) return;
    try { webContents.debugger.attach("1.3"); await webContents.debugger.sendCommand("Network.enable"); await webContents.debugger.sendCommand("Runtime.enable"); await webContents.debugger.sendCommand("Log.enable"); }
    catch (error) { this.events.add({ accountId, type: "COLLECTOR_ATTACH_FAILED", severity: "WARN", payload: { error: error.message } }); return; }
    const message = (_event, method, params) => this.onMessage(accountId, method, params);
    const detach = (_event, reason) => { const intentional = this.intentional.delete(accountId); this.attached.delete(accountId); if (!intentional) this.events.add({ accountId, type: "COLLECTOR_DETACHED", severity: "WARN", payload: { reason } }); if (!intentional && !webContents.isDestroyed()) setTimeout(() => void this.attach(accountId, webContents), 2000); };
    webContents.debugger.on("message", message); webContents.debugger.once("detach", detach); this.attached.set(accountId, { webContents, message });
  }
  onMessage(accountId, method, params) {
    if (method === "Network.requestWillBeSent") { const endpoint = normalizeEndpoint(params.request?.url); if (endpoint) { this.repository.endpoint({ ...endpoint, method: params.request?.method || "GET", resourceType: params.type || "Other" }); this.observe(accountId, "NETWORK", "OUT", `${params.request?.method || "GET"} ${endpoint.origin}${endpoint.path}`, null, { resourceType: params.type || "Other" }); } }
    else if (method === "Network.webSocketCreated") { const endpoint = normalizeEndpoint(params.url); if (endpoint) { this.sockets.set(`${accountId}:${params.requestId}`, `${endpoint.origin}${endpoint.path}`); this.repository.endpoint({ ...endpoint, method: "WS", resourceType: "WebSocket" }); this.observe(accountId, "NETWORK", "OPEN", `WS ${endpoint.origin}${endpoint.path}`); } }
    else if (method === "Network.webSocketFrameReceived" || method === "Network.webSocketFrameSent") { const frame = redactFrame(params.response?.payloadData); this.observe(accountId, "WEBSOCKET", method.endsWith("Received") ? "IN" : "OUT", this.sockets.get(`${accountId}:${params.requestId}`) || "WS", frame.sizeBytes, { opcode: params.response?.opcode, kind: frame.kind, preview: frame.preview }); }
    else if (method === "Network.webSocketClosed") this.sockets.delete(`${accountId}:${params.requestId}`);
    else if (method === "Runtime.exceptionThrown") this.events.add({ accountId, type: "PAGE_EXCEPTION", severity: "WARN", payload: { text: params.exceptionDetails?.text || "Runtime exception" } });
    else if (method === "Log.entryAdded" && ["error","warning"].includes(params.entry?.level)) this.events.add({ accountId, type: "PAGE_LOG", severity: params.entry.level === "error" ? "ERROR" : "WARN", payload: { level: params.entry.level, text: String(params.entry.text || "").slice(0,1000) } });
  }
  observe(accountId, category, direction, target, sizeBytes = null, metadata = {}) { const runId = this.discovery.get(accountId); if (!runId) return; const context = this.contextProvider(accountId), uiSurface = Date.now() - (context.changedAt || 0) <= 10000 ? context.uiSurface : null; const fingerprint = crypto.createHash("sha256").update(JSON.stringify([category,direction,target,uiSurface,metadata.kind,metadata.opcode])).digest("hex"); this.repository.observation({ runId, accountId, category, direction, target, sizeBytes, fingerprint, uiSurface, location: context.location, metadata }); }
  async startDiscovery(accountId, runId) { this.discovery.set(accountId, runId); const item = this.attached.get(accountId); if (!item || item.webContents.isDestroyed()) return; try { const { result } = await item.webContents.debugger.sendCommand("Runtime.evaluate", { expression: "JSON.stringify({local:[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)),session:[...Array(sessionStorage.length)].map((_,i)=>sessionStorage.key(i))})", returnByValue: true }); const keys = JSON.parse(result.value || "{}"); for (const key of keys.local || []) this.repository.storageKey(accountId, "localStorage", String(key)); for (const key of keys.session || []) this.repository.storageKey(accountId, "sessionStorage", String(key)); } catch (error) { this.events.add({ accountId, type: "STORAGE_DISCOVERY_FAILED", severity: "WARN", payload: { error: error.message } }); } }
  stopDiscovery(accountId) { this.discovery.delete(accountId); }
  detach(accountId) { const item = this.attached.get(accountId); if (!item) return; this.intentional.add(accountId); this.attached.delete(accountId); if (!item.webContents.isDestroyed() && item.webContents.debugger.isAttached()) item.webContents.debugger.detach(); else this.intentional.delete(accountId); }
}
