import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync("apps/desktop/electron-main.js", "utf8");
const agent = ["preload.cjs", "readers/state-readers.cjs", "readers/ui-reader.cjs"].map(file => fs.readFileSync(`apps/desktop/game-agent/${file}`, "utf8")).join("\n");
const accounts = JSON.parse(fs.readFileSync("apps/desktop/seed/default-accounts.json", "utf8"));

test("production main has no localhost, external Chrome or Playwright path", () => {
  for (const forbidden of ["127.0.0.1:8789", "startScreencast", "remote-debugging", "playwright", "server.js"]) {
    assert.equal(main.includes(forbidden), false, `unexpected production reference: ${forbidden}`);
  }
});

test("account model has no CDP ports", () => {
  assert.ok(accounts.accounts.length > 0);
  assert.ok(accounts.accounts.every(account => !("cdpPort" in account)));
});

test("game agent is independent from extension and localhost APIs", () => {
  for (const forbidden of ["chrome.runtime", "127.0.0.1", "/api/telemetry"]) {
    assert.equal(agent.includes(forbidden), false, `unexpected game-agent dependency: ${forbidden}`);
  }
  assert.match(agent, /MutationObserver/);
});

test("renderer cannot import sqlite or safeStorage", () => {
  const renderer = fs.readFileSync("apps/desktop/ui/app.js", "utf8");
  assert.equal(/node:sqlite|safeStorage/.test(renderer), false);
  assert.equal(/fetch\(|\/api\//.test(renderer), false);
});

test("collector uses preload deltas instead of page polling injection", () => {
  assert.match(main, /registerPreloadScript/);
  assert.match(main, /vp:agent-delta/);
  assert.equal(/collectTelemetry|gameAgentScript/.test(main), false);
});

test("sandboxed game preload is self-contained and reports startup status", () => {
  const preload = fs.readFileSync("apps/desktop/game-agent/preload.cjs", "utf8");
  assert.equal(/require\(["']\.\//.test(preload), false);
  assert.match(preload, /vp:agent-status/);
  assert.match(main, /GAME_AGENT_READY/);
});
