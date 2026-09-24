// 관리자 API: PIN 로그인, 통계 요약, 문의함, 지식 색인. PIN과 서명 비밀값은 Worker secret에만 있다.
import { clip, dayOffset, ipOf, json, kstNow, readJson, safeEqual, sha256Hex, signToken, verifyToken } from './lib.js';

const LOCK_MINE = 5, LOCK_ALL = 50, LOCK_MS = 15 * 60000, TOKEN_MS = 12 * 3600000;
const PERIODS = new Set([1, 7, 30, 90]);
export const EMBED_MODEL = '@cf/baai/bge-m3';

export async function handleAdmin(request, env, url) {
  if (!env.ADMIN_PIN || !env.ADMIN_SECRET) return json({ error: '관리자 비밀값이 설정되지 않았어요.' }, 503);
  if (url.pathname === '/admin/login' && request.method === 'POST') return login(request, env);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!(await verifyToken(env.ADMIN_SECRET, token))) return json({ error: 'unauthorized' }, 401);
  if (url.pathname === '/admin/summary' && request.method === 'GET') return summary(env, url);
  if (url.pathname === '/admin/inquiries' && request.method === 'GET') return inquiries(env);
  if (url.pathname === '/admin/reindex' && request.method === 'POST') return reindex(request, env);
  const one = url.pathname.match(/^\/admin\/inquiries\/(\d+)$/);
  if (one && request.method === 'POST') return setInquiry(request, env, Number(one[1]));
  if (one && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(Number(one[1])).run();
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

// 무차별 대입 막기: 같은 IP 15분에 5번, 전체 15분에 50번 틀리면 잠근다. IP는 비밀값을 섞은 해시로만 남긴다.
async function login(request, env) {
  const now = Date.now();
  const ip = (await sha256Hex(`${env.ADMIN_SECRET}|ip|${ipOf(request)}`)).slice(0, 24);
  const [mine, all] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_fails WHERE ip = ? AND ts > ?').bind(ip, now - LOCK_MS),
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_fails WHERE ts > ?').bind(now - LOCK_MS)
  ]);
  const fails = mine.results[0].n;
  if (fails >= LOCK_MINE || all.results[0].n >= LOCK_ALL) return json({ error: 'locked', retryAfter: LOCK_MS / 1000 }, 429);
  const body = await readJson(request, 256);
  if (!(await safeEqual(env.ADMIN_SECRET, String(body?.pin ?? ''), env.ADMIN_PIN))) {
    await env.DB.prepare('INSERT INTO login_fails (ip, ts) VALUES (?, ?)').bind(ip, now).run();
    return json({ error: 'wrong', left: Math.max(0, LOCK_MINE - fails - 1) }, 401);
  }
  const exp = now + TOKEN_MS;
  return json({ token: await signToken(env.ADMIN_SECRET, { exp }), exp });
}

const TOTALS = `SELECT SUM(type = 'view') AS views, COUNT(DISTINCT CASE WHEN type = 'view' THEN vid END) AS visitors,
  SUM(type = 'calc') AS calcs, SUM(type = 'chat') AS chats, SUM(type = 'contact') AS contacts
  FROM events WHERE day >= ? AND day <= ?`;

