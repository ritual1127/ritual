// 방문 통계 비컨(/t)과 문의하기(/contact)
import { allowed, clip, cleanPath, deviceOf, ipOf, isBot, json, kstNow, noContent, readJson, refSite, visitorId } from './lib.js';

const EVENT_TYPES = new Set(['view', 'calc', 'chat']);
const LOCAL_ROUTES = new Set(['rule', 'faq']);
const KINDS = new Set(['bug', 'idea', 'etc']);

function eventRow(env, request, { ts, day, hour }, type, path, ref, vid) {
  const ua = request.headers.get('User-Agent') || '';
  return env.DB.prepare('INSERT INTO events (ts, day, hour, type, path, ref, device, country, vid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(ts, day, hour, type, path, ref, deviceOf(ua), clip(request.cf?.country, 2), vid);
}

export async function logEvent(env, request, type, path, extra = []) {
  const now = kstNow();
  const vid = await visitorId(env, request, now.day);
  if (isBot(request.headers.get('User-Agent') || '')) return env.DB.batch(extra);
  return env.DB.batch([eventRow(env, request, now, type, cleanPath(path), '', vid), ...extra]);
}

// 페이지뷰·계산 완료·브라우저에서 바로 답한 질문. 응답은 항상 204(비컨은 결과를 읽지 않는다).
export async function handleTrack(request, env, ctx) {
  const ua = request.headers.get('User-Agent') || '';
  if (isBot(ua) || !(await allowed(env.TRACK_RL, `t:${ipOf(request)}`))) return noContent();
  const body = await readJson(request, 4096);
  if (!body || !EVENT_TYPES.has(body.type)) return noContent();
  const now = kstNow();
  const path = cleanPath(body.path);
  const vid = await visitorId(env, request, now.day);
  const rows = [eventRow(env, request, now, body.type, path, body.type === 'view' ? refSite(body.ref) : '', vid)];
  if (body.type === 'chat') {
    const q = clip(String(body.q || '').trim(), 500);
    if (!q || !LOCAL_ROUTES.has(body.route)) return noContent();
    rows.push(env.DB.prepare('INSERT INTO chats (ts, day, q, a, route, ms, path) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .bind(now.ts, now.day, q, clip(body.a, 1000), body.route, path));
  }
  ctx.waitUntil(env.DB.batch(rows).catch(error => console.error('track', error.message)));
  return noContent();
}

export async function handleContact(request, env) {
  if (!(await allowed(env.FORM_RL, `c:${ipOf(request)}`))) return json({ error: '잠시 뒤에 다시 보내 주세요.' }, 429);
  const body = await readJson(request, 12000);
  if (!body) return json({ error: '내용을 다시 확인해 주세요.' }, 400);
  // 사람 눈에 안 보이는 미끼 칸을 채웠거나 브라우저가 아니면 받은 척만 하고 저장하지 않는다
  if (body.website || isBot(request.headers.get('User-Agent') || '')) return json({ ok: true });
  const text = String(body.body || '').trim();
  if (text.length < 5 || text.length > 2000) return json({ error: '내용은 5~2000자로 적어 주세요.' }, 400);
  const email = String(body.email || '').trim();
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: '이메일 형식을 확인해 주세요.' }, 400);
  const now = kstNow();
  const vid = await visitorId(env, request, now.day);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE vid = ? AND ts > ?').bind(vid, now.ts - 86400000).first();
  if (recent.n >= 10) return json({ error: '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요.' }, 429);
  const kind = KINDS.has(body.kind) ? body.kind : 'etc';
  const path = cleanPath(body.path);
  await logEvent(env, request, 'contact', path, [
    env.DB.prepare('INSERT INTO inquiries (ts, kind, body, email, path, vid) VALUES (?, ?, ?, ?, ?, ?)').bind(now.ts, kind, text, email, path, vid)
  ]);
  return json({ ok: true });
}
