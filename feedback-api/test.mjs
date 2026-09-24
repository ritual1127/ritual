// Worker 자체 점검: node feedback-api/test.mjs (D1은 node:sqlite로, AI·Vectorize·KV는 가짜로 대신한다)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from './src/index.js';
import { cleanPath, deviceOf, isBot, kstNow, refSite, safeEqual, signToken, verifyToken, dayOffset } from './src/lib.js';
import { buildMessages, fuse, pieceOf, relay } from './src/chat.js';

const dir = new URL('.', import.meta.url);

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(new URL('migrations/0001_init.sql', dir), 'utf8'));
  const run = (sql, args) => /^\s*select/i.test(sql) ? { results: db.prepare(sql).all(...args) } : (db.prepare(sql).run(...args), { results: [] });
  const stmt = (sql, args = []) => ({
    bind: (...next) => stmt(sql, next),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => run(sql, args),
    exec: () => run(sql, args)
  });
  return { prepare: sql => stmt(sql), batch: async list => list.map(s => s.exec()), db };
}

function fakeKV() {
  const map = new Map();
  return { get: async k => map.get(k) ?? null, put: async (k, v) => void map.set(k, v), delete: async k => void map.delete(k), list: async () => ({ keys: [...map.keys()].map(name => ({ name })) }) };
}

const sse = chunks => new ReadableStream({ start(c) { chunks.forEach(x => c.enqueue(new TextEncoder().encode(x))); c.close(); } });

function makeEnv(overrides = {}) {
  const vectors = new Map();
  return {
    DB: fakeD1(), FEEDBACK_KV: fakeKV(), PUSH_KV: fakeKV(),
    ADMIN_PIN: '6121', ADMIN_SECRET: 'test-secret',
    AI: {
      calls: [],
      async run(model, input) {
        this.calls.push(model);
        if (input.text) return { data: input.text.map(() => [0.1, 0.2]) };
        return sse(['data: {"choices":[{"delta":{"content":"안녕하세"}}]}\n', 'data: {"choices":[{"delta":{"content":"요"}}]}\n\ndata: [DONE]\n']);
      }
    },
    VEC: {
      async query() { return { matches: [...vectors.values()].map(v => ({ id: v.id, score: 0.8, metadata: v.metadata })) }; },
      async upsert(list) { list.forEach(v => vectors.set(v.id, v)); },
      async deleteByIds(ids) { ids.forEach(id => vectors.delete(id)); },
      vectors
    },
    ...overrides
  };
}

