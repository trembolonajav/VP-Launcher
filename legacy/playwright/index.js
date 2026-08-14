import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";
import { createDiagnostics } from "./diagnostics.js";

const root = process.cwd();
const configFile = path.join(root, "config.json");
const exampleFile = path.join(root, "config.example.json");

if (!fs.existsSync(configFile)) fs.copyFileSync(exampleFile, configFile);
const config = JSON.parse(fs.readFileSync(configFile, "utf8"));

const chromeCandidates = [
  config.chromePath,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
].filter(Boolean);
const executablePath = chromeCandidates.find(candidate => fs.existsSync(candidate));
if (!executablePath) throw new Error("Chrome nao encontrado. Preencha chromePath em config.json.");

const profileDir = path.join(root, "profiles", config.profileName);
const reportDir = path.join(root, "reports", config.profileName);
fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

console.log(`Perfil: ${profileDir}`);
console.log("Abrindo o Chrome visivel. Feche a janela para encerrar.");

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath,
  channel: "chrome",
  headless: false,
  chromiumSandbox: true,
  viewport: null,
  args: ["--start-maximized"]
});

const diagnostics = createDiagnostics(reportDir);
context.on("page", page => diagnostics.attach(page));
for (const page of context.pages()) diagnostics.attach(page);

const page = context.pages()[0] || await context.newPage();

let publicIp = "indisponivel";
try {
  await page.goto(config.ipCheckUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  const payload = JSON.parse(await page.locator("body").innerText());
  publicIp = String(payload.ip || "indisponivel");
} catch (error) {
  console.warn(`Nao foi possivel verificar o IP: ${error.message}`);
}

fs.writeFileSync(path.join(reportDir, "ip-check.json"), JSON.stringify({
  checkedAt: new Date().toISOString(),
  publicIp,
  expectedVpnIp: config.expectedVpnIp || null,
  matchesExpected: config.expectedVpnIp ? publicIp === config.expectedVpnIp : null
}, null, 2));

console.log(`IP publico detectado: ${publicIp}`);
if (!config.expectedVpnIp) {
  console.warn("IP ainda nao autorizado. Instale/conecte o Proton neste perfil, feche o Chrome e execute novamente.");
  console.warn("Depois copie o IP VPN de reports/conta-01/ip-check.json para expectedVpnIp em config.json.");
  await page.goto("about:blank");
} else if (publicIp !== config.expectedVpnIp) {
  console.error("IP diferente do esperado. O jogo nao sera aberto.");
  await page.goto("about:blank");
} else {
  await page.goto(config.gameUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
}

const intervalMs = Math.max(5, Number(config.snapshotIntervalSeconds) || 15) * 1000;
const timer = setInterval(async () => {
  try {
    if (!page.isClosed() && page.url().startsWith("http")) {
      const state = await diagnostics.snapshot(page);
      console.log(`[${new Date().toLocaleTimeString("pt-BR")}] snapshot: ${state.controls.length} controles, ${state.candidates.length} candidatos`);
    }
  } catch (error) {
    console.warn(`Falha no snapshot: ${error.message}`);
  }
}, intervalMs);

context.on("close", () => {
  clearInterval(timer);
  console.log(`Relatorios salvos em: ${reportDir}`);
});
