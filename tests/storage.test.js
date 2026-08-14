import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../apps/desktop/main/storage/Database.js";
import { AccountRepository } from "../apps/desktop/main/storage/AccountRepository.js";
import { BootstrapService } from "../apps/desktop/main/services/BootstrapService.js";
import { SessionRepository } from "../apps/desktop/main/storage/SessionRepository.js";
import { EventRepository } from "../apps/desktop/main/storage/EventRepository.js";
import { SettingsRepository } from "../apps/desktop/main/storage/SettingsRepository.js";
import { NetworkRepository } from "../apps/desktop/main/storage/NetworkRepository.js";
import { PresetRepository } from "../apps/desktop/main/storage/PresetRepository.js";

test("persists session history, recovers abandoned runs, events and settings", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-storage-")); const database = openDatabase(path.join(directory, "test.db"));
  try {
    const accounts = new AccountRepository(database); new BootstrapService(database, accounts).run({ gameUrl: "https://pokewg.com/play", accounts: [{ id: "conta-01", name: "Conta 01", enabled: true }] });
    const sessions = new SessionRepository(database, "test"); const events = new EventRepository(database); const settings = new SettingsRepository(database);
    const first = sessions.start("conta-01"); sessions.end(first, "USER_CLOSED");
    sessions.start("conta-01"); assert.equal(sessions.recoverUnclean(), 1);
    events.add({ accountId: "conta-01", type: "GAME_READY", payload: { map: "Cerulean" } });
    assert.equal(events.list({ accountId: "conta-01" })[0].payload.map, "Cerulean");
    settings.set("ui.defaultView", "list"); assert.equal(settings.get("ui.defaultView"), "list");
    const networks = new NetworkRepository(database); networks.save({ id: "network:proxy-a", name: "Proxy A", type: "PROXY", config: { host: "127.0.0.1", port: 10001 } }); assert.equal(networks.list().find(item => item.id === "network:proxy-a").config.port, 10001);
    const presets = new PresetRepository(database); presets.save({ id: "preset:farm", name: "Farm", config: { autoHunt: false } }); assert.equal(presets.list().find(item => item.id === "preset:farm").config.autoHunt, false);
  } finally { database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
