export function normalizeEndpoint(rawUrl) {
  try { const url = new URL(rawUrl); const path = url.pathname.split("/").map(part => /^\d+$/.test(part) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part) ? ":id" : part).join("/"); return { origin: url.origin, path }; }
  catch { return null; }
}
