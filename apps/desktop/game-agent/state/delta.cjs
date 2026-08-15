function createDelta(previous, current) {
  const patch = {},changed = [];
  for (const key of Object.keys(current)) if (JSON.stringify(previous?.[key]) !== JSON.stringify(current[key])) { patch[key]=current[key];changed.push(key); }
  return { patch,changed };
}
module.exports = { createDelta };
