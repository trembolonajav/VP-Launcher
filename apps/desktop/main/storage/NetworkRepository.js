export class NetworkRepository {
  constructor(database) { this.database = database; }
  list() { return this.database.prepare("SELECT id,name,type,config_json AS configJson,credential_id AS credentialId,enabled FROM network_profiles ORDER BY name").all().map(row => ({ ...row, config: JSON.parse(row.configJson), enabled: Boolean(row.enabled) })); }
  save(profile) { const now = new Date().toISOString(); this.database.prepare("INSERT INTO network_profiles(id,name,type,config_json,credential_id,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,config_json=excluded.config_json,credential_id=excluded.credential_id,enabled=excluded.enabled,updated_at=excluded.updated_at").run(profile.id, profile.name, profile.type, JSON.stringify(profile.config || {}), profile.credentialId || null, profile.enabled === false ? 0 : 1, now, now); return this.list().find(item => item.id === profile.id); }
}
