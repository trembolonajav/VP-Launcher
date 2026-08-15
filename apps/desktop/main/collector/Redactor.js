export function normalizeEndpoint(rawUrl) {
  try { const url = new URL(rawUrl); const path = url.pathname.split("/").map(part => /^\d+$/.test(part) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part) ? ":id" : part.length >= 8 && /\d|[A-Z].*[a-z]|[a-z].*[A-Z]/.test(part) ? ":opaque" : part).join("/"); return { origin: url.origin, path }; }
  catch { return null; }
}

const SENSITIVE = /authorization|cookie|token|secret|password|passwd|csrf|session|credential/i;
export function redactFrame(payload, maxBytes = 8192) {
  const raw = String(payload || ""), sizeBytes = Buffer.byteLength(raw);
  if (!raw || sizeBytes > maxBytes) return { sizeBytes, kind: "opaque", preview: null };
  try {
    const clean = (value, depth = 0) => { if (depth > 5) return "[depth]"; if (Array.isArray(value)) return value.slice(0, 50).map(item => clean(item, depth + 1)); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [key, SENSITIVE.test(key) ? "[redacted]" : clean(item, depth + 1)])); if (typeof value === "string") return value.length > 500 ? `${value.slice(0,500)}…` : value; return value; };
    return { sizeBytes, kind: "json", preview: clean(JSON.parse(raw)) };
  } catch { const preview = raw.replace(/(bearer\s+)[^\s]+/ig, "$1[redacted]").replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{20,})?/g, "[redacted-token]").replace(/([?&](?:token|key|secret|session|auth)=)[^&\s]+/ig, "$1[redacted]").replace(/[A-Fa-f0-9]{32,}/g, "[redacted-id]").slice(0, 1000); return { sizeBytes, kind: "text", preview }; }
}
