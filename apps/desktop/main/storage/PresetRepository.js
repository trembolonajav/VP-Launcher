export class PresetRepository {
  constructor(database) { this.database = database; }
  list() { return this.database.prepare("SELECT id,name,config_json AS configJson FROM automation_presets ORDER BY name").all().map(row => ({ id: row.id, name: row.name, config: JSON.parse(row.configJson) })); }
  save(preset) { const now = new Date().toISOString(); this.database.prepare("INSERT INTO automation_presets(id,name,config_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,config_json=excluded.config_json,updated_at=excluded.updated_at").run(preset.id, preset.name, JSON.stringify(preset.config || {}), now, now); return this.list().find(item => item.id === preset.id); }
}
