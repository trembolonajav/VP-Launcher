import electron from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./main/storage/Database.js";
import { AccountRepository } from "./main/storage/AccountRepository.js";
import { NetworkRepository } from "./main/storage/NetworkRepository.js";
import { PresetRepository } from "./main/storage/PresetRepository.js";
import { SessionRepository } from "./main/storage/SessionRepository.js";
import { EventRepository } from "./main/storage/EventRepository.js";
import { SettingsRepository } from "./main/storage/SettingsRepository.js";
import { BootstrapService } from "./main/services/BootstrapService.js";
import { Vault, VaultState } from "./main/security/Vault.js";
import { CollectorRepository } from "./main/storage/CollectorRepository.js";
import { CollectorCoordinator } from "./main/collector/CollectorCoordinator.js";
import { CDPCollector } from "./main/collector/CDPCollector.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session } = electron;
const config = JSON.parse(fs.readFileSync(path.join(dir, "seed", "default-accounts.json"), "utf8"));
let accounts = new Map();
const views = new Map();
const viewAccountIds = new Map();
const preparedPartitions = new Set();
const networks = new Map();
let mainWindow;
let database, accountRepository, networkRepository, presetRepository, sessionRepository, eventRepository, settingsRepository, collectorRepository, collectorCoordinator, cdpCollector, vault;
const sessionRunIds = new Map();
const discoveryRuns = new Map();

function profileSummaries() {
  const credentials = new Map(vault.summaries().map(item => [item.id, item]));
  return accountRepository.list().map(account => { const credential = credentials.get(account.credentialId); return { ...account, configured: Boolean(credential?.hasPassword), username: credential?.username || "", autoLogin: credential?.autoLogin !== false, vault: vault.status() }; });
}

async function loginAccount(id) {
  const view = views.get(id);
  if (!view) return { ok: false, error: "Abra a sessão antes de entrar." };
  const account = accountRepository.get(id);
  const credential = account?.credentialId ? await vault.secret(account.credentialId) : { state: VaultState.EMPTY };
  if (credential.state !== VaultState.READY) return { ok: false, state: credential.state, error: credential.error || "Credenciais não cadastradas." };
  const script = `(()=>{
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const inputs=[...document.querySelectorAll('input')].filter(visible);
    const user=inputs.find(e=>/email|user|login|usu[aá]rio/i.test([e.name,e.id,e.placeholder,e.autocomplete].join(' ')))||inputs.find(e=>e.type==='email'||e.type==='text');
    const pass=inputs.find(e=>e.type==='password');
    if(!user||!pass)return{ok:false,error:'Campos de login não estão visíveis. A conta pode já estar conectada.'};
    const set=(el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
    set(user,${JSON.stringify(credential.username)});set(pass,${JSON.stringify(credential.password)});
    const button=[...document.querySelectorAll('button,[role=button],input[type=submit]')].filter(visible).find(e=>/entrar|login|sign in|acessar/i.test((e.innerText||e.value||e.textContent||'').trim()));
    if(!button)return{ok:false,error:'Botão de login não encontrado; campos foram preenchidos.'};button.click();return{ok:true};
  })()`;
  return view.webContents.executeJavaScript(script).catch(error => ({ ok: false, error: error.message }));
}

async function inspectNetwork(id, view) {
  try {
    const response = await view.webContents.session.fetch("https://ipwho.is/");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "consulta recusada");
    const previous = networks.get(id);
    const current = { ip: data.ip, country: data.country_code, city: data.city, provider: data.connection?.isp || data.connection?.org || "", vpn: Boolean(data.security?.vpn), proxy: Boolean(data.security?.proxy), checkedAt: new Date().toISOString() };
    networks.set(id, current);
    if (!previous?.ip || previous.ip !== current.ip) eventRepository?.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: previous?.ip ? "NETWORK_CHANGED" : "NETWORK_CHECKED", severity: previous?.ip ? "WARN" : "INFO", payload: { ip: current.ip, country: current.country, provider: current.provider, previousIp: previous?.ip || null } });
  } catch (error) {
    networks.set(id, { error: error.message, checkedAt: new Date().toISOString() });
    eventRepository?.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: "NETWORK_CHECK_FAILED", severity: "WARN", payload: { error: error.message } });
  }
}

