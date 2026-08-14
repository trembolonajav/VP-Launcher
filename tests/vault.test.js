import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../apps/desktop/main/storage/Database.js";
import { Vault, VaultState } from "../apps/desktop/main/security/Vault.js";
import { AccountRepository } from "../apps/desktop/main/storage/AccountRepository.js";
import { BootstrapService } from "../apps/desktop/main/services/BootstrapService.js";

const safeStorage = { isAsyncEncryptionAvailable: async () => true, encryptStringAsync: async value => Buffer.from(`enc:${value}`), decryptStringAsync: async blob => { const value = Buffer.from(blob).toString(); if (!value.startsWith("enc:")) throw new Error("invalid cipher"); return { result: value.slice(4), shouldReEncrypt: false }; } };

test("vault encrypts each credential and never exposes password in summaries", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-vault-")); const database = openDatabase(path.join(directory, "test.db"));
  try {
    const vault = new Vault(database, safeStorage, path.join(directory, "missing.enc")); await vault.initialize();
    assert.equal(vault.status().state, VaultState.EMPTY);
    assert.equal((await vault.save({ id: "poke:01", provider: "pokewg", username: "user", password: "secret" })).ok, true);
    const summary = vault.summaries()[0]; assert.equal(summary.hasPassword, true); assert.equal("password" in summary, false); assert.equal("secretBlob" in summary, false);
    assert.equal((await vault.secret("poke:01")).password, "secret");
    database.prepare("UPDATE credentials SET secret_blob=? WHERE id='poke:01'").run(Buffer.from("broken"));
    assert.equal((await vault.secret("poke:01")).state, VaultState.DECRYPT_FAILED);
  } finally { database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("rotates credential blob when safeStorage requests re-encryption", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-vault-rotate-")); const database = openDatabase(path.join(directory, "test.db")); let encrypted = 0;
  const rotatingStorage = { ...safeStorage, encryptStringAsync: async value => { encrypted++; return Buffer.from(`enc:${value}:${encrypted}`); }, decryptStringAsync: async () => ({ result: "secret", shouldReEncrypt: true }) };
  try { const vault = new Vault(database, rotatingStorage, path.join(directory, "missing")); await vault.initialize(); await vault.save({ id: "rotate", provider: "test", username: "user", password: "secret" }); const before = Buffer.from(database.prepare("SELECT secret_blob FROM credentials WHERE id='rotate'").get().secret_blob).toString(); await vault.secret("rotate"); const after = Buffer.from(database.prepare("SELECT secret_blob FROM credentials WHERE id='rotate'").get().secret_blob).toString(); assert.notEqual(after, before); }
  finally { database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test("migrates legacy encrypted credentials without deleting the backup", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-vault-legacy-")); const database = openDatabase(path.join(directory, "test.db")); const legacyFile = path.join(directory, "accounts.enc");
  try {
    const accounts = new AccountRepository(database); new BootstrapService(database, accounts).run({ gameUrl: "https://pokewg.com/play", accounts: [{ id: "conta-01", name: "Conta 01", enabled: true }] });
    const legacy = { "conta-01": { username: "legacy", password: "secret", autoLogin: true } }; fs.writeFileSync(legacyFile, JSON.stringify({ data: Buffer.from(`enc:${JSON.stringify(legacy)}`).toString("base64") }));
    const vault = new Vault(database, safeStorage, legacyFile); await vault.initialize();
    assert.equal(fs.existsSync(`${legacyFile}.migrated`), true); assert.equal(fs.existsSync(legacyFile), false);
    assert.equal(accounts.get("conta-01").credentialId, "poke:conta-01"); assert.equal((await vault.secret("poke:conta-01")).username, "legacy");
  } finally { database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
