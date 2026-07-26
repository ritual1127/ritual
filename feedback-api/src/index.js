const ALLOWED_ORIGINS = new Set([
  "https://naver1.cloud",
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://naver1.cloud";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
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
};
