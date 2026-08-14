import fs from "node:fs";

export const VaultState = Object.freeze({ READY: "READY", EMPTY: "EMPTY", UNAVAILABLE: "UNAVAILABLE", CORRUPTED: "CORRUPTED", DECRYPT_FAILED: "DECRYPT_FAILED", TEMPORARILY_UNAVAILABLE: "TEMPORARILY_UNAVAILABLE" });

export class Vault {
  constructor(database, safeStorage, legacyFile) { this.database = database; this.safeStorage = safeStorage; this.legacyFile = legacyFile; this.state = VaultState.EMPTY; this.error = null; }
  async initialize() {
    try {
      if (!await this.safeStorage.isAsyncEncryptionAvailable()) { this.state = VaultState.UNAVAILABLE; return this.status(); }
      this.state = Number(this.database.prepare("SELECT COUNT(*) AS total FROM credentials").get().total) ? VaultState.READY : VaultState.EMPTY;
      await this.migrateLegacy();
    } catch (error) { this.state = VaultState.TEMPORARILY_UNAVAILABLE; this.error = error.message; }
    return this.status();
  }
  status() { return { state: this.state, error: this.error }; }
  summaries() { return this.database.prepare("SELECT id,provider,username,auto_login AS autoLogin FROM credentials ORDER BY id").all().map(row => ({ ...row, autoLogin: Boolean(row.autoLogin), hasPassword: true })); }
  async save({ id, provider, username, password, autoLogin = true }) {
    if (!await this.safeStorage.isAsyncEncryptionAvailable()) return { ok: false, state: VaultState.UNAVAILABLE, error: "Criptografia segura indisponível." };
    const existing = this.database.prepare("SELECT secret_blob FROM credentials WHERE id=?").get(id);
    let blob = existing?.secret_blob;
    if (password) blob = await this.safeStorage.encryptStringAsync(password);
    if (!blob) return { ok: false, state: VaultState.EMPTY, error: "Informe a senha." };
    const now = new Date().toISOString();
    this.database.prepare("INSERT INTO credentials(id,provider,username,secret_blob,auto_login,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,username=excluded.username,secret_blob=excluded.secret_blob,auto_login=excluded.auto_login,updated_at=excluded.updated_at").run(id, provider, username, blob, Number(Boolean(autoLogin)), now, now);
    this.state = VaultState.READY; this.error = null; return { ok: true, state: this.state };
  }
  remove(id) { this.database.prepare("DELETE FROM credentials WHERE id=?").run(id); this.state = Number(this.database.prepare("SELECT COUNT(*) AS total FROM credentials").get().total) ? VaultState.READY : VaultState.EMPTY; return { ok: true, state: this.state }; }
  async secret(id) {
    const row = this.database.prepare("SELECT username,secret_blob,auto_login AS autoLogin FROM credentials WHERE id=?").get(id);
    if (!row) return { state: VaultState.EMPTY };
    try { const decrypted = await this.safeStorage.decryptStringAsync(Buffer.from(row.secret_blob)); return { state: VaultState.READY, username: row.username, password: decrypted.result, autoLogin: Boolean(row.autoLogin) }; }
    catch (error) { return { state: VaultState.DECRYPT_FAILED, error: error.message }; }
  }
  async migrateLegacy() {
    if (!this.legacyFile || !fs.existsSync(this.legacyFile) || fs.existsSync(`${this.legacyFile}.migrated`)) return;
    let legacy;
    try { const wrapper = JSON.parse(fs.readFileSync(this.legacyFile, "utf8")); const decrypted = await this.safeStorage.decryptStringAsync(Buffer.from(wrapper.data, "base64")); legacy = JSON.parse(decrypted.result); }
    catch (error) { this.state = VaultState.CORRUPTED; this.error = `Falha ao importar cofre legado: ${error.message}`; return; }
    for (const [accountId, value] of Object.entries(legacy)) {
      if (!value?.username || !value?.password) continue;
      const id = `poke:${accountId}`;
      await this.save({ id, provider: "pokewg", username: value.username, password: value.password, autoLogin: value.autoLogin !== false });
      this.database.prepare("UPDATE accounts SET credential_id=?,updated_at=? WHERE id=?").run(id, new Date().toISOString(), accountId);
    }
    fs.renameSync(this.legacyFile, `${this.legacyFile}.migrated`);
    this.state = VaultState.READY; this.error = null;
  }
}
