// AI 도우미 지식 베이스 만들기: scripts/kb/*.txt(직접 쓴 문답) + 사이트 페이지 본문(h2 절 단위) → assistant/kb.json
// 문답 형식(빈 줄로 구분, #로 시작하는 덩어리는 주석):
//   Q: 대표 질문 | 다른 말로 한 질문 | …
//   L: /관련/링크/            (선택)
//   C: 테스트용으로 바꿔 쓴 질문 (선택, 이 문답으로 바로 이어져야 한다)
//   A: 답(여러 줄 가능)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'feedback-api', '.sites-stage', 'docs', 'admin', 'assistant', 'scripts', '.wrangler', '.superpowers']);

function readFaqs() {
  const faqs = [], checks = [];
  const dir = path.join(root, 'scripts', 'kb');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
    const cat = file.replace(/^\d+-/, '').replace(/\.txt$/, '');
    const blocks = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r/g, '').split(/\n[ \t]*\n/).map(b => b.trim()).filter(b => b && !b.startsWith('#'));
    blocks.forEach((block, i) => {
      const q = [], a = [], c = [];
      let u = '', inAnswer = false;
      for (const line of block.split('\n')) {
        if (line.startsWith('Q:')) q.push(...line.slice(2).split('|').map(s => s.trim()).filter(Boolean));
        else if (line.startsWith('L:')) u = line.slice(2).trim();
        else if (line.startsWith('C:')) c.push(line.slice(2).trim());
        else if (line.startsWith('A:')) { a.push(line.slice(2).trim()); inAnswer = true; }
        else if (inAnswer && !/^[QLC]:/.test(line)) a.push(line.trim());
        else throw new Error(`${file} ${i + 1}번째 문답: 알 수 없는 줄 "${line}"`);
      }
      if (!q.length || !a.length) throw new Error(`${file} ${i + 1}번째 문답: Q와 A가 필요해요`);
      const id = `${cat}-${String(i + 1).padStart(3, '0')}`;
      faqs.push({ id, k: 'faq', t: q[0], ...(q.length > 1 && { q: q.slice(1) }), a: a.join('\n'), ...(u && { u }) });
      c.forEach(text => checks.push([text, id]));
    });
  }
  return { faqs, checks };
}

const decode = text => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const textOf = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function pageFiles(dir = root, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) pageFiles(full, out);
    else if (item.name === 'index.html') out.push(full);
  }
  return out.sort();
}

// 긴 절은 문장 경계에서 900자 안팎으로 나눈다.
function chunks(text, max = 900) {
  const out = [];
  let rest = text;
  while (rest.length > max) {
    const cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('다. ', max), rest.lastIndexOf('요. ', max));
    const at = cut > max * .5 ? cut + 2 : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

// 페이지 본문: 설명 문단·목록·표·접힌 문답만 모으고 입력 화면 글자(버튼·라벨)는 뺀다.
function readPages() {
  const docs = [];
  for (const file of pageFiles()) {
    const html = fs.readFileSync(file, 'utf8');
    const route = '/' + path.relative(root, file).replace(/\\/g, '/').replace(/index\.html$/, '');
    const main = (html.match(/<main[\s\S]*?<\/main>/i) || [''])[0].replace(/<(script|style|svg|form|nav)[\s\S]*?<\/\1>/gi, ' ');
    const page = textOf((main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]);
    const slug = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    main.split(/<h2\b/i).slice(1).forEach((part, n) => {
      const heading = textOf((part.match(/^[^>]*>([\s\S]*?)<\/h2>/i) || [, ''])[1]);
      const body = [...part.matchAll(/<(p|li|summary|h3|th|td|dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => textOf(m[2])).filter(t => t.length > 1).join(' ');
      if (!heading || body.length < 40) return;
      chunks(body).forEach((x, i) => docs.push({ id: `doc-${slug}-${n + 1}${i ? `-${i + 1}` : ''}`.slice(0, 64), k: 'doc', t: `${page} · ${heading}`, u: route, x }));
    });
  }
  return docs;
}

export function buildKb() {
  const { faqs, checks } = readFaqs();
  const docs = [...faqs, ...readPages()];
  const v = crypto.createHash('sha1').update(JSON.stringify(docs)).digest('hex').slice(0, 10);
  return { v, docs, checks };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kb = buildKb();
  fs.mkdirSync(path.join(root, 'assistant'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assistant', 'kb.json'), JSON.stringify(kb));
  console.log(`assistant/kb.json: 문서 ${kb.docs.length}개(문답 ${kb.docs.filter(d => d.k === 'faq').length}개), 버전 ${kb.v}`);
}
