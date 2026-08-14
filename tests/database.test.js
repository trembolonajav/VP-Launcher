import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../apps/desktop/main/storage/Database.js";
import { AccountRepository } from "../apps/desktop/main/storage/AccountRepository.js";
import { BootstrapService } from "../apps/desktop/main/services/BootstrapService.js";

function temporaryDatabase() { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-db-")); const filename = path.join(directory, "test.db"); return { directory, filename, database: openDatabase(filename) }; }

test("creates database, applies idempotent migrations and enforces foreign keys", () => {
  const fixture = temporaryDatabase();
  try {
    assert.equal(fixture.database.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get().total, 4);
    fixture.database.close();
    fixture.database = openDatabase(fixture.filename);
    assert.equal(fixture.database.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get().total, 4);
    assert.throws(() => fixture.database.prepare("INSERT INTO session_runs(account_id,started_at,app_version) VALUES('missing',?,?)").run(new Date().toISOString(), "test"), /FOREIGN KEY/);
  } finally { fixture.database.close(); fs.rmSync(fixture.directory, { recursive: true, force: true }); }
});

test("imports account seed once and preserves persistent partitions", () => {
  const fixture = temporaryDatabase();
  try {
    const accounts = new AccountRepository(fixture.database);
    const seed = { gameUrl: "https://pokewg.com/play", accounts: Array.from({ length: 10 }, (_, index) => ({ id: `conta-${String(index + 1).padStart(2, "0")}`, name: `Conta ${index + 1}`, enabled: true })) };
    const bootstrap = new BootstrapService(fixture.database, accounts);
    bootstrap.run(seed); bootstrap.run(seed);
    assert.equal(accounts.count(), 10);
    assert.equal(accounts.get("conta-01").partition, "persist:conta-01");
    accounts.update({ id: "conta-01", name: "Principal" });
    assert.equal(accounts.get("conta-01").name, "Principal");
  } finally { fixture.database.close(); fs.rmSync(fixture.directory, { recursive: true, force: true }); }
});
