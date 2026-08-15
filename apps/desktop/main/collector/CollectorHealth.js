export class CollectorHealth {
  constructor(repository) { this.repository = repository; this.accounts = new Map(); }
  patch(accountId, update) { const current = this.accounts.get(accountId) || { accountId,viewAlive:false,agentInstalled:false,agentInstanceId:null,bridgeConnected:false,collectorActive:false,cdpAttached:false,discoveryMode:false,lastAgentMessageAt:null,lastDeltaAt:null,lastPersistAt:null,lastError:null,sequence:0 }; const next = { ...current,...update,accountId,pendingBatchSize:this.repository.status().pending }; this.accounts.set(accountId,next); return next; }
  get(accountId, sessionRunId = null) { const current = this.patch(accountId,{}); return { ...current,sessionRunId,queue:this.repository.status() }; }
  list(sessionRunIds) { return [...this.accounts.keys()].map(id => this.get(id,sessionRunIds.get(id) || null)); }
  remove(accountId) { this.accounts.delete(accountId); }
}
