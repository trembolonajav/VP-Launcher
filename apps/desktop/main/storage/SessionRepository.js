export class SessionRepository {
  constructor(database, appVersion) { this.database = database; this.appVersion = appVersion; }
  recoverUnclean() { return this.database.prepare("UPDATE session_runs SET ended_at=?,end_reason='UNCLEAN_SHUTDOWN' WHERE ended_at IS NULL").run(new Date().toISOString()).changes; }
  start(accountId) { const result = this.database.prepare("INSERT INTO session_runs(account_id,started_at,app_version) VALUES(?,?,?)").run(accountId, new Date().toISOString(), this.appVersion); return Number(result.lastInsertRowid); }
  end(id, reason) { this.database.prepare("UPDATE session_runs SET ended_at=?,end_reason=? WHERE id=? AND ended_at IS NULL").run(new Date().toISOString(), reason, id); }
}