async function summary(env, url) {
  const asked = Number(url.searchParams.get('days'));
  const days = PERIODS.has(asked) ? asked : 7;
  const today = kstNow().day;
  const from = dayOffset(today, -(days - 1));
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);
  const results = await env.DB.batch([
    q(TOTALS, from, today),
    q(TOTALS, dayOffset(from, -days), dayOffset(from, -1)),
    q(`SELECT day, SUM(type = 'view') AS views, COUNT(DISTINCT CASE WHEN type = 'view' THEN vid END) AS visitors, SUM(type = 'calc') AS calcs
       FROM events WHERE day >= ? GROUP BY day ORDER BY day`, dayOffset(today, -(Math.max(days, 14) - 1))),
    q(`SELECT hour, COUNT(*) AS n FROM events WHERE day >= ? AND type = 'view' GROUP BY hour`, from),
    q(`SELECT path, COUNT(*) AS n, COUNT(DISTINCT vid) AS v FROM events WHERE day >= ? AND type = 'view' GROUP BY path ORDER BY n DESC LIMIT 15`, from),
    q(`SELECT path, COUNT(*) AS n FROM events WHERE day >= ? AND type = 'calc' GROUP BY path ORDER BY n DESC`, from),
    q(`SELECT ref, COUNT(*) AS n FROM events WHERE day >= ? AND type = 'view' AND ref != '' GROUP BY ref ORDER BY n DESC LIMIT 10`, from),
    q(`SELECT device, COUNT(DISTINCT vid) AS n FROM events WHERE day >= ? AND type = 'view' GROUP BY device ORDER BY n DESC`, from),
    q(`SELECT country, COUNT(DISTINCT vid) AS n FROM events WHERE day >= ? AND type = 'view' GROUP BY country ORDER BY n DESC LIMIT 6`, from),
    q(`SELECT route, COUNT(*) AS n FROM chats WHERE day >= ? GROUP BY route`, from),
    q(`SELECT id, ts, q, a, route FROM chats WHERE day >= ? ORDER BY id DESC LIMIT 40`, from),
    q(`SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status`),
    q(`SELECT v FROM meta WHERE k = 'kb'`)
  ]);
  const rows = i => results[i].results;
  return json({
    days, from, today,
    totals: rows(0)[0], previous: rows(1)[0],
    series: rows(2), hours: rows(3), pages: rows(4), tools: rows(5), refs: rows(6), devices: rows(7), countries: rows(8),
    chatRoutes: rows(9), chats: rows(10), inquiries: rows(11),
    kb: rows(12)[0] ? JSON.parse(rows(12)[0].v) : null
  });
}

async function inquiries(env) {
  const { results } = await env.DB.prepare('SELECT id, ts, kind, body, email, path, status FROM inquiries ORDER BY id DESC LIMIT 200').all();
  return json({ items: results });
}

async function setInquiry(request, env, id) {
  const body = await readJson(request, 256);
  await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(body?.status === 'done' ? 'done' : 'new', id).run();
  return json({ ok: true });
}

// 지식 색인: 관리자 화면이 kb.json을 50개 이하 묶음으로 보내면 임베딩해 Vectorize에 넣고,
// 마지막에 전체 id 목록(finish)을 보내면 사라진 문서를 지운다.
async function reindex(request, env) {
  const body = await readJson(request, 400000);
  if (!body) return json({ error: 'invalid' }, 400);
  if (Array.isArray(body.finish)) {
    const ids = body.finish.filter(id => typeof id === 'string' && id.length <= 64).slice(0, 5000);
    const saved = await env.DB.prepare(`SELECT v FROM meta WHERE k = 'kb_ids'`).first();
    const keep = new Set(ids);
    const removed = (saved ? JSON.parse(saved.v) : []).filter(id => !keep.has(id));
    for (let i = 0; i < removed.length; i += 100) await env.VEC.deleteByIds(removed.slice(i, i + 100));
    const info = { count: ids.length, at: Date.now(), version: clip(body.version, 40) };
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO meta (k, v) VALUES ('kb_ids', ?)`).bind(JSON.stringify(ids)),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (k, v) VALUES ('kb', ?)`).bind(JSON.stringify(info))
    ]);
    return json({ ok: true, removed: removed.length, ...info });
  }
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter(d => d && typeof d.id === 'string' && d.id.length <= 64 && d.t)
    .slice(0, 50);
  if (!items.length) return json({ error: 'empty' }, 400);
  const texts = items.map(d => clip(`${d.t}\n${[].concat(d.q || []).join('\n')}\n${d.a || d.x || ''}`, 2000));
  const { data } = await env.AI.run(EMBED_MODEL, { text: texts });
  await env.VEC.upsert(items.map((d, i) => ({
    id: d.id,
    values: data[i],
    metadata: { k: d.k === 'faq' ? 'faq' : 'doc', t: clip(d.t, 200), u: clip(d.u, 200), x: clip(d.a || d.x, 1800) }
  })));
  return json({ ok: true, upserted: items.length });
}
