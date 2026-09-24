// AI 도우미 서버 단계: 브라우저 키워드 검색 결과 + (약하면) 의미 검색을 RRF로 합쳐 근거로 주고,
// Workers AI가 해요체로 스트리밍한다. 모델이 모두 실패하면 route:'none'으로 관련 자료만 돌려준다.
import { EMBED_MODEL } from './admin.js';
import { allowed, clip, cleanPath, ipOf, json, kstNow, readJson } from './lib.js';
import { logEvent } from './track.js';

// 측정(2026-09-24, 로컬→엣지): gemma 첫 글자 0.2~0.5초·답 1회 약 6뉴런, qwen 전체 0.6~1초. 생각 모드는 끈다.
export const CHAT_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/qwen/qwen3-30b-a3b-fp8'];
const MIN_SIMILARITY = 0.5;

export function cleanHistory(value) {
  return (Array.isArray(value) ? value : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-6)
    .map(m => ({ role: m.role, content: clip(m.content.trim(), 600) }));
}

export function cleanDocs(value) {
  return (Array.isArray(value) ? value : [])
    .filter(d => d && typeof d.id === 'string' && (d.x || d.a))
    .slice(0, 6)
    .map(d => ({ id: clip(d.id, 64), t: clip(d.t, 120), u: cleanUrl(d.u), x: clip(d.x || d.a, 900) }));
}

