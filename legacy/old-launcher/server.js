import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(path.dirname(dir));
const config=JSON.parse(fs.readFileSync(path.join(dir,"accounts.json"),"utf8"));
const processes=new Map();
const telemetry=new Map();
const cdpBrowsers=new Map();
const cdpSessions=new Map();
const screencasts=new Map();
const port=8789;
const logDir=path.join(dir,"logs");
fs.mkdirSync(logDir,{recursive:true});
const logFile=path.join(logDir,"launcher.log");
function log(message,error){const detail=error?` | ${error.stack||error.message||error}`:"";fs.appendFileSync(logFile,`[${new Date().toISOString()}] ${message}${detail}\n`);}

const candidates=[path.join(process.env.ProgramFiles||"","Google","Chrome","Application","chrome.exe"),path.join(process.env["ProgramFiles(x86)"]||"","Google","Chrome","Application","chrome.exe"),path.join(process.env.LOCALAPPDATA||"","Google","Chrome","Application","chrome.exe")];
const chrome=candidates.find(fs.existsSync);
const nativeMode=process.env.VP_NATIVE==="1";
if(!chrome&&!nativeMode)throw new Error("Google Chrome não encontrado.");

function dimensions(layout,index){const presets={"2x2":[2,2],"3x3":[3,3],"4x4":[4,4]};const [cols,rows]=presets[layout]||presets["2x2"];const width=Math.floor(1920/cols),height=Math.floor(1040/rows);return{x:(index%cols)*width,y:Math.floor(index/cols)%rows*height,width,height};}
function launch(account,layout="2x2",index=0){
  const existing=processes.get(account.id);
  if(existing&&!existing.killed&&existing.exitCode===null)return{ok:true,alreadyRunning:true,pid:existing.pid};
  const box=dimensions(layout,index),profile=path.join(root,"launcher-profiles",account.id);
  fs.mkdirSync(profile,{recursive:true});
  const args=[`--user-data-dir=${profile}`,`--remote-debugging-port=${account.cdpPort}`,"--remote-debugging-address=127.0.0.1","--new-window","--no-first-run","--no-default-browser-check","--window-position=-20000,0","--window-size=1280,800",config.gameUrl];
  const child=spawn(chrome,args,{stdio:"ignore"});
  processes.set(account.id,child);
  child.on("error",error=>{log(`Falha ao abrir ${account.id}`,error);processes.delete(account.id);});
  child.on("exit",(code,signal)=>{log(`${account.id} encerrou (codigo=${code}, sinal=${signal})`);processes.delete(account.id);});
  log(`Abrindo ${account.id}, PID ${child.pid}, perfil ${profile}`);
  return{ok:true,pid:child.pid,box};
}
function status(){return config.accounts.map(a=>{const sample=telemetry.get(a.id);const fresh=sample&&Date.now()-sample.receivedAt<10000;return{...a,running:cdpBrowsers.has(a.id)||Boolean(fresh),pid:processes.get(a.id)?.pid||null,telemetry:fresh?sample.state:null,lastSeen:sample?.receivedAt||null};});}
async function closeAccount(id){const session=cdpSessions.get(id);if(session)await session.send("Page.stopScreencast").catch(()=>{});const browser=cdpBrowsers.get(id);if(browser)await browser.close().catch(()=>{});const child=processes.get(id);if(child&&!child.killed)child.kill();processes.delete(id);cdpBrowsers.delete(id);cdpSessions.delete(id);screencasts.delete(id);telemetry.delete(id);}

