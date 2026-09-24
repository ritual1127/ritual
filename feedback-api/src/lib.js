// 공용 도구: 응답·시간·해시·정리 함수. Workers와 Node(feedback-api/test.mjs) 둘 다에서 돈다.
export const DAY = 86400000;
const ALLOWED_ORIGINS = new Set(['https://naver1.cloud', 'http://127.0.0.1:8765', 'http://localhost:8765']);

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://naver1.cloud',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export const noContent = () => new Response(null, { status: 204 });

// 본문을 크기 제한 안에서 JSON 객체로 읽는다. sendBeacon은 text/plain으로 오므로 Content-Type은 따지지 않는다.
export async function readJson(request, limit) {
  const text = await request.text();
  if (!text || text.length > limit) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

// 통계의 날짜·시간대는 한국 시간 기준
export function kstNow(ms = Date.now()) {
  const d = new Date(ms + 9 * 3600000);
  return {
    ts: ms,
    day: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    label: `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${'일월화수목금토'[d.getUTCDay()]})`
  };
}

export const dayOffset = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY).toISOString().slice(0, 10);

export const clip = (value, max) => String(value ?? '').slice(0, max);

export function cleanPath(value) {
  const path = String(value || '').split(/[?#]/)[0];
  return /^\/[\w\-./%]{0,119}$/.test(path) ? path : '/';
}

// 유입 경로는 사이트 도메인만 남긴다(m.search.naver.com → naver.com). 우리 사이트 안에서 옮긴 건 빈 값.
export function refSite(ref) {
  let host;
  try { host = new URL(ref).hostname.toLowerCase(); } catch { return ''; }
  if (!host || host === 'naver1.cloud' || host.endsWith('.naver1.cloud') || host === 'localhost' || host === '127.0.0.1') return '';
  const parts = host.split('.');
  const keepThree = parts.length > 2 && /^(co|or|go|ac|ne|re|pe|com|net|org)$/.test(parts[parts.length - 2]);
  return parts.slice(keepThree ? -3 : -2).join('.').slice(0, 60);
}

export function deviceOf(ua) {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  return /Mobi|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
}

export const isBot = ua => !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|scrap|yeti|daumoa|facebookexternalhit|python|curl|wget|node-fetch|axios|go-http|java\//i.test(ua);

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const ipOf = request => request.headers.get('CF-Connecting-IP') || '0.0.0.0';

// 하루 단위 익명 방문자 값: 날짜가 바뀌면 같은 사람도 다른 값이 되고, 비밀값 없이는 IP로 되돌릴 수 없다.
export async function visitorId(env, request, day) {
  const ua = request.headers.get('User-Agent') || '';
  return (await sha256Hex(`${env.ADMIN_SECRET || 'dev'}|${day}|${ipOf(request)}|${ua}`)).slice(0, 16);
}

// 요청 한도(Workers Rate Limiting). 바인딩이 없으면(테스트) 통과시킨다.
export async function allowed(limiter, key) {
  if (!limiter) return true;
  try { return (await limiter.limit({ key })).success; } catch { return true; }
}

// ── 관리자 토큰: 본문(JSON, base64url).HMAC-SHA256 ──
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// 길이·내용과 상관없이 같은 시간이 걸리도록 두 값을 HMAC으로 바꿔 비교한다.
export async function safeEqual(secret, a, b) {
  return sameBytes(await hmac(secret, `cmp|${a}`), await hmac(secret, `cmp|${b}`));
}

export async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

export async function verifyToken(secret, token, now = Date.now()) {
  const [body, sig, extra] = String(token || '').split('.');
  if (!secret || !body || !sig || extra !== undefined) return null;
  try {
    if (!sameBytes(fromB64url(sig), await hmac(secret, body))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return payload.exp > now ? payload : null;
  } catch { return null; }
}
