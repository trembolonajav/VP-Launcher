import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class MigrationRunner {
  constructor(database, migrationsDir) { this.database = database; this.migrationsDir = migrationsDir; }

  run() {
    this.database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const applied = new Map(this.database.prepare("SELECT version, checksum FROM schema_migrations").all().map(row => [Number(row.version), row.checksum]));
    const files = fs.readdirSync(this.migrationsDir).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const version = Number(name.split("_")[0]);
      const sql = fs.readFileSync(path.join(this.migrationsDir, name), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      if (applied.has(version)) {
        if (applied.get(version) !== checksum) throw new Error(`Migration ${version} foi alterada após aplicação.`);
        continue;
      }
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(sql);
        this.database.prepare("INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)").run(version, name, checksum, new Date().toISOString());
        this.database.exec("COMMIT");
      } catch (error) { this.database.exec("ROLLBACK"); throw error; }
    }
  }
}