const ctx = () => { const jobs = []; return { waitUntil: p => jobs.push(p), done: () => Promise.all(jobs) }; };
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
function req(path, { method = 'POST', body, ua = CHROME, ip = '1.2.3.4', token, origin = 'https://naver1.cloud' } = {}) {
  const headers = { 'User-Agent': ua, 'CF-Connecting-IP': ip, Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
}
async function call(env, path, options) {
  const c = ctx();
  const res = await worker.fetch(req(path, options), env, c);
  await c.done();
  return res;
}

// ── 순수 함수 ──
assert.equal(refSite('https://m.search.naver.com/search?q=1'), 'naver.com');
assert.equal(refSite('https://www.google.co.kr/'), 'google.co.kr');
assert.equal(refSite('https://naver1.cloud/rank/'), '');
assert.equal(refSite('not a url'), '');
assert.equal(deviceOf(IPHONE), 'mobile');
assert.equal(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-S918N) Mobile Safari/537.36'), 'mobile');
assert.equal(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36'), 'tablet');
assert.equal(deviceOf(CHROME), 'desktop');
assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'));
assert.ok(isBot('Mozilla/5.0 HeadlessChrome/140.0'));
assert.ok(isBot(''));
assert.ok(!isBot(CHROME));
assert.equal(cleanPath('/rank/?a=1#x'), '/rank/');
assert.equal(cleanPath('https://evil.test/'), '/');
assert.equal(cleanPath('/<script>'), '/');
assert.deepEqual([kstNow(Date.UTC(2026, 8, 24, 15, 30)).day, kstNow(Date.UTC(2026, 8, 24, 15, 30)).hour], ['2026-09-25', 0]);
assert.equal(kstNow(Date.UTC(2026, 8, 24, 3)).label, '2026년 9월 24일 (목)');
assert.equal(dayOffset('2026-03-01', -1), '2026-02-28');

const token = await signToken('s', { exp: Date.now() + 1000 });
assert.ok(await verifyToken('s', token));
assert.equal(await verifyToken('other', token), null);
assert.equal(await verifyToken('s', token.replace(/.$/, c => (c === 'A' ? 'B' : 'A'))), null);
assert.equal(await verifyToken('s', await signToken('s', { exp: Date.now() - 1 })), null);
assert.equal(await verifyToken('s', 'garbage'), null);
assert.ok(await safeEqual('k', '6121', '6121'));
assert.ok(!(await safeEqual('k', '6122', '6121')));
assert.ok(!(await safeEqual('k', '', '6121')));

assert.deepEqual(fuse([[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]]).map(d => d.id), ['b', 'a', 'c']);
assert.equal(pieceOf('data: {"choices":[{"delta":{"content":"가"}}],"response":""}'), '가');
assert.equal(pieceOf('data: {"response":"나"}'), '나');
assert.equal(pieceOf('data: [DONE]'), '');
assert.equal(pieceOf('event: x'), '');
assert.equal(pieceOf('data: {broken'), '');
const messages = buildMessages('질문', [{ role: 'user', content: '앞' }], [{ id: 'd', t: '제목', u: '/rank/', x: '본문' }], '2026년 9월 24일 (목)');
assert.equal(messages.length, 3);
assert.match(messages[0].content, /\[자료 1\] 제목 \(\/rank\/\)\n본문/);

// relay: 줄이 조각나 도착해도 글자를 모두 모으고, 글자가 없으면 error로 끝낸다
{
  let finished = null;
  const res = relay(sse(['data: {"choices":[{"delta":{"content":"20', '0명"}}]}\n', 'data: {"response":" 중"}\n']), { route: 'ai', sources: [] }, t => { finished = t; });
  const text = await res.text();
  assert.match(text, /^event: meta\n/);
  assert.match(text, /event: done/);
  assert.equal(finished, '200명 중');
  const empty = await relay(sse(['data: [DONE]\n']), { route: 'ai' }, () => {}).text();
  assert.match(empty, /event: error/);
}

// ── 통계 비컨 ──
{
  const env = makeEnv();
  assert.equal((await call(env, '/t', { body: { type: 'view', path: '/rank/', ref: 'https://www.google.com/search?q=x' } })).status, 204);
  await call(env, '/t', { body: { type: 'view', path: '/' }, ua: 'Googlebot/2.1' });
  await call(env, '/t', { body: { type: 'calc', path: '/rank/' }, ua: IPHONE });
  await call(env, '/t', { body: { type: 'chat', path: '/', q: '오늘 급식', route: 'rule', a: '카레' } });
  await call(env, '/t', { body: { type: 'chat', path: '/', q: '가짜', route: 'ai' } });
  await call(env, '/t', { body: 'not json' });
  const rows = env.DB.db.prepare('SELECT type, path, ref, device FROM events ORDER BY id').all().map(r => ({ ...r }));
  assert.deepEqual(rows, [
    { type: 'view', path: '/rank/', ref: 'google.com', device: 'desktop' },
    { type: 'calc', path: '/rank/', ref: '', device: 'mobile' },
    { type: 'chat', path: '/', ref: '', device: 'desktop' }
  ]);
  assert.deepEqual(env.DB.db.prepare('SELECT q, route FROM chats').all().map(r => ({ ...r })), [{ q: '오늘 급식', route: 'rule' }]);
}

// ── 문의하기 ──
{
  const env = makeEnv();
  assert.equal((await call(env, '/contact', { body: { kind: 'bug', body: '짧' } })).status, 400);
  assert.equal((await call(env, '/contact', { body: { kind: 'bug', body: '이메일이 이상해요', email: 'nope' } })).status, 400);
  assert.equal((await call(env, '/contact', { body: { kind: 'bug', body: '미끼 칸을 채운 봇', website: 'x' } })).status, 200);
  const ok = await call(env, '/contact', { body: { kind: 'idea', body: '다크 모드가 좋아요 <b>굵게</b>', email: 'a@b.co', path: '/rank/' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://naver1.cloud');
  const saved = env.DB.db.prepare('SELECT kind, body, email, path FROM inquiries').all().map(r => ({ ...r }));
  assert.deepEqual(saved, [{ kind: 'idea', body: '다크 모드가 좋아요 <b>굵게</b>', email: 'a@b.co', path: '/rank/' }]);
  for (let i = 0; i < 9; i++) await call(env, '/contact', { body: { kind: 'etc', body: `여러 번 보내기 ${i}` } });
  assert.equal((await call(env, '/contact', { body: { kind: 'etc', body: '열한 번째 문의' } })).status, 429);
}

// ── 관리자 ──
{
  const env = makeEnv();
  assert.equal((await call(env, '/admin/summary', { method: 'GET' })).status, 401);
  for (let i = 4; i >= 0; i--) {
    const res = await call(env, '/admin/login', { body: { pin: '0000' } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).left, i);
  }
  assert.equal((await call(env, '/admin/login', { body: { pin: '6121' } })).status, 429, '같은 IP는 맞는 PIN이어도 잠겨 있어야 한다');
  const login = await call(env, '/admin/login', { body: { pin: '6121' }, ip: '9.9.9.9' });
  assert.equal(login.status, 200);
  const { token: adminToken } = await login.json();
  await call(env, '/t', { body: { type: 'view', path: '/' } });
  await call(env, '/contact', { body: { kind: 'bug', body: '버튼이 안 눌려요' } });
  const summary = await call(env, '/admin/summary?days=7', { method: 'GET', token: adminToken });
  assert.equal(summary.status, 200);
  const data = await summary.json();
  assert.equal(data.totals.views, 1);
  assert.equal(data.totals.visitors, 1);
  assert.equal(data.totals.contacts, 1);
  assert.deepEqual(data.inquiries, [{ status: 'new', n: 1 }]);
  const list = await (await call(env, '/admin/inquiries', { method: 'GET', token: adminToken })).json();
  assert.equal(list.items[0].body, '버튼이 안 눌려요');
  await call(env, `/admin/inquiries/${list.items[0].id}`, { body: { status: 'done' }, token: adminToken });
  assert.equal(env.DB.db.prepare('SELECT status FROM inquiries').get().status, 'done');
  await call(env, `/admin/inquiries/${list.items[0].id}`, { method: 'DELETE', token: adminToken });
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM inquiries').get().n, 0);
  // 지식 색인: 넣고, 목록에서 빠진 문서는 지운다
  const idx = await call(env, '/admin/reindex', { body: { items: [{ id: 'faq-a', k: 'faq', t: '질문', q: ['변형'], a: '답' }, { id: 'doc-b', k: 'doc', t: '문서', u: '/rank/', x: '본문' }] }, token: adminToken });
  assert.deepEqual(await idx.json(), { ok: true, upserted: 2 });
  await call(env, '/admin/reindex', { body: { finish: ['faq-a', 'doc-b'], version: 'v1' }, token: adminToken });
  const fin = await (await call(env, '/admin/reindex', { body: { finish: ['faq-a'], version: 'v2' }, token: adminToken })).json();
  assert.equal(fin.removed, 1);
  assert.deepEqual([...env.VEC.vectors.keys()], ['faq-a']);
  assert.equal((await (await call(env, '/admin/summary?days=1', { method: 'GET', token: adminToken })).json()).kb.version, 'v2');
  // 비밀값이 없으면 관리자 전체를 막는다
  assert.equal((await call(makeEnv({ ADMIN_PIN: '' }), '/admin/login', { body: { pin: '' } })).status, 503);
}

// ── AI 도우미 ──
{
  const env = makeEnv();
  await env.VEC.upsert([{ id: 'doc-x', values: [0], metadata: { k: 'doc', t: '9등급 비율', u: '/blog/nine-grade-system/', x: '1등급 4%' } }]);
  const res = await call(env, '/chat', { body: { q: '1등급 비율?', ctx: [], weak: true, path: '/rank/' } });
  assert.equal(res.headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
  const text = await res.text();
  assert.match(text, /"sources":\[\{"t":"9등급 비율","u":"\/blog\/nine-grade-system\/"\}\]/);
  assert.match(text, /event: done/);
  // 대화 기록은 스트림이 끝난 뒤 waitUntil로 남으므로 잠깐 기다린다
  for (let i = 0; i < 100 && !env.DB.db.prepare('SELECT COUNT(*) AS n FROM chats').get().n; i++) await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(env.AI.calls, ['@cf/baai/bge-m3', '@cf/google/gemma-4-26b-a4b-it']);
  const chat = env.DB.db.prepare('SELECT q, a, route FROM chats').get();
  assert.deepEqual({ ...chat }, { q: '1등급 비율?', a: '안녕하세요', route: 'ai' });

  // 키워드 결과가 충분하면 의미 검색을 건너뛴다
  const strong = makeEnv();
  await (await call(strong, '/chat', { body: { q: '석차', ctx: [{ id: 'a', t: 'A', u: '/rank/', x: '가' }, { id: 'b', t: 'B', u: '/', x: '나' }] } })).text();
  assert.deepEqual(strong.AI.calls, ['@cf/google/gemma-4-26b-a4b-it']);

  // 모델이 다 실패하면 관련 자료만 JSON으로
  const broken = makeEnv({ AI: { async run(model, input) { if (input.text) return { data: [[0]] }; throw new Error('4006: daily free allocation used'); } } });
  const fallback = await call(broken, '/chat', { body: { q: '아무거나', ctx: [{ id: 'a', t: 'A', u: '/rank/', x: '가나다' }, { id: 'b', t: 'B', u: '/', x: '라' }] } });
  assert.equal(fallback.headers.get('Content-Type'), 'application/json; charset=utf-8');
  const body = await fallback.json();
  assert.equal(body.route, 'none');
  assert.equal(body.sources[0].u, '/rank/');
  assert.equal(broken.DB.db.prepare('SELECT route FROM chats').get().route, 'none');
  assert.equal((await call(env, '/chat', { body: { q: '   ' } })).status, 400);
}

// ── 기존 기능(좋아요·푸시 구독)은 그대로 ──
{
  const env = makeEnv();
  assert.deepEqual(await (await call(env, '/vote', { method: 'GET' })).json(), { likes: 0, dislikes: 0 });
  assert.deepEqual(await (await call(env, '/vote', { body: { type: 'like', previous: null } })).json(), { likes: 1, dislikes: 0 });
  assert.equal((await call(env, '/subscribe', { body: { subscription: { endpoint: 'https://push.test/1' } } })).status, 200);
  assert.equal((await env.PUSH_KV.list()).keys.length, 1);
  assert.equal((await call(env, '/nope', { method: 'GET' })).status, 404);
  const pre = await worker.fetch(new Request('https://api.test/chat', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8765' } }), env, ctx());
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:8765');
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
}

console.log('Worker 자체 점검 통과');
