import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync("apps/desktop/electron-main.js", "utf8");
const agent = fs.readFileSync("apps/desktop/game-agent/index.js", "utf8");
const accounts = JSON.parse(fs.readFileSync("apps/desktop/accounts.json", "utf8"));

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
});
