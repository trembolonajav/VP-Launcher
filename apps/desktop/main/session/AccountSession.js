export const SessionState = Object.freeze({ CLOSED:"CLOSED",STARTING:"STARTING",NETWORK_CHECK:"NETWORK_CHECK",AUTH_CHECK:"AUTH_CHECK",AUTHENTICATING:"AUTHENTICATING",READY:"READY",HUNTING:"HUNTING",PAUSED:"PAUSED",ACTION_RUNNING:"ACTION_RUNNING",WAITING_USER:"WAITING_USER",RECOVERING:"RECOVERING",ERROR:"ERROR" });

const T = {
  CLOSED:["STARTING"], STARTING:["NETWORK_CHECK","RECOVERING","ERROR","CLOSED"],
  NETWORK_CHECK:["AUTH_CHECK","RECOVERING","ERROR","CLOSED"],
  AUTH_CHECK:["AUTHENTICATING","READY","WAITING_USER","RECOVERING","ERROR","CLOSED"],
  AUTHENTICATING:["AUTH_CHECK","READY","WAITING_USER","RECOVERING","ERROR","CLOSED"],
  READY:["HUNTING","PAUSED","ACTION_RUNNING","AUTH_CHECK","RECOVERING","ERROR","CLOSED"],
  HUNTING:["READY","PAUSED","ACTION_RUNNING","RECOVERING","ERROR","CLOSED"],
  PAUSED:["READY","HUNTING","RECOVERING","ERROR","CLOSED"],
  ACTION_RUNNING:["READY","HUNTING","WAITING_USER","RECOVERING","ERROR","CLOSED"],
  WAITING_USER:["AUTH_CHECK","AUTHENTICATING","READY","RECOVERING","ERROR","CLOSED"],
  RECOVERING:["AUTH_CHECK","READY","HUNTING","WAITING_USER","ERROR","CLOSED"],
  ERROR:["RECOVERING","CLOSED"]
};

export class InvalidSessionTransition extends Error {}

export class AccountSession {
  constructor(accountId) { this.accountId=accountId;this.state=SessionState.CLOSED;this.previousActiveState=null;this.sessionRunId=null;this.generation=0;this.retryCount=0;this.error=null;this.changedAt=new Date().toISOString(); }
  can(to) { return T[this.state]?.includes(to) || false; }
  transition(to, reason, details = {}) {
    if (to===this.state) return null;
    if (!this.can(to)) throw new InvalidSessionTransition(`${this.accountId}: ${this.state} -> ${to}`);
    const from=this.state;
    if ([SessionState.READY,SessionState.HUNTING].includes(from)) this.previousActiveState=from;
    this.state=to;this.changedAt=new Date().toISOString();
    if (to!==SessionState.ERROR) this.error=null;
    return { accountId:this.accountId,from,to,reason,occurredAt:this.changedAt,sessionRunId:this.sessionRunId,...details };
  }
  snapshot() { return { accountId:this.accountId,state:this.state,previousActiveState:this.previousActiveState,sessionRunId:this.sessionRunId,generation:this.generation,retryCount:this.retryCount,error:this.error,changedAt:this.changedAt }; }
}
