export class SettingsRepository {
  constructor(database) { this.database = database; }
  get(key, fallback = null) { const row = this.database.prepare("SELECT value_json FROM app_settings WHERE key=?").get(key); return row ? JSON.parse(row.value_json) : fallback; }
  set(key, value) { this.database.prepare("INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").run(key, JSON.stringify(value), new Date().toISOString()); return value; }
}
