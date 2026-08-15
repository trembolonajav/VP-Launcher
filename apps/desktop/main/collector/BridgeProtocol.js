const TYPES = new Set(["STATUS", "DELTA", "ACTION"]);
const FORBIDDEN = /password|passwd|authorization|cookie|token|secret|credential|csrf/i;
export const AGENT_PROTOCOL_VERSION = 2;
export const MAX_AGENT_MESSAGE_BYTES = 64 * 1024;

export function validateAgentMessage(message, expectedAccountId, previousSequence = 0, previousInstanceId = null) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return { ok:false,error:"message must be an object" };
  let bytes; try { bytes = Buffer.byteLength(JSON.stringify(message)); } catch { return { ok:false,error:"message is not serializable" }; }
  if (bytes > MAX_AGENT_MESSAGE_BYTES) return { ok:false,error:"message exceeds size limit" };
  if (message.version !== AGENT_PROTOCOL_VERSION) return { ok:false,error:"unsupported protocol version" };
  if (message.accountId !== expectedAccountId) return { ok:false,error:"account mismatch" };
  if (typeof message.instanceId !== "string" || !/^[0-9a-f-]{36}$/i.test(message.instanceId)) return { ok:false,error:"invalid instance id" };
  if (!TYPES.has(message.type)) return { ok:false,error:"unknown message type" };
  const newInstance = previousInstanceId && message.instanceId !== previousInstanceId;
  if (!Number.isSafeInteger(message.sequence) || message.sequence < 1 || (!newInstance && message.sequence <= previousSequence) || (newInstance && (message.type !== "STATUS" || message.sequence !== 1))) return { ok:false,error:"non-monotonic sequence" };
  if (typeof message.timestamp !== "string" || !Number.isFinite(Date.parse(message.timestamp))) return { ok:false,error:"invalid timestamp" };
  if (!message.payload || typeof message.payload !== "object" || Array.isArray(message.payload)) return { ok:false,error:"invalid payload" };
  const scan = value => { if (!value || typeof value !== "object") return false; return Object.entries(value).some(([key,item]) => FORBIDDEN.test(key) || scan(item)); };
  if (scan(message.payload)) return { ok:false,error:"forbidden field" };
  return { ok:true,value:message,bytes };
}
