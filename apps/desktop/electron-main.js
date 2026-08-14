import electron from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage } = electron;
const config = JSON.parse(fs.readFileSync(path.join(dir, "accounts.json"), "utf8"));
const telemetryScript = fs.readFileSync(path.join(path.dirname(dir), "browser-extension", "content.js"), "utf8");
const accounts = new Map(config.accounts.map(account => [account.id, account]));
const views = new Map();
const networks = new Map();
const telemetry = new Map();
let serverProcess;
let mainWindow;
let credentialsFile;

function readCredentials() {
  try {
    if (!credentialsFile || !fs.existsSync(credentialsFile)) return {};
    const encrypted = Buffer.from(JSON.parse(fs.readFileSync(credentialsFile, "utf8")).data, "base64");
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch { return {}; }
}
function writeCredentials(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("A criptografia segura do Windows não está disponível.");
  fs.mkdirSync(path.dirname(credentialsFile), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  fs.writeFileSync(credentialsFile, JSON.stringify({ version: 1, data: encrypted.toString("base64") }), { mode: 0o600 });
}
function profileSummaries() {
  const saved = readCredentials();
  return config.accounts.map(account => ({ id: account.id, name: account.name, configured: Boolean(saved[account.id]?.username && saved[account.id]?.password), username: saved[account.id]?.username || "", autoLogin: saved[account.id]?.autoLogin !== false }));
}

async function loginAccount(id) {
  const view = views.get(id);
  const credential = readCredentials()[id];
  if (!view) return { ok: false, error: "Abra a sessão antes de entrar." };
  if (!credential?.username || !credential?.password) return { ok: false, error: "Credenciais não cadastradas." };
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function serverAlive() { try { return (await fetch("http://127.0.0.1:8789/api/status", { signal: AbortSignal.timeout(500) })).ok; } catch { return false; } }
async function waitForServer() { for (let i = 0; i < 40; i++) { if (await serverAlive()) return; await sleep(150); } throw new Error("Servidor local não iniciou."); }

async function inspectNetwork(id, view) {
  try {
    const response = await view.webContents.session.fetch("https://ipwho.is/");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "consulta recusada");
    networks.set(id, { ip: data.ip, country: data.country_code, city: data.city, provider: data.connection?.isp || data.connection?.org || "", vpn: Boolean(data.security?.vpn), proxy: Boolean(data.security?.proxy), checkedAt: new Date().toISOString() });
  } catch (error) {
    networks.set(id, { error: error.message, checkedAt: new Date().toISOString() });
  }
}

function parseGameText(text) {
  const player = text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i);
  const pokemon = text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i);
  const values = [...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map(match => ({ used: Number(match[1]), total: Number(match[2]) })).filter(value => value.total >= 100 && value.used <= value.total);
  const capacity = values.find(value => value.total === 335) || values.at(-1) || null;
  const collectionMatch = text.match(/Cole[cç][aã]o\s+(\d+)\s*\/\s*(\d+)/i);
  const location = player?.[3]?.replace(/\s+/g, " ").trim() || null;
  const inCity = /^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(location || "");
  return {
    player: player ? { name: player[1], level: Number(player[2]), locationLabel: location, xpPercent: Number(player[4]) } : null,
    activePokemon: pokemon ? { name: pokemon[1].trim(), level: Number(pokemon[2]), hp: Number(pokemon[3]), maxHp: Number(pokemon[4]), xpPercent: Number(pokemon[5]) } : null,
    capacity,
    collection: collectionMatch ? { used: Number(collectionMatch[1]), total: Number(collectionMatch[2]) } : null,
    activity: { location, inCity, hunting: Boolean(location && !inCity), disconnected: /desconect|reconect|offline|sess[aã]o expirada/i.test(text) }
  };
}

async function collectTelemetry(id, view) {
  try {
    const text = await view.webContents.executeJavaScript("document.body?.innerText || ''");
    const parsed = parseGameText(text);
    telemetry.set(id, { capturedAt: new Date().toISOString(), ready: Boolean(parsed.player), parsed });
  } catch {}
}

function createView(id) {
  if (views.has(id)) return views.get(id);
  if (!accounts.has(id)) throw new Error(`Conta desconhecida: ${id}`);
  const view = new WebContentsView({ webPreferences: { partition: `persist:${id}`, backgroundThrottling: false, contextIsolation: true, sandbox: true } });
  view.setBackgroundColor("#050303");
  view.setVisible(false);
  mainWindow.contentView.addChildView(view);
  views.set(id, view);
  view.webContents.on("did-finish-load", async () => {
    if (!/^https:\/\/(?:test\.)?pokewg\.com\//i.test(view.webContents.getURL())) return;
    if (/\/play/i.test(view.webContents.getURL())) {
      await view.webContents.executeJavaScript(`localStorage.setItem("vpclient:account", ${JSON.stringify(id)});`).catch(() => {});
      await view.webContents.executeJavaScript(telemetryScript).catch(() => {});
    }
    const credential = readCredentials()[id];
    if (credential?.autoLogin !== false) setTimeout(() => void loginAccount(id), 700);
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(?:[^/]+\.)?pokewg\.com\//i.test(url)) void view.webContents.loadURL(url);
    return { action: "deny" };
  });
  void view.webContents.loadURL(`${config.gameUrl}?vpclient_account=${encodeURIComponent(id)}`);
  void inspectNetwork(id, view);
  return view;
}

function closeView(id) {
  const view = views.get(id);
  if (!view) return;
  mainWindow.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  networks.delete(id);
  telemetry.delete(id);
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
  return view.webContents.executeJavaScript(script);
}

function registerIpc() {
  ipcMain.handle("vp:accounts", async () => {
    let backend = [];
    try { backend = (await (await fetch("http://127.0.0.1:8789/api/status")).json()).accounts || []; } catch {}
    const byId = new Map(backend.map(account => [account.id, account]));
    return config.accounts.map(account => ({ ...account, ...byId.get(account.id), running: views.has(account.id), url: views.get(account.id)?.webContents.getURL() || null, telemetry: telemetry.get(account.id) || byId.get(account.id)?.telemetry || null, network: networks.get(account.id) || null }));
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
  ipcMain.handle("vp:save-profile", (_event, profile) => {
    if (!accounts.has(profile.id)) return { ok: false, error: "Conta inválida." };
    const username = String(profile.username || "").trim();
    const current = readCredentials();
    const password = String(profile.password || "") || current[profile.id]?.password || "";
    if (!username || !password) return { ok: false, error: "Preencha usuário e senha." };
    current[profile.id] = { username, password, autoLogin: profile.autoLogin !== false, updatedAt: new Date().toISOString() };
    try { writeCredentials(current); return { ok: true }; } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle("vp:delete-profile", (_event, id) => { const current = readCredentials(); delete current[id]; try { writeCredentials(current); return { ok: true }; } catch (error) { return { ok: false, error: error.message }; } });
  ipcMain.handle("vp:login-profile", (_event, id) => loginAccount(id));
}

app.whenReady().then(async () => {
  credentialsFile = path.join(app.getPath("userData"), "accounts.enc");
  if (!await serverAlive()) serverProcess = spawn("node.exe", [path.join(dir, "server.js")], { cwd: path.dirname(dir), env: { ...process.env, VP_NO_OPEN: "1", VP_NATIVE: "1" }, stdio: "ignore", windowsHide: true });
  await waitForServer();
  mainWindow = new BrowserWindow({ width: 1500, height: 920, minWidth: 1100, minHeight: 700, backgroundColor: "#0a0605", title: "VP Launcher", webPreferences: { preload: path.join(dir, "electron-preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  mainWindow.setMenuBarVisibility(false);
  registerIpc();
  setInterval(() => { for (const [id, view] of views) void inspectNetwork(id, view); }, 60000).unref();
  setInterval(() => { for (const [id, view] of views) void collectTelemetry(id, view); }, 2000).unref();
  await mainWindow.loadURL("http://127.0.0.1:8789");
});

app.on("window-all-closed", () => { for (const id of [...views.keys()]) closeView(id); if (serverProcess && !serverProcess.killed) serverProcess.kill(); app.quit(); });