const cleanUrl = u => (typeof u === 'string' && /^\/(?!\/)[\w\-./#%]*$/.test(u) ? clip(u, 120) : '');

// 여러 순위 목록을 순위 역수 합(RRF)으로 합친다. 같은 문서는 먼저 나온 내용을 쓴다.
export function fuse(lists, k = 60) {
  const score = new Map(), byId = new Map();
  lists.forEach(list => list.forEach((doc, rank) => {
    score.set(doc.id, (score.get(doc.id) || 0) + 1 / (k + rank + 1));
    if (!byId.has(doc.id)) byId.set(doc.id, doc);
  }));
  return [...byId.values()].sort((a, b) => score.get(b.id) - score.get(a.id));
}

async function semanticSearch(env, q) {
  if (!env.AI || !env.VEC) return [];
  const { data } = await env.AI.run(EMBED_MODEL, { text: [q] });
  const { matches } = await env.VEC.query(data[0], { topK: 6, returnMetadata: 'all' });
  return matches
    .filter(m => m.score >= MIN_SIMILARITY && m.metadata?.x)
    .map(m => ({ id: m.id, t: clip(m.metadata.t, 120), u: cleanUrl(m.metadata.u), x: clip(m.metadata.x, 900) }));
}

const TOOLS = '[성적 계산기](/)(수행·지필 반영 점수), [목표 점수 계산기](/target-score/), [석차등급 계산기](/rank/)(내신 등급·평균 등급), [학점 계산기](/gpa/)(대학 GPA), [GPA 환산기](/gpa-converter/), [오늘의 급식](/todayfood/), [오늘의 시간표](/todayclass/)';

export function buildMessages(q, history, docs, today) {
  const refs = docs.map((d, i) => `[자료 ${i + 1}] ${d.t}${d.u ? ` (${d.u})` : ''}\n${d.x}`).join('\n\n');
  const system = `너는 '성적 계산기'(naver1.cloud)의 AI 도우미야. 오늘은 ${today}(한국 시간)이야.
한국 중·고등학생과 학부모가 내신, 수행평가, 성취도(A~E), 9등급·5등급 상대평가, 석차, 평균 등급, 학점 변환, 수능과 대입 기초, 공부법, 학교생활, 이 사이트 사용법을 물어봐.
답하는 방법:
- 해요체로 짧고 친절하게, 결론부터 말해. 보통 2~5문장, 필요하면 짧은 목록(- ). 강조는 **굵게**만 쓰고 표나 제목(#)은 쓰지 마.
- [자료]가 있으면 먼저 근거로 삼아. 자료에 없으면 일반 지식으로 답하되, 확실하지 않으면 추측하지 말고 모른다고 말해.
- 반올림·동점자·반영 비율처럼 학교마다 다른 성적 처리 규정을 묻는 질문일 때만 "학교 학업성적관리규정을 확인하세요"라고 덧붙이고, 공부법 같은 다른 질문에는 붙이지 마.
- 계산이 필요하면 식을 한 줄로 보여 주고 결과를 말해. 도움이 되는 도구가 있으면 이 링크를 그대로 한 번만 써: ${TOOLS}.
- 이름·전화번호 같은 개인정보는 묻지 말고, 위험하거나 부적절한 요청은 정중히 거절해.
- 사이트와 상관없는 질문도 학생에게 도움이 되면 짧게 답해.${refs ? `\n\n[자료]\n${refs}` : ''}`;
  return [{ role: 'system', content: system }, ...history, { role: 'user', content: q }];
}

// Workers AI SSE(OpenAI 형식 또는 {response}) 한 줄에서 글자 조각을 꺼낸다.
export function pieceOf(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return '';
  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const j = JSON.parse(data);
    return j.choices?.[0]?.delta?.content || j.response || '';
  } catch { return ''; }
}

// 우리 형식 SSE: event:meta(근거) → data:{t}(글자 조각)… → event:done 또는 event:error(글자가 하나도 없을 때)
export function relay(upstream, meta, onDone) {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  let reader = null;
  const body = new ReadableStream({
    async start(controller) {
      const send = (data, event) => {
        try { controller.enqueue(encoder.encode(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      let buf = '', text = '';
      const take = piece => { if (piece) { text += piece; send({ t: piece }); } };
      send(meta, 'meta');
      try {
        reader = upstream.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            take(pieceOf(buf.slice(0, i)));
            buf = buf.slice(i + 1);
          }
        }
        take(pieceOf(buf));
      } catch (error) { console.error('relay', error?.message); }
      send({ ok: Boolean(text) }, text ? 'done' : 'error');
      try { controller.close(); } catch {}
      onDone(text);
    },
    cancel() { reader?.cancel().catch(() => {}); }
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function handleChat(request, env, ctx) {
  const started = Date.now();
  if (!(await allowed(env.CHAT_RL, `q:${ipOf(request)}`))) return json({ error: '질문이 너무 많아요. 1분 뒤에 다시 물어봐 주세요.' }, 429);
  const body = await readJson(request, 24000);
  const q = clip(String(body?.q || '').trim(), 500);
  if (!q) return json({ error: '질문을 입력해 주세요.' }, 400);
  const history = cleanHistory(body.history);
  let docs = cleanDocs(body.ctx);
  if (body.weak === true || docs.length < 2) {
    const semantic = await semanticSearch(env, q).catch(error => { console.error('semantic', error?.message); return []; });
    docs = fuse([docs, semantic]).slice(0, 6);
  }
  const seen = new Set();
  const sources = docs.filter(d => d.u && !seen.has(d.u) && seen.add(d.u)).slice(0, 3).map(d => ({ t: d.t, u: d.u }));
  const now = kstNow();
  const path = cleanPath(body.path);
  const save = (answer, route) => ctx.waitUntil(logEvent(env, request, 'chat', path, [
    env.DB.prepare('INSERT INTO chats (ts, day, q, a, route, ms, path) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(now.ts, now.day, q, clip(answer, 1000), route, Date.now() - started, path)
  ]).catch(error => console.error('chat log', error?.message)));
  const messages = buildMessages(q, history, docs, now.label);
  for (const model of CHAT_MODELS) {
    try {
      const upstream = await env.AI.run(model, {
        messages, stream: true, max_tokens: 700, temperature: 0.3, chat_template_kwargs: { enable_thinking: false }
      });
      return relay(upstream, { route: 'ai', sources }, text => save(text, text ? 'ai' : 'none'));
    } catch (error) { console.error('ai', model, error?.message); }
  }
  save('', 'none');
  return json({ route: 'none', sources: docs.slice(0, 4).map(d => ({ t: d.t, u: d.u, x: clip(d.x, 240) })) });
}
