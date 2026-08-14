const defaultPreset = { autoHunt: false, autoSell: { enabled: false, capacityPercent: 80 }, map: { mode: "fixed", target: null }, recovery: { enabled: true } };

export class BootstrapService {
  constructor(database, accounts) { this.database = database; this.accounts = accounts; }
  run(seed) {
    const now = new Date().toISOString();
    this.database.prepare("INSERT OR IGNORE INTO network_profiles(id,name,type,config_json,enabled,created_at,updated_at) VALUES('network:system','Sistema','SYSTEM','{}',1,?,?)").run(now, now);
    this.database.prepare("INSERT OR IGNORE INTO automation_presets(id,name,config_json,created_at,updated_at) VALUES('preset:default','Sem automação',?,?,?)").run(JSON.stringify(defaultPreset), now, now);
    if (this.accounts.count() === 0) for (const account of seed.accounts) this.accounts.insertSeed(account, seed.gameUrl);
  }
}