function parseGameText(text){
  const player=text.match(/\b([A-Z][A-Z0-9_]{2,})\s+LV\s*(\d+)\s+(.+?)\s+XP\s+(\d+)%/i);
  const active=text.match(/\b([A-Za-z][A-Za-z.' -]{1,30})\s+Lv\.?\s*(\d+)\s+HP\s+(\d+)\s*\/\s*(\d+)\s+XP\s+(\d+)%/i);
  const caps=[...text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)].map(m=>({used:Number(m[1]),total:Number(m[2])})).filter(x=>x.total>=100&&x.used<=x.total);
  const capacity=caps.find(x=>x.total===335)||caps.at(-1)||null;
  const location=player?.[3]?.replace(/\s+/g," ").trim()||null;
  return{player:player?{name:player[1],level:Number(player[2]),locationLabel:location,xpPercent:Number(player[4])}:null,activePokemon:active?{name:active[1].trim(),level:Number(active[2]),hp:Number(active[3]),maxHp:Number(active[4]),xpPercent:Number(active[5])}:null,capacity,activity:{location,inCity:/^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(location||""),hunting:Boolean(location&&!/^(Cerulean|Viridian|Pewter|Saffron|Cassino|Mercado)$/i.test(location))}};
}

async function collectAccount(account){
  let browser=cdpBrowsers.get(account.id);
  if(!browser){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${account.cdpPort}`,{timeout:700});cdpBrowsers.set(account.id,browser);browser.on("disconnected",()=>{cdpBrowsers.delete(account.id);cdpSessions.delete(account.id);screencasts.delete(account.id);});}catch{return;}}
  try{
    const pages=browser.contexts().flatMap(c=>c.pages());const page=pages.find(p=>/^https:\/\/(?:test\.)?pokewg\.com\/play/.test(p.url()));if(!page)return;
    let session=cdpSessions.get(account.id);
    if(!session){
      session=await page.context().newCDPSession(page);cdpSessions.set(account.id,session);
      session.on("Page.screencastFrame",event=>{screencasts.set(account.id,{data:event.data,metadata:event.metadata,at:Date.now()});session.send("Page.screencastFrameAck",{sessionId:event.sessionId}).catch(()=>{});});
      await session.send("Page.enable");
      await session.send("Page.startScreencast",{format:"jpeg",quality:70,maxWidth:1280,maxHeight:800,everyNthFrame:1});
      const {windowId}=await session.send("Browser.getWindowForTarget");
      await session.send("Browser.setWindowBounds",{windowId,bounds:{left:-20000,top:0,width:1280,height:800,windowState:"normal"}}).catch(()=>{});
    }
    const text=await page.locator("body").innerText({timeout:800});telemetry.set(account.id,{receivedAt:Date.now(),state:{capturedAt:new Date().toISOString(),ready:true,parsed:parseGameText(text)}});
  }catch{}
}
if(!nativeMode)setInterval(()=>{for(const account of config.accounts)collectAccount(account);},2000);
function json(res,code,data){res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
async function body(req){let value="";for await(const chunk of req)value+=chunk;return value?JSON.parse(value):{};}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://localhost");
    if(req.method==="GET"&&url.pathname==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});return res.end(fs.readFileSync(path.join(dir,"ui","index.html")));}
    if(req.method==="GET"&&url.pathname==="/app.js"){res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-store"});return res.end(fs.readFileSync(path.join(dir,"ui","app.js")));}
    if(req.method==="GET"&&url.pathname.startsWith("/assets/")){const rel=url.pathname.replace(/^\/+/,"").split("/").filter(p=>p&&p!==".."&&p!==".").join(path.sep);const file=path.join(dir,"ui",rel);const base=path.join(dir,"ui","assets");if(!file.startsWith(base)||!fs.existsSync(file))return json(res,404,{error:"Asset não encontrado"});const types={".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};const ext=path.extname(file).toLowerCase();res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Cache-Control":"max-age=86400"});return res.end(fs.readFileSync(file));}
    if(req.method==="GET"&&url.pathname==="/api/status")return json(res,200,{accounts:status(),gameUrl:config.gameUrl});
    if(req.method==="GET"&&url.pathname.startsWith("/api/preview/")){const id=url.pathname.split("/").at(-1),frame=screencasts.get(id);if(!frame)return json(res,404,{error:"Stream indisponível"});res.writeHead(200,{"Content-Type":"image/jpeg","Cache-Control":"no-store","X-Frame-Time":String(frame.at)});return res.end(Buffer.from(frame.data,"base64"));}
    if(req.method==="POST"&&url.pathname==="/api/input"){const data=await body(req),session=cdpSessions.get(data.id);if(!session)return json(res,409,{error:"Sessão CDP indisponível"});const metrics=await session.send("Page.getLayoutMetrics");const viewport=metrics.cssVisualViewport||metrics.cssLayoutViewport;const x=Math.max(0,Math.min(1,Number(data.x)))*viewport.clientWidth,y=Math.max(0,Math.min(1,Number(data.y)))*viewport.clientHeight;await session.send("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",clickCount:1});await session.send("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",clickCount:1});return json(res,200,{ok:true});}
    if(req.method==="POST"&&url.pathname==="/api/window"){const data=await body(req),session=cdpSessions.get(data.id);if(!session)return json(res,409,{error:"Sessão CDP indisponível"});const {windowId}=await session.send("Browser.getWindowForTarget");const bounds=data.visible?{left:80,top:80,width:1280,height:800,windowState:"normal"}:{left:-20000,top:0,width:1280,height:800,windowState:"normal"};await session.send("Browser.setWindowBounds",{windowId,bounds});return json(res,200,{ok:true});}
    if(req.method==="POST"&&url.pathname==="/api/telemetry"){const data=await body(req);if(!config.accounts.some(a=>a.id===data.accountId))return json(res,400,{error:"Conta inválida"});telemetry.set(data.accountId,{receivedAt:Date.now(),state:data.state});return json(res,200,{ok:true});}
    if(req.method==="POST"&&url.pathname==="/api/open"){const data=await body(req),account=config.accounts.find(a=>a.id===data.id);return account?json(res,200,launch(account,data.layout,data.index||0)):json(res,404,{error:"Conta não encontrada"});}
    if(req.method==="POST"&&url.pathname==="/api/open-all"){const data=await body(req);return json(res,200,{results:config.accounts.filter(a=>a.enabled).map((a,i)=>({id:a.id,...launch(a,data.layout,i)}))});}
    if(req.method==="POST"&&url.pathname==="/api/close"){const data=await body(req);await closeAccount(data.id);return json(res,200,{ok:true});}
    if(req.method==="POST"&&url.pathname==="/api/close-all"){for(const account of config.accounts)await closeAccount(account.id);return json(res,200,{ok:true});}
    return json(res,404,{error:"Não encontrado"});
  }catch(error){log(`Erro atendendo ${req.method} ${req.url}`,error);if(!res.headersSent)return json(res,500,{error:error.message||"Erro interno do launcher"});res.end();}
});
server.listen(port,"127.0.0.1",()=>{
  log(`Servidor iniciado em 127.0.0.1:${port}; Chrome: ${chrome}`);
  console.log(`VP Launcher ativo: http://127.0.0.1:${port}`);
  if(process.env.VP_NO_OPEN!=="1"){const dashboard=spawn(chrome,[`http://127.0.0.1:${port}`],{detached:true,stdio:"ignore"});dashboard.on("error",error=>log("Falha ao abrir painel",error));dashboard.unref();}
});
server.on("error",error=>{log("Falha no servidor",error);console.error(`Não foi possível iniciar o VP Launcher: ${error.message}`);});
process.on("uncaughtException",error=>log("Erro não tratado",error));
process.on("unhandledRejection",error=>log("Promessa rejeitada",error));