function createView(id) {
  if (views.has(id)) return views.get(id);
  const account = accounts.get(id);
  if (!account) throw new Error(`Conta desconhecida: ${id}`);
  const gameSession = session.fromPartition(account.partition);
  if (!preparedPartitions.has(account.partition)) { gameSession.registerPreloadScript({ type: "frame", filePath: path.join(dir, "game-agent", "preload.cjs") }); preparedPartitions.add(account.partition); }
  const view = new WebContentsView({ webPreferences: { partition: account.partition, backgroundThrottling: false, contextIsolation: true, sandbox: true } });
  view.setBackgroundColor("#050303");
  view.setVisible(false);
  mainWindow.contentView.addChildView(view);
  views.set(id, view);
  viewAccountIds.set(view.webContents.id, id);
  gameSession.setPermissionCheckHandler(() => false);
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  view.webContents.on("will-navigate", (event, url) => {
    if (!/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) event.preventDefault();
  });
  view.webContents.on("did-finish-load", async () => {
    if (!/^https:\/\/(?:test\.)?pokewg\.com\//i.test(view.webContents.getURL())) return;
    if (/\/play/i.test(view.webContents.getURL())) {
      await view.webContents.executeJavaScript(`localStorage.setItem("vpclient:account", ${JSON.stringify(id)});`).catch(() => {});
    }
    const currentAccount = accountRepository.get(id);
    const credential = currentAccount?.credentialId ? vault.summaries().find(item => item.id === currentAccount.credentialId) : null;
    if (credential && credential.autoLogin !== false) setTimeout(() => void loginAccount(id), 700);
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) void view.webContents.loadURL(url);
    return { action: "deny" };
  });
  const sessionRunId = sessionRepository.start(id);
  sessionRunIds.set(id, sessionRunId);
  eventRepository.add({ accountId: id, sessionRunId, type: "SESSION_STARTED" });
  void cdpCollector.attach(id, view.webContents);
  void view.webContents.loadURL(`${account.gameUrl}?vpclient_account=${encodeURIComponent(id)}`);
  void inspectNetwork(id, view);
  return view;
}

function closeView(id, reason = "USER_CLOSED") {
  const view = views.get(id);
  if (!view) return;
  cdpCollector.detach(id);
  const discoveryRunId = discoveryRuns.get(id); if (discoveryRunId) { collectorRepository.stopDiscovery(discoveryRunId); discoveryRuns.delete(id); }
  cdpCollector.stopDiscovery(id);
  viewAccountIds.delete(view.webContents.id);
  mainWindow.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  networks.delete(id);
  const sessionRunId = sessionRunIds.get(id);
  if (sessionRunId) {
    sessionRepository.end(sessionRunId, reason);
    eventRepository.add({ accountId: id, sessionRunId, type: "SESSION_CLOSED", payload: { reason } });
    sessionRunIds.delete(id);
  }
}

async function runGameAction(id, action, payload = {}) {
  const view = views.get(id);
  if (!view) return { ok: false, error: "Sessão não está aberta." };
  if (action !== "change-map") return { ok: false, error: "Ação desconhecida." };
  const target = String(payload.map || "").trim();
  if (!target) return { ok: false, error: "Informe o nome do mapa." };
  const script = `(async()=>{
    const clean=v=>String(v||'').replace(/\\s+/g,' ').trim();
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const controls=()=>[...document.querySelectorAll('button,[role=button],a')].filter(visible);
    const find=re=>controls().find(e=>re.test(clean(e.innerText||e.textContent||e.getAttribute('aria-label'))));
    const pause=ms=>new Promise(r=>setTimeout(r,ms));
    const back=find(/Voltar\\s+(à|a)\\s+Cidade/i);if(back){back.click();await pause(1800)}
    [...document.querySelectorAll('button[aria-label="Fechar"],button.ui-iconbtn--close')].filter(visible).at(-1)?.click();await pause(300);
    const map=find(/^MAPA$|^Mapa$/i);if(!map)throw new Error('Botão Mapa não encontrado.');map.click();await pause(900);
    const wanted=${JSON.stringify(target)}.toLocaleLowerCase('pt-BR');
    const option=controls().find(e=>clean(e.innerText||e.textContent).toLocaleLowerCase('pt-BR').startsWith(wanted));
    if(!option){const available=controls().map(e=>clean(e.innerText||e.textContent)).filter(t=>/\\bNv\\s*\\d+/i.test(t)).slice(0,30);return{ok:false,error:'Mapa não encontrado.',available}}
    const selected=clean(option.innerText||option.textContent);option.click();await pause(1200);return{ok:true,map:selected};
  })().catch(error=>({ok:false,error:error.message}))`;
  eventRepository.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: "ACTION_STARTED", payload: { action, target } });
  const result = await view.webContents.executeJavaScript(script);
  eventRepository.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: result.ok ? "ACTION_SUCCESS" : "ACTION_FAILED", severity: result.ok ? "INFO" : "WARN", payload: { action, target, result } });
  return result;
}

