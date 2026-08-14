export class AccountRepository {
  constructor(database) { this.database = database; }
  count() { return Number(this.database.prepare("SELECT COUNT(*) AS total FROM accounts").get().total); }
  list() { return this.database.prepare("SELECT id,name,enabled,game_url AS gameUrl,partition_name AS partition,credential_id AS credentialId,network_profile_id AS networkProfileId,preset_id AS presetId FROM accounts ORDER BY id").all().map(row => ({ ...row, enabled: Boolean(row.enabled) })); }
  get(id) { const row = this.database.prepare("SELECT id,name,enabled,game_url AS gameUrl,partition_name AS partition,credential_id AS credentialId,network_profile_id AS networkProfileId,preset_id AS presetId FROM accounts WHERE id=?").get(id); return row ? { ...row, enabled: Boolean(row.enabled) } : null; }
  insertSeed(account, gameUrl) { const now = new Date().toISOString(); this.database.prepare("INSERT INTO accounts(id,name,enabled,game_url,partition_name,network_profile_id,preset_id,created_at,updated_at) VALUES(?,?,?,?,?,'network:system','preset:default',?,?)").run(account.id, account.name, account.enabled === false ? 0 : 1, gameUrl, `persist:${account.id}`, now, now); }
  attachCredential(accountId, credentialId) { this.database.prepare("UPDATE accounts SET credential_id=?,updated_at=? WHERE id=?").run(credentialId, new Date().toISOString(), accountId); }
  update({ id, name, enabled, networkProfileId, presetId }) { this.database.prepare("UPDATE accounts SET name=COALESCE(?,name),enabled=COALESCE(?,enabled),network_profile_id=COALESCE(?,network_profile_id),preset_id=COALESCE(?,preset_id),updated_at=? WHERE id=?").run(name ?? null, enabled == null ? null : Number(Boolean(enabled)), networkProfileId ?? null, presetId ?? null, new Date().toISOString(), id); return this.get(id); }
}
