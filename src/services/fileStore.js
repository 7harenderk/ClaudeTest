// Small in-memory store for generated documents so the browser can download
// them by an opaque id right after generation. Nothing here touches disk, and
// entries expire on their own -- there is no reason to persist a generated
// resume server-side beyond the session that asked for it.

const { v4: uuidv4 } = require('uuid');

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const store = new Map();

function put(buffer, filename, mimeType) {
  const id = uuidv4();
  store.set(id, { buffer, filename, mimeType, createdAt: Date.now() });
  return id;
}

function get(id) {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) store.delete(id);
  }
}, 15 * 60 * 1000).unref();

module.exports = { put, get };
