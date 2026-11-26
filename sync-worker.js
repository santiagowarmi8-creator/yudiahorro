// yudiahorro-sync: stores only client-side-encrypted blobs, keyed by a hashed ID.
const ORIGINS = ['https://santiagowarmi8-creator.github.io'];
const MAX = 2_000_000; // ~2 MB of ciphertext
const PER_MIN = 120;   // requests per IP per minute (per isolate, basic)
const hits = new Map();
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (origin && !ORIGINS.includes(origin)) return j({ error: 'origin not allowed' }, 403);
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') return j({ ok: true, service: 'yudiahorro-sync' });
    const m = url.pathname.match(/^\/v1\/blob\/([a-f0-9]{64})$/);
    if (!m) return j({ error: 'not found' }, 404);
    const now = Date.now(), ip = req.headers.get('CF-Connecting-IP') || 'x', k = ip + ':' + Math.floor(now / 60000);
    const c = (hits.get(k) || 0) + 1; hits.set(k, c); if (hits.size > 5000) hits.clear();
    if (c > PER_MIN) return j({ error: 'rate limited' }, 429);
    const id = m[1];
    if (req.method === 'GET') {
      const have = url.searchParams.get('have');
      if (have) { const v = await env.DB.prepare('SELECT ver FROM blobs WHERE id = ?').bind(id).first(); if (v && String(v.ver) === have) return j({ ver: v.ver, same: true }); }
      const r = await env.DB.prepare('SELECT ver, data, updated FROM blobs WHERE id = ?').bind(id).first();
      return j(r ? { ver: r.ver, data: r.data, updated: r.updated } : { ver: 0, data: null });
    }
    if (req.method === 'PUT') {
      if (+(req.headers.get('Content-Length') || 0) > MAX) return j({ error: 'too large' }, 413);
      const t = await req.text(); if (t.length > MAX) return j({ error: 'too large' }, 413);
      let b; try { b = JSON.parse(t); } catch { return j({ error: 'bad json' }, 400); }
      if (typeof b.data !== 'string' || !Number.isInteger(b.ver) || b.ver < 0) return j({ error: 'bad body' }, 400);
      let r;
      if (b.ver === 0) r = await env.DB.prepare('INSERT INTO blobs (id, ver, data, updated) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, b.data, now).run();
      else r = await env.DB.prepare('UPDATE blobs SET ver = ver + 1, data = ?, updated = ? WHERE id = ? AND ver = ?').bind(b.data, now, id, b.ver).run();
      if (!r.meta.changes) return j({ error: 'version conflict' }, 409);
      return j({ ver: b.ver + 1, updated: now });
    }
    return j({ error: 'method not allowed' }, 405);
  }
};
