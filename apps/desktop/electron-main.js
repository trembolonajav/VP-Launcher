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
import { validateAgentMessage } from "./main/collector/BridgeProtocol.js";
import { CollectorHealth } from "./main/collector/CollectorHealth.js";
import { SessionManager } from "./main/session/SessionManager.js";
import { NetworkManager } from "./main/network/NetworkManager.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session } = electron;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
const config = JSON.parse(fs.readFileSync(path.join(dir, "seed", "default-accounts.json"), "utf8"));
const autostartAccounts = (process.argv.find(value => value.startsWith("--autostart-account="))?.split("=").slice(1).join("=") || "").split(",").map(value=>value.trim()).filter(Boolean);
const autostartAccount=autostartAccounts[0]||null;
const p2Validation = process.argv.includes("--p2-validation");
const p2Soak = process.argv.includes("--p2-soak");
const exitAfterMs = Number(process.argv.find(value => value.startsWith("--exit-after-ms="))?.split("=")[1] || 0);
let accounts = new Map();
const views = new Map();
const protonViews = new Map();
const protonStatuses = new Map();
const viewAccountIds = new Map();
const preparedPartitions = new Set();
const networks = new Map();
const agentStatuses = new Map();
let mainWindow;
let database, accountRepository, networkRepository, presetRepository, sessionRepository, eventRepository, settingsRepository, collectorRepository, collectorCoordinator, collectorHealth, cdpCollector, sessionManager, networkManager, vault;
const sessionRunIds = new Map();
const discoveryRuns = new Map();
const recoveryAttemptsAt = new Map();
function pushAccountPatch(accountId, patch) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("vp:state-changed",{ accountId,patch }); }

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
  const result=await view.webContents.executeJavaScript(script).catch(error => ({ ok:false,error:error.message }));
  if (result.ok) sessionManager.auth(id,"LOGIN_REQUIRED");
  if (!result.ok && /challenge|captcha|2fa|confirma|verifica/i.test(result.error||"")) sessionManager.auth(id,"CHALLENGE");
  return result;
}

function createView(id,generation) {
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
  view.webContents.__vpGeneration=generation;
  collectorHealth.patch(id,{ viewAlive:true,collectorActive:true,sessionRunId:null });
  gameSession.setPermissionCheckHandler(() => false);
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  view.webContents.on("will-navigate", (event, url) => {
    if (!/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) event.preventDefault();
  });
  view.webContents.on("did-finish-load", async () => {
    if (!/^https:\/\/(?:test\.)?pokewg\.com\//i.test(view.webContents.getURL())) return;
    if (/\/play/i.test(view.webContents.getURL())) {
      await view.webContents.executeJavaScript(`localStorage.setItem("vpclient:account", ${JSON.stringify(id)});`).catch(() => {});
    } else if (/login|auth|entrar/i.test(view.webContents.getURL())) {
      sessionManager.auth(id,"LOGIN_REQUIRED");
    }
    const currentAccount = accountRepository.get(id);
    const credential = currentAccount?.credentialId ? vault.summaries().find(item => item.id === currentAccount.credentialId) : null;
    if (credential && credential.autoLogin !== false) setTimeout(() => void loginAccount(id), 700);
  });
  view.webContents.on("render-process-gone",(_event,details)=>{if(views.get(id)!==view)return;const state=sessionManager.recover(id,`renderer-${details.reason}`);if(state.state==="RECOVERING"&&state.retryCount<=3)setTimeout(()=>{if(views.get(id)===view&&!view.webContents.isDestroyed())view.webContents.reload();},Math.min(5000,state.retryCount*1000));});
  view.webContents.on("did-fail-load",(_event,code,description,url,isMainFrame)=>{if(isMainFrame&&views.get(id)===view)sessionManager.recover(id,`load-failed-${code}:${description}`);});
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) void view.webContents.loadURL(url);
    return { action: "deny" };
  });
  void cdpCollector.attach(id, view.webContents);
  void view.webContents.loadURL(`${account.gameUrl}?vpclient_account=${encodeURIComponent(id)}`);
  return view;
}

