import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../apps/desktop/main/storage/Database.js";
import { AccountRepository } from "../apps/desktop/main/storage/AccountRepository.js";
import { BootstrapService } from "../apps/desktop/main/services/BootstrapService.js";
import { CollectorRepository } from "../apps/desktop/main/storage/CollectorRepository.js";
import { normalizeEndpoint, redactFrame } from "../apps/desktop/main/collector/Redactor.js";
import { CDPCollector } from "../apps/desktop/main/collector/CDPCollector.js";

test("redacts discovery frames and normalizes volatile endpoint ids", () => {
  assert.deepEqual(normalizeEndpoint("https://pokewg.com/api/player/123?token=secret"), { origin: "https://pokewg.com", path: "/api/player/:id" });
  assert.deepEqual(normalizeEndpoint("wss://pokewg.com/rt1/cAzHBDbQU/FKbyTSV6t?token=secret"), { origin:"wss://pokewg.com",path:"/rt1/:opaque/:opaque" });
  const frame = redactFrame(JSON.stringify({ event: "update", token: "secret", nested: { password: "hidden" } }));
  assert.equal(frame.preview.token, "[redacted]"); assert.equal(frame.preview.nested.password, "[redacted]");
  const synthetic=JSON.stringify({ Authorization:"Bearer TEST_SECRET_123",Cookie:"TEST_COOKIE_123",token:"TEST_TOKEN_123",normal:"kept" }),redacted=JSON.stringify(redactFrame(synthetic));for(const secret of ["TEST_SECRET_123","TEST_COOKIE_123","TEST_TOKEN_123"])assert.equal(redacted.includes(secret),false);assert.match(redacted,/kept/);
  assert.equal(redactFrame("x".repeat(9000)).preview, null);
});

test("coalesces repeated discovery observations by fingerprint", () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"vp-discovery-")),database=openDatabase(path.join(directory,"test.db")),repository=new CollectorRepository(database);
  try { const accounts=new AccountRepository(database);new BootstrapService(database,accounts).run({ gameUrl:"https://pokewg.com/play",accounts:[{ id:"conta-01",name:"Conta 01" }] }); const runId=repository.startDiscovery("conta-01"); for(let i=0;i<100;i++)repository.observation({ runId,accountId:"conta-01",category:"WEBSOCKET",direction:"IN",target:"wss://pokewg.com/rt1/:opaque/:opaque",fingerprint:"same",sizeBytes:10,metadata:{ kind:"json" } }); repository.flush(); const row=database.prepare("SELECT seen_count,size_bytes FROM discovery_observations WHERE discovery_run_id=?").get(runId);assert.equal(row.seen_count,100);assert.equal(row.size_bytes,1000);assert.equal(repository.status().coalesced,99); }
  finally { repository.close();database.close();fs.rmSync(directory,{ recursive:true,force:true }); }
});

test("batches collector writes and stores metadata without storage values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-collector-")), database = openDatabase(path.join(directory, "test.db"));
  const repository = new CollectorRepository(database);
  try {
    const accounts = new AccountRepository(database); new BootstrapService(database, accounts).run({ gameUrl: "https://pokewg.com/play", accounts: [{ id: "conta-01", name: "Conta 01" }] });
    repository.endpoint({ origin: "https://pokewg.com", path: "/api/player/:id", method: "GET", resourceType: "XHR" }); repository.endpoint({ origin: "https://pokewg.com", path: "/api/player/:id", method: "GET", resourceType: "XHR" }); repository.observeMap("Parasect Nv 50"); repository.storageKey("conta-01", "localStorage", "player-preferences"); repository.flush();
    assert.equal(repository.listEndpoints()[0].seenCount, 2); assert.equal(repository.listMaps()[0].level, 50); assert.equal(database.prepare("SELECT key_name FROM storage_key_observations").get().key_name, "player-preferences");
  } finally { repository.close(); database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("bounds collector queue and reports dropped redundant pressure",()=>{const repository=new CollectorRepository({});clearInterval(repository.timer);for(let i=0;i<2500;i++)repository.observation({ runId:1,accountId:"conta-01",category:"NETWORK",fingerprint:`f${i}` });assert.equal(repository.status().pending,2000);assert.equal(repository.status().dropped,500);});

test("CDP normalizes requests and observes websocket frames only in Discovery",()=>{const endpoints=[],observations=[],repository={ endpoint:item=>endpoints.push(item),observation:item=>observations.push(item) },events={ add:()=>{} },collector=new CDPCollector(repository,events);collector.onMessage("conta-01","Network.requestWillBeSent",{ request:{ url:"https://pokewg.com/api/player/123?token=x",method:"GET" },type:"XHR" });collector.onMessage("conta-01","Network.webSocketCreated",{ requestId:"ws1",url:"wss://pokewg.com/rt1/cAzHBDbQU/FKbyTSV6t" });collector.onMessage("conta-01","Network.webSocketFrameReceived",{ requestId:"ws1",response:{ opcode:1,payloadData:'{"event":"tick"}' } });assert.equal(endpoints[0].path,"/api/player/:id");assert.equal(endpoints[1].path,"/rt1/:opaque/:opaque");assert.equal(observations.length,0);collector.discovery.set("conta-01",9);collector.onMessage("conta-01","Network.webSocketFrameReceived",{ requestId:"ws1",response:{ opcode:1,payloadData:'{"event":"tick"}' } });assert.equal(observations.length,1);assert.equal(observations[0].target,"wss://pokewg.com/rt1/:opaque/:opaque");});

test("safe flush reports failure without throwing from the timer path", () => {
  let reported = 0; const repository = new CollectorRepository({}, () => reported++); clearInterval(repository.timer);
  repository.flush = () => { throw new Error("disk busy"); };
  assert.doesNotThrow(() => repository.safeFlush()); assert.equal(reported, 1); assert.equal(repository.status().flushErrors, 1);
});