function registerIpc() {
  ipcMain.handle("vp:accounts", async () => {
    return accountRepository.list().map(account => ({ ...account, running: views.has(account.id), url: views.get(account.id)?.webContents.getURL() || null, telemetry: collectorCoordinator.state(account.id), network: networks.get(account.id) || null }));
  });
  ipcMain.handle("vp:open-embedded", (_event, id) => { try { createView(id); return { ok: true }; } catch (error) { return { ok: false, error: error.message }; } });
  ipcMain.handle("vp:layout-embedded", (_event, layouts = []) => {
    const visibleIds = new Set();
    for (const item of layouts) {
      const view = views.get(item.id);
      if (!view) continue;
      const visible = Boolean(item.visible && item.bounds);
      view.setVisible(visible);
      if (visible) {
        visibleIds.add(item.id);
        const b = item.bounds;
        view.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.max(1, Math.round(b.width)), height: Math.max(1, Math.round(b.height)) });
      }
    }
    for (const [id, view] of views) if (!visibleIds.has(id)) view.setVisible(false);
    return { ok: true };
  });
  ipcMain.handle("vp:close-embedded", (_event, id) => { closeView(id); return { ok: true }; });
  ipcMain.handle("vp:game-action", (_event, { id, action, payload }) => runGameAction(id, action, payload));
  ipcMain.handle("vp:profiles", () => profileSummaries());
  ipcMain.handle("vp:save-profile", async (_event, profile) => {
    if (!accounts.has(profile.id)) return { ok: false, error: "Conta inválida." };
    const username = String(profile.username || "").trim();
    if (!username) return { ok: false, error: "Preencha o usuário." };
    const credentialId = accountRepository.get(profile.id).credentialId || `poke:${profile.id}`;
    try {
      const result = await vault.save({ id: credentialId, provider: "pokewg", username, password: String(profile.password || ""), autoLogin: profile.autoLogin !== false });
      if (result.ok) { accountRepository.attachCredential(profile.id, credentialId); accounts = new Map(accountRepository.list().map(account => [account.id, account])); eventRepository.add({ accountId: profile.id, type: "CREDENTIAL_SAVED" }); }
      return result;
    } catch (error) { return { ok: false, state: VaultState.TEMPORARILY_UNAVAILABLE, error: error.message }; }
  });
  ipcMain.handle("vp:delete-profile", (_event, id) => { const account = accountRepository.get(id); if (!account?.credentialId) return { ok: true }; const result = vault.remove(account.credentialId); accountRepository.attachCredential(id, null); accounts = new Map(accountRepository.list().map(item => [item.id, item])); eventRepository.add({ accountId: id, type: "CREDENTIAL_REMOVED" }); return result; });
  ipcMain.handle("vp:login-profile", (_event, id) => loginAccount(id));
  ipcMain.handle("vp:vault-status", () => vault.status());
  ipcMain.handle("vp:network-profiles", () => networkRepository.list());
  ipcMain.handle("vp:save-network-profile", (_event, profile) => networkRepository.save(profile));
  ipcMain.handle("vp:presets", () => presetRepository.list());
  ipcMain.handle("vp:save-preset", (_event, preset) => presetRepository.save(preset));
  ipcMain.handle("vp:events", (_event, filter) => eventRepository.list(filter));
  ipcMain.handle("vp:collector-maps", () => collectorRepository.listMaps());
  ipcMain.handle("vp:collector-endpoints", (_event, limit) => collectorRepository.listEndpoints(limit));
  ipcMain.handle("vp:collector-observations", (_event, limit) => collectorRepository.listObservations(limit));
  ipcMain.handle("vp:collector-status", () => collectorRepository.status());
  ipcMain.handle("vp:start-discovery", async (_event, id) => { if (!views.has(id)) return { ok: false, error: "Abra a sessÃ£o antes de iniciar a descoberta." }; if (discoveryRuns.has(id)) return { ok: true, runId: discoveryRuns.get(id) }; const runId = collectorRepository.startDiscovery(id); discoveryRuns.set(id, runId); await cdpCollector.startDiscovery(id, runId); eventRepository.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: "DISCOVERY_STARTED", payload: { runId } }); return { ok: true, runId }; });
  ipcMain.handle("vp:stop-discovery", (_event, id) => { const runId = discoveryRuns.get(id); if (!runId) return { ok: true }; cdpCollector.stopDiscovery(id); collectorRepository.stopDiscovery(runId); discoveryRuns.delete(id); eventRepository.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: "DISCOVERY_STOPPED", payload: { runId } }); return { ok: true }; });
  ipcMain.handle("vp:get-setting", (_event, { key, fallback }) => settingsRepository.get(key, fallback));
  ipcMain.handle("vp:set-setting", (_event, { key, value }) => settingsRepository.set(key, value));
  ipcMain.handle("vp:update-account", (_event, update) => { const account = accountRepository.update(update); accounts = new Map(accountRepository.list().map(item => [item.id, item])); return account; });
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  database = openDatabase(path.join(userData, "vp-launcher.db"));
  accountRepository = new AccountRepository(database);
  networkRepository = new NetworkRepository(database);
  presetRepository = new PresetRepository(database);
  sessionRepository = new SessionRepository(database, app.getVersion());
  eventRepository = new EventRepository(database);
  settingsRepository = new SettingsRepository(database);
  collectorRepository = new CollectorRepository(database, error => eventRepository.add({ type: "COLLECTOR_FLUSH_FAILED", severity: "ERROR", payload: { error: error.message } }));
  collectorCoordinator = new CollectorCoordinator(collectorRepository, eventRepository, sessionRunIds);
  cdpCollector = new CDPCollector(collectorRepository, eventRepository, id => collectorCoordinator.context(id));
  collectorRepository.retain();
  new BootstrapService(database, accountRepository).run(config);
  const recovered = sessionRepository.recoverUnclean();
  if (recovered) eventRepository.add({ type: "UNCLEAN_SHUTDOWN_RECOVERED", severity: "WARN", payload: { sessions: recovered } });
  vault = new Vault(database, safeStorage, path.join(userData, "accounts.enc"));
  await vault.initialize();
  accounts = new Map(accountRepository.list().map(account => [account.id, account]));
  mainWindow = new BrowserWindow({ width: 1500, height: 920, minWidth: 1100, minHeight: 700, backgroundColor: "#0a0605", title: "VP Launcher", webPreferences: { preload: path.join(dir, "electron-preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on("close", () => { for (const id of [...views.keys()]) closeView(id, "APP_EXIT"); });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("file://")) event.preventDefault(); });
  registerIpc();
  ipcMain.on("vp:agent-delta", (event, payload) => { const id = viewAccountIds.get(event.sender.id); if (!id || !/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(event.senderFrame?.url || event.sender.getURL())) return; collectorCoordinator.ingest(id, payload); });
  ipcMain.on("vp:agent-action", (event, payload) => { const id = viewAccountIds.get(event.sender.id); if (!id || !/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(event.senderFrame?.url || event.sender.getURL())) return; collectorCoordinator.recordUiAction(id, payload?.label); });
  setInterval(() => { for (const [id, view] of views) void inspectNetwork(id, view); }, 60000).unref();
  await mainWindow.loadFile(path.join(dir, "ui", "index.html"));
});

app.on("window-all-closed", () => { collectorRepository?.close(); database?.close(); app.quit(); });