function closeViewResources(id) {
  const view = views.get(id);
  if (!view) return;
  cdpCollector.detach(id);
  const discoveryRunId = discoveryRuns.get(id); if (discoveryRunId) { collectorRepository.stopDiscovery(discoveryRunId); discoveryRuns.delete(id); }
  cdpCollector.stopDiscovery(id);
  collectorRepository.safeFlush();
  viewAccountIds.delete(view.webContents.id);
  mainWindow.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  networks.delete(id);
  agentStatuses.delete(id);
  collectorHealth.remove(id);
}

function openProtonSetup(id) {
  if (protonViews.has(id)) return { ok:true,status:protonStatuses.get(id)||null };
  const account=accounts.get(id);if(!account)return{ok:false,error:"Conta invÃ¡lida."};
  const protonSession=session.fromPartition(`persist:proton-${id}`);
  const view=new WebContentsView({webPreferences:{partition:`persist:proton-${id}`,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  view.setBackgroundColor("#f7f5ff");view.setVisible(false);mainWindow.contentView.addChildView(view);protonViews.set(id,view);
  const allowed=url=>{try{const host=new URL(url).hostname;return host==="proton.me"||host.endsWith(".proton.me")||host==="protonvpn.com"||host.endsWith(".protonvpn.com");}catch{return false;}};
  view.webContents.on("will-navigate",(event,url)=>{if(!allowed(url))event.preventDefault();});
  view.webContents.setWindowOpenHandler(({url})=>{if(allowed(url))void view.webContents.loadURL(url);return{action:"deny"};});
  protonSession.setPermissionCheckHandler(()=>false);protonSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  const onDownload=(_event,item)=>{if(!/\.conf$/i.test(item.getFilename())){item.cancel();return;}const secretDir=path.join(app.getPath("userData"),"network-secrets");fs.mkdirSync(secretDir,{recursive:true});const temporary=path.join(secretDir,`proton-${id}.download`),encrypted=path.join(secretDir,`proton-${id}.wg.enc`);item.setSavePath(temporary);item.once("done",async(_e,state)=>{let finalState="DOWNLOAD_FAILED";try{if(state==="completed"){const plaintext=fs.readFileSync(temporary,"utf8"),blob=await safeStorage.encryptStringAsync(plaintext);fs.writeFileSync(encrypted,blob);finalState="CONFIG_READY";}}catch{finalState="ENCRYPTION_FAILED";}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}const status={state:finalState,at:new Date().toISOString()};protonStatuses.set(id,status);pushAccountPatch(id,{protonSetup:status});eventRepository.add({accountId:id,type:finalState==="CONFIG_READY"?"PROTON_CONFIG_READY":"PROTON_CONFIG_DOWNLOAD_FAILED",severity:finalState==="CONFIG_READY"?"INFO":"ERROR",payload:{state:finalState}});});};
  protonSession.on("will-download",onDownload);view.webContents.once("destroyed",()=>protonSession.removeListener("will-download",onDownload));
  void view.webContents.loadURL("https://account.protonvpn.com/downloads#wireguard-configuration");return{ok:true,status:null};
}
function closeProtonSetup(id){const view=protonViews.get(id);if(!view)return{ok:true};mainWindow.contentView.removeChildView(view);view.webContents.close();protonViews.delete(id);return{ok:true};}

async function prepareAccountNetwork(id,profileId) { const account=accounts.get(id),gameSession=session.fromPartition(account.partition),network=await networkManager.prepare({accountId:id,profileId:profileId||account.networkProfileId||"network:system",ses:gameSession,sessionRunId:sessionRunIds.get(id)});networks.set(id,network);return network; }
async function openAccount(id) { return sessionManager.open(id,async generation=>{sessionRunIds.set(id,sessionManager.snapshot(id).sessionRunId);const network=await prepareAccountNetwork(id);sessionManager.network(id,network.result);if(network.result.status!=="OK")return;createView(id,generation);}); }
async function reconfigureAccountNetwork(id,profileId,{reconnect=false}={}) { const account=accounts.get(id);if(!account)return{ok:false,error:"Conta invÃ¡lida."};const state=sessionManager.snapshot(id);if(state.state==="CLOSED"){const network=await prepareAccountNetwork(id,profileId);return{ok:network.result.status==="OK",network};}const checking=sessionManager.beginNetworkCheck(id,reconnect?"network-reconnect":"network-profile-change");if(checking.state!=="NETWORK_CHECK")return{ok:false,error:"Encerre e reabra a sessÃ£o para trocar a rede neste estado."};closeViewResources(id);if(reconnect){const capability=await networkManager.reconnect(id);if(!capability.ok){sessionManager.network(id,{status:"CONFIG_ERROR",error:capability.error});return{ok:false,error:capability.error};}}const network=await prepareAccountNetwork(id,profileId);sessionManager.network(id,network.result);if(network.result.status==="OK")createView(id,sessionManager.snapshot(id).generation);return{ok:network.result.status==="OK",network,error:network.result.error}; }
async function closeAccount(id,reason="USER_CLOSED") { const result=await sessionManager.close(id,reason,()=>closeViewResources(id));sessionRunIds.delete(id);return result; }

async function startDiscoveryFor(id) {
  if (!views.has(id)) return { ok:false,error:"Abra a sessão antes de iniciar a descoberta." };
  if (discoveryRuns.has(id)) return { ok:true,runId:discoveryRuns.get(id) };
  const runId=collectorRepository.startDiscovery(id); discoveryRuns.set(id,runId); await cdpCollector.startDiscovery(id,runId);
  eventRepository.add({ accountId:id,sessionRunId:sessionRunIds.get(id),type:"DISCOVERY_STARTED",payload:{ runId } });
  return { ok:true,runId };
}

function stopDiscoveryFor(id) {
  const runId=discoveryRuns.get(id); if (!runId) return { ok:true };
  cdpCollector.stopDiscovery(id); collectorRepository.safeFlush(); collectorRepository.stopDiscovery(runId);
  const summary={ ...collectorRepository.discoverySummary(runId),collector:collectorRepository.status() }; discoveryRuns.delete(id);
  eventRepository.add({ accountId:id,sessionRunId:sessionRunIds.get(id),type:"DISCOVERY_STOPPED",payload:{ runId,summary } });
  return { ok:true,runId,summary };
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
  sessionManager.beginAction(id,`manual-${action}`);
  const result = await view.webContents.executeJavaScript(script).catch(error=>({ ok:false,error:error.message }));
  eventRepository.add({ accountId: id, sessionRunId: sessionRunIds.get(id), type: result.ok ? "ACTION_SUCCESS" : "ACTION_FAILED", severity: result.ok ? "INFO" : "WARN", payload: { action, target, result } });
  sessionManager.finishAction(id,result.ok?`manual-${action}-finished`:`manual-${action}-failed`);
  return result;
}

function registerIpc() {
  ipcMain.handle("vp:accounts", async () => {
    return accountRepository.list().map(account => ({ ...account, running: sessionManager.snapshot(account.id).state!=="CLOSED",session:sessionManager.snapshot(account.id), url: views.get(account.id)?.webContents.getURL() || null, telemetry: collectorCoordinator.state(account.id), agentStatus: agentStatuses.get(account.id) || null, network: networks.get(account.id) || null,protonSetup:protonStatuses.get(account.id)||null }));
  });
  ipcMain.handle("vp:open-embedded", async (_event,id) => { try{return{ ok:true,session:await openAccount(id) };}catch(error){return{ ok:false,error:error.message };} });
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
  ipcMain.handle("vp:open-proton-setup",(_event,id)=>openProtonSetup(id));
  ipcMain.handle("vp:layout-proton-setup",(_event,{id,bounds,visible})=>{for(const[accountId,view]of protonViews){const show=accountId===id&&Boolean(visible&&bounds);view.setVisible(show);if(show)view.setBounds({x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.max(1,Math.round(bounds.width)),height:Math.max(1,Math.round(bounds.height))});}return{ok:true};});
  ipcMain.handle("vp:close-proton-setup",(_event,id)=>closeProtonSetup(id));
  ipcMain.handle("vp:close-embedded", async (_event,id) => ({ ok:true,session:await closeAccount(id) }));
  ipcMain.handle("vp:reload-embedded", (_event,id) => { const view=views.get(id);if(!view)return{ ok:false,error:"Sessão não está aberta." };sessionManager.recover(id,"manual-reload");view.webContents.reload();return{ ok:true }; });
  ipcMain.handle("vp:pause-session",(_event,id)=>({ ok:true,session:sessionManager.pause(id) }));
  ipcMain.handle("vp:resume-session",(_event,id)=>({ ok:true,session:sessionManager.resume(id) }));
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
  ipcMain.handle("vp:save-network-profile", async (_event, profile) => { const safe={...profile,config:{...(profile.config||{})}};delete safe.config.username;delete safe.config.password;if(profile.password||profile.username){const credentialId=profile.credentialId||`proxy:${profile.id}`,saved=await vault.save({id:credentialId,provider:"proxy",username:String(profile.username||""),password:String(profile.password||""),autoLogin:true});if(!saved.ok)return saved;safe.credentialId=credentialId;}return{ok:true,profile:networkRepository.save(safe)}; });
  ipcMain.handle("vp:test-network", async (_event,id) => { const account=accounts.get(id);if(!account)return{ok:false,error:"Conta invÃ¡lida."};const network=await prepareAccountNetwork(id);return{ok:network.result.status==="OK",network}; });
  ipcMain.handle("vp:reconnect-network", (_event,id) => reconfigureAccountNetwork(id,accounts.get(id)?.networkProfileId,{reconnect:true}));
  ipcMain.handle("vp:change-network-profile", async (_event,{id,profileId}) => { const profile=networkRepository.list().find(item=>item.id===profileId);if(!profile)return{ok:false,error:"Perfil de rede invÃ¡lido."};accountRepository.update({id,networkProfileId:profileId});accounts=new Map(accountRepository.list().map(item=>[item.id,item]));eventRepository.add({accountId:id,sessionRunId:sessionRunIds.get(id),type:"NETWORK_PROFILE_CHANGED",payload:{profileId}});return reconfigureAccountNetwork(id,profileId); });
  ipcMain.handle("vp:presets", () => presetRepository.list());
  ipcMain.handle("vp:save-preset", (_event, preset) => presetRepository.save(preset));
  ipcMain.handle("vp:events", (_event, filter) => eventRepository.list(filter));
  ipcMain.handle("vp:collector-maps", () => collectorRepository.listMaps());
  ipcMain.handle("vp:collector-endpoints", (_event, limit) => collectorRepository.listEndpoints(limit));
  ipcMain.handle("vp:collector-observations", (_event, limit) => collectorRepository.listObservations(limit));
  ipcMain.handle("vp:collector-status", () => collectorRepository.status());
  ipcMain.handle("vp:collector-health", (_event,id) => id ? collectorHealth.get(id,sessionRunIds.get(id)||null) : collectorHealth.list(sessionRunIds));
  ipcMain.handle("vp:start-discovery", (_event,id) => startDiscoveryFor(id));
  ipcMain.handle("vp:stop-discovery", (_event,id) => stopDiscoveryFor(id));
  ipcMain.handle("vp:get-setting", (_event, { key, fallback }) => settingsRepository.get(key, fallback));
  ipcMain.handle("vp:set-setting", (_event, { key, value }) => settingsRepository.set(key, value));
  ipcMain.handle("vp:update-account", (_event, update) => { const account = accountRepository.update(update); accounts = new Map(accountRepository.list().map(item => [item.id, item])); return account; });
}

app.on("second-instance", () => { if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  database = openDatabase(path.join(userData, "vp-launcher.db"));
  accountRepository = new AccountRepository(database);
  networkRepository = new NetworkRepository(database);
  presetRepository = new PresetRepository(database);
  sessionRepository = new SessionRepository(database, app.getVersion());
  eventRepository = new EventRepository(database);
  settingsRepository = new SettingsRepository(database);
  collectorRepository = new CollectorRepository(database, error => eventRepository.add({ type: "COLLECTOR_FLUSH_FAILED", severity: "ERROR", payload: { error: error.message } }));
  collectorHealth = new CollectorHealth(collectorRepository);
  sessionManager = new SessionManager({ sessionRepository,eventRepository,publish:pushAccountPatch,maxRecoveryRetries:3 });
  networkManager = new NetworkManager({ repository:networkRepository,events:eventRepository,publish:pushAccountPatch,credentialResolver:id=>vault.secret(id) });
  collectorCoordinator = new CollectorCoordinator(collectorRepository, eventRepository, sessionRunIds);
  cdpCollector = new CDPCollector(collectorRepository,eventRepository,id=>collectorCoordinator.context(id),collectorHealth);
  collectorRepository.retain();
  new BootstrapService(database, accountRepository).run(config);
  const recovered = sessionRepository.recoverUnclean();
  if (recovered) eventRepository.add({ type: "UNCLEAN_SHUTDOWN_RECOVERED", severity: "WARN", payload: { sessions: recovered } });
  vault = new Vault(database, safeStorage, path.join(userData, "accounts.enc"));
  await vault.initialize();
  accounts = new Map(accountRepository.list().map(account => [account.id, account]));
  for(const id of accounts.keys()){const encryptedConfig=path.join(userData,"network-secrets",`proton-${id}.wg.enc`);if(fs.existsSync(encryptedConfig))protonStatuses.set(id,{state:"CONFIG_READY",at:fs.statSync(encryptedConfig).mtime.toISOString()});}
  mainWindow = new BrowserWindow({ width: 1500, height: 920, minWidth: 1100, minHeight: 700, backgroundColor: "#0a0605", title: "VP Launcher", webPreferences: { preload: path.join(dir, "electron-preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  mainWindow.setMenuBarVisibility(false);
  let shutdownStarted=false;mainWindow.on("close",event=>{if(shutdownStarted)return;event.preventDefault();shutdownStarted=true;for(const id of [...protonViews.keys()])closeProtonSetup(id);Promise.all([...views.keys()].map(id=>closeAccount(id,"APP_EXIT"))).finally(()=>mainWindow.destroy());});
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("file://")) event.preventDefault(); });
  registerIpc();
  ipcMain.on("vp:agent-message", (event,message) => { const id=viewAccountIds.get(event.sender.id),url=event.senderFrame?.url||event.sender.getURL(),view=views.get(id); if (!id||!view||view.webContents!==event.sender || !/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) return; const prior=collectorHealth.get(id,sessionRunIds.get(id)||null),validated=validateAgentMessage(message,id,prior.sequence,prior.agentInstanceId); if (!validated.ok) { collectorHealth.patch(id,{ lastError:`Bridge rejected: ${validated.error}` }); eventRepository.add({ accountId:id,sessionRunId:sessionRunIds.get(id),type:"AGENT_MESSAGE_REJECTED",severity:"WARN",payload:{ reason:validated.error } }); return; } const now=new Date().toISOString(); collectorHealth.patch(id,{ bridgeConnected:true,lastAgentMessageAt:now,sequence:message.sequence,agentInstanceId:message.instanceId,lastError:null }); if (message.type==="STATUS") { const ready=message.payload.state==="READY",status={ state:ready?"READY":"ERROR",error:message.payload.error||null,at:message.timestamp,agentVersion:message.payload.agentVersion||null },changed=prior.agentInstanceId!==message.instanceId||prior.agentInstalled!==ready||Boolean(prior.lastError)!==Boolean(status.error); agentStatuses.set(id,status);collectorHealth.patch(id,{ agentInstalled:ready,agentVersion:status.agentVersion,lastError:status.error });if(changed)eventRepository.add({ accountId:id,sessionRunId:sessionRunIds.get(id),type:ready?"GAME_AGENT_READY":"GAME_AGENT_ERROR",severity:ready?"INFO":"ERROR",payload:{ error:status.error,agentVersion:status.agentVersion } });if(!ready)sessionManager.fail(id,"AGENT_ERROR",status.error||"Game Agent failed",true);pushAccountPatch(id,{ agentStatus:status,health:collectorHealth.get(id,sessionRunIds.get(id)||null),session:sessionManager.snapshot(id) }); } else if (message.type==="ACTION") collectorCoordinator.recordUiAction(id,message.payload.label); else if (message.type==="DELTA") { const result=collectorCoordinator.ingest(id,message.payload,message.timestamp); if (result) { collectorHealth.patch(id,{ lastDeltaAt:now,lastPersistAt:collectorRepository.status().lastPersistAt });if(result.current.ui?.auth?.challenge)sessionManager.auth(id,"CHALLENGE");else if(result.current.ui?.auth?.loginRequired)sessionManager.auth(id,"LOGIN_REQUIRED");sessionManager.game(id,{ ready:result.current.ready,hunting:Boolean(result.current.game?.hunting),disconnected:Boolean(result.current.game?.disconnected) },view.webContents.__vpGeneration); pushAccountPatch(id,{ telemetry:result.current,agentStatus:agentStatuses.get(id)||null,health:collectorHealth.get(id,sessionRunIds.get(id)||null),session:sessionManager.snapshot(id) }); } } });
  setInterval(()=>{const now=Date.now();for(const [id,view] of views){const state=sessionManager.snapshot(id);if(["CLOSED","ERROR","WAITING_USER"].includes(state.state))continue;const health=collectorHealth.get(id,state.sessionRunId),reference=Date.parse(health.lastAgentMessageAt||state.changedAt);if(now-reference<45000)continue;const prior=recoveryAttemptsAt.get(id)||0;if(now-prior<20000)continue;recoveryAttemptsAt.set(id,now);const recovering=sessionManager.recover(id,"agent-heartbeat-timeout");if(recovering.state==="RECOVERING"&&!view.webContents.isDestroyed())view.webContents.reload();}},5000).unref();
  await mainWindow.loadFile(path.join(dir, "ui", "index.html"));
  if (autostartAccount) {
    for(const id of autostartAccounts)void openAccount(id);
    if (p2Validation) {
      setTimeout(() => { const view=views.get(autostartAccount);if(view){sessionManager.recover(autostartAccount,"validation-reload");view.webContents.reload();} },15000);
      setTimeout(() => void closeAccount(autostartAccount,"SESSION_RESTARTED"),30000);
      setTimeout(() => void openAccount(autostartAccount),33000);
      setTimeout(() => void startDiscoveryFor(autostartAccount),50000);
      setTimeout(() => stopDiscoveryFor(autostartAccount),170000);
    }
    if (p2Soak) {
      setTimeout(() => void startDiscoveryFor(autostartAccount),60000);
      setTimeout(() => stopDiscoveryFor(autostartAccount),660000);
      setTimeout(() => { eventRepository.add({ accountId:autostartAccount,sessionRunId:sessionRunIds.get(autostartAccount),type:"P2_SOAK_COMPLETED",payload:{ health:collectorHealth.get(autostartAccount,sessionRunIds.get(autostartAccount)),collector:collectorRepository.status() } }); collectorRepository.safeFlush(); },1800000);
      setTimeout(() => mainWindow?.close(),1802000);
    }
  }
  if (exitAfterMs >= 1000) setTimeout(() => mainWindow?.close(),exitAfterMs);
});

app.on("window-all-closed", () => { collectorRepository?.close(); database?.close(); app.quit(); });
