import { handleAdmin } from "./admin.js";
import { handleChat } from "./chat.js";
import { DAY, corsHeaders } from "./lib.js";
import { handleContact, handleTrack } from "./track.js";

const VAPID_PUBLIC_KEY = "BMK5uCsTJJQZYXyFmwW-tepqmX-uldSkUa4GWijuK7TB_MXeU8ZYZYS5KLeWYpPsijZ_SVeZhlCcyqwMQBJHNxA";


function base64urlEncodeBytes(bytes) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncodeString(str) {
  return base64urlEncodeBytes(new TextEncoder().encode(str));
}

async function importVapidPrivateKey(env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY_JWK);
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// RFC 8292 VAPID: 엔드포인트별로 서명한 JWT를 Authorization 헤더에 실어보낸다.
// payload(알림 내용)를 안 보내는 빈 푸시라 암호화(aes128gcm) 관련 헤더는 필요 없다.
async function buildVapidAuthHeader(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:smilepea@naver.com",
  };
  const unsigned = `${base64urlEncodeString(JSON.stringify(header))}.${base64urlEncodeString(JSON.stringify(claims))}`;
  const key = await importVapidPrivateKey(env);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const signature = base64urlEncodeBytes(new Uint8Array(sigBuf));
  return `vapid t=${unsigned}.${signature}, k=${VAPID_PUBLIC_KEY}`;
}

async function hashEndpoint(endpoint) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function sendEmptyPush(subscription, env) {
  const auth = await buildVapidAuthHeader(subscription.endpoint, env);
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: { Authorization: auth, TTL: "60" },
  });
}

// AI 도우미·문의·통계·관리자(새 기능). 응답마다 CORS 헤더를 붙인다.
async function route(request, env, ctx, url) {
  if (url.pathname === "/t" && request.method === "POST") return handleTrack(request, env, ctx);
  if (url.pathname === "/contact" && request.method === "POST") return handleContact(request, env);
  if (url.pathname === "/chat" && request.method === "POST") return handleChat(request, env, ctx);
  if (url.pathname.startsWith("/admin/")) return handleAdmin(request, env, url);
  return null;
}

// 보관 기간이 지난 통계·질문·문의·로그인 실패 기록을 지운다(매일 크론).
async function pruneData(env) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM events WHERE ts < ?").bind(now - 180 * DAY),
    env.DB.prepare("DELETE FROM chats WHERE ts < ?").bind(now - 90 * DAY),
    env.DB.prepare("DELETE FROM inquiries WHERE ts < ?").bind(now - 365 * DAY),
    env.DB.prepare("DELETE FROM login_fails WHERE ts < ?").bind(now - DAY),
  ]);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    let routed = null;
    try {
      routed = await route(request, env, ctx, url);
    } catch (error) {
      console.error("route", url.pathname, error?.message);
      routed = new Response(JSON.stringify({ error: "잠시 후 다시 시도해 주세요." }), { status: 500, headers });
    }
    if (routed) {
      for (const [key, value] of Object.entries(corsHeaders(origin))) routed.headers.set(key, value);
      return routed;
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "invalid body" }), { status: 400, headers });
      }
      const subscription = body.subscription;
      if (!subscription || !subscription.endpoint) {
        return new Response(JSON.stringify({ error: "invalid subscription" }), { status: 400, headers });
      }
      const key = await hashEndpoint(subscription.endpoint);
      await env.PUSH_KV.put(key, JSON.stringify(subscription));
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    if (url.pathname === "/unsubscribe" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "invalid body" }), { status: 400, headers });
      }
      if (!body.endpoint) {
        return new Response(JSON.stringify({ error: "invalid endpoint" }), { status: 400, headers });
      }
      const key = await hashEndpoint(body.endpoint);
      await env.PUSH_KV.delete(key);
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    if (url.pathname !== "/vote") {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers });
    }

    if (request.method === "GET") {
      const [likes, dislikes] = await Promise.all([
        env.FEEDBACK_KV.get("likes"),
        env.FEEDBACK_KV.get("dislikes"),
      ]);
      return new Response(
        JSON.stringify({ likes: Number(likes) || 0, dislikes: Number(dislikes) || 0 }),
        { headers }
      );
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "invalid body" }), { status: 400, headers });
      }

      const { type, previous } = body;
      if (type !== "like" && type !== "dislike") {
        return new Response(JSON.stringify({ error: "invalid type" }), { status: 400, headers });
      }
      if (previous !== null && previous !== "like" && previous !== "dislike") {
        return new Response(JSON.stringify({ error: "invalid previous" }), { status: 400, headers });
      }

      const likeKey = "likes";
      const dislikeKey = "dislikes";
      let likes = Number(await env.FEEDBACK_KV.get(likeKey)) || 0;
      let dislikes = Number(await env.FEEDBACK_KV.get(dislikeKey)) || 0;

      if (previous === "like") likes = Math.max(0, likes - 1);
      if (previous === "dislike") dislikes = Math.max(0, dislikes - 1);
      if (type === "like") likes += 1;
      if (type === "dislike") dislikes += 1;

      await Promise.all([
        env.FEEDBACK_KV.put(likeKey, String(likes)),
        env.FEEDBACK_KV.put(dislikeKey, String(dislikes)),
      ]);

      return new Response(JSON.stringify({ likes, dislikes }), { headers });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers });
  },

  // 매일 KST 11:30(=UTC 02:30)에 저장된 모든 구독자에게 빈 푸시를 보낸다.
  // 실제 급식 메뉴 조회는 각 기기의 서비스워커가 push 이벤트를 받은 순간 직접 한다.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pruneData(env).catch((error) => console.error("prune", error?.message)));
    const list = await env.PUSH_KV.list();
    for (const { name } of list.keys) {
      const raw = await env.PUSH_KV.get(name);
      if (!raw) continue;
      const subscription = JSON.parse(raw);
      const res = await sendEmptyPush(subscription, env).catch(() => null);
      if (res && (res.status === 404 || res.status === 410)) {
        await env.PUSH_KV.delete(name);
      }
    }
  },
};
