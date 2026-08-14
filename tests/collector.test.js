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

test("redacts discovery frames and normalizes volatile endpoint ids", () => {
  assert.deepEqual(normalizeEndpoint("https://pokewg.com/api/player/123?token=secret"), { origin: "https://pokewg.com", path: "/api/player/:id" });
  const frame = redactFrame(JSON.stringify({ event: "update", token: "secret", nested: { password: "hidden" } }));
  assert.equal(frame.preview.token, "[redacted]"); assert.equal(frame.preview.nested.password, "[redacted]");
  assert.equal(redactFrame("x".repeat(9000)).preview, null);
});

test("batches collector writes and stores metadata without storage values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-collector-")), database = openDatabase(path.join(directory, "test.db"));
  const repository = new CollectorRepository(database);
  try {
    const accounts = new AccountRepository(database); new BootstrapService(database, accounts).run({ gameUrl: "https://pokewg.com/play", accounts: [{ id: "conta-01", name: "Conta 01" }] });
    repository.endpoint({ origin: "https://pokewg.com", path: "/api/player/:id", method: "GET", resourceType: "XHR" }); repository.observeMap("Parasect Nv 50"); repository.storageKey("conta-01", "localStorage", "player-preferences"); repository.flush();
    assert.equal(repository.listEndpoints()[0].seenCount, 1); assert.equal(repository.listMaps()[0].level, 50); assert.equal(database.prepare("SELECT key_name FROM storage_key_observations").get().key_name, "player-preferences");
  } finally { repository.close(); database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
