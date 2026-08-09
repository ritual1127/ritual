import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = [];
const errors = [];
const warnings = [];
const titles = new Map();
const descriptions = new Map();

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'dist', 'node_modules', 'feedback-api', '.wrangler', '.sites-stage'].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (item.name === 'index.html') htmlFiles.push(full);
  }
}

function routeOf(file) {
  return '/' + path.relative(root, file).replace(/\\/g, '/').replace(/index\.html$/, '');
}

function first(html, regex) { return html.match(regex)?.[1]?.trim() || ''; }
function meta(html, key, attr = 'name') {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return first(html, new RegExp(`<meta\\s+[^>]*${attr}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i')) ||
    first(html, new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${escaped}["'][^>]*>`, 'i'));
}

function textContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addUnique(map, value, route, label) {
  if (!value) return;
  if (map.has(value)) errors.push(`${route}: ${label} 중복 (${map.get(value)})`);
  else map.set(value, route);
}

walk(root);
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const articleTokens = [];
const commonWords = new Set(['계산기', '계산법', '성적', '점수', '결과', '확인', '공식', '예시', '관련', '자주', '묻는', '질문', '학교', '대학', '사용', '경우', '입니다', '합니다', '있습니다', '하세요']);

if (!fs.existsSync(path.join(root, 'favicon.png'))) errors.push('/: favicon.png 누락');

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const route = routeOf(file);
  const expectedCanonical = `https://naver1.cloud${route}`;
  const title = first(html, /<title>([^<]+)<\/title>/i);
  const description = meta(html, 'description');
  const canonical = first(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || first(html, /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  const h1s = [...html.matchAll(/<h1\b[^>]*>/gi)].length;
  const viewport = meta(html, 'viewport');
  const robots = meta(html, 'robots').toLowerCase();

  if (!title) errors.push(`${route}: title 누락`);
  else if (title.length < 8 || title.length > 65) warnings.push(`${route}: title 길이 ${title.length}자`);
  if (!description) errors.push(`${route}: description 누락`);
  else if (description.length < 35 || description.length > 170) warnings.push(`${route}: description 길이 ${description.length}자`);
  if (h1s !== 1) errors.push(`${route}: H1 ${h1s}개`);
  if (canonical !== expectedCanonical) errors.push(`${route}: canonical 불일치 (${canonical || '없음'})`);
  if (/noindex/.test(robots)) errors.push(`${route}: noindex 설정됨`);
  if (route === '/' && !/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["']/i.test(html)) {
    errors.push('/: 루트 favicon 링크 누락');
  }
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(viewport)) warnings.push(`${route}: 화면 확대 제한`);
  addUnique(titles, title, route, 'title');
  addUnique(descriptions, description, route, 'description');

  for (const [property, value] of [
    ['og:title', meta(html, 'og:title', 'property')],
    ['og:description', meta(html, 'og:description', 'property')],
    ['og:url', meta(html, 'og:url', 'property')]
  ]) if (!value) errors.push(`${route}: ${property} 누락`);
  if (meta(html, 'og:url', 'property') && meta(html, 'og:url', 'property') !== expectedCanonical) errors.push(`${route}: og:url 불일치`);

  const jsonBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonBlocks) {
    try {
      const entries = Array.isArray(JSON.parse(block[1])) ? JSON.parse(block[1]) : [JSON.parse(block[1])];
      for (const data of entries) {
        if ((data['@type'] === 'BlogPosting' || data['@type'] === 'Article') && !data.image) warnings.push(`${route}: BlogPosting image 누락`);
        if (data['@type'] === 'FAQPage' && (!Array.isArray(data.mainEntity) || !data.mainEntity.length)) errors.push(`${route}: FAQPage mainEntity 누락`);
      }
    } catch { errors.push(`${route}: JSON-LD 파싱 실패`); }
  }

  if (!sitemap.includes(`<loc>${expectedCanonical}</loc>`)) warnings.push(`${route}: sitemap 누락`);
  for (const match of html.matchAll(/href=["'](\/[^"'#?]*)/gi)) {
    const href = match[1];
    const local = path.join(root, href.replace(/^\//, ''), href.endsWith('/') ? 'index.html' : '');
    if (!fs.existsSync(local)) errors.push(`${route}: 깨진 내부 링크 ${href}`);
  }

  if (/^\/blog\/[^/]+\/$/.test(route)) {
    const main = first(html, /<main\b[^>]*class=["'][^"']*article[^"']*["'][^>]*>([\s\S]*?)<\/main>/i) || html;
    const articleText = textContent(main);
    const words = new Set((articleText.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || []).filter(word => !commonWords.has(word)));
    articleTokens.push({ route, words });
    if (articleText.length < 700) warnings.push(`${route}: 본문이 짧음 (${articleText.length}자)`);
  }
}

for (let i = 0; i < articleTokens.length; i++) {
  for (let j = i + 1; j < articleTokens.length; j++) {
    const a = articleTokens[i], b = articleTokens[j];
    const intersection = [...a.words].filter(word => b.words.has(word)).length;
    const union = new Set([...a.words, ...b.words]).size;
    const similarity = union ? intersection / union : 0;
    if (similarity > 0.55) warnings.push(`${a.route} ↔ ${b.route}: 단어 유사도 ${(similarity * 100).toFixed(0)}%`);
  }
}

const score = Math.max(0, 100 - errors.length * 10 - Math.min(warnings.length * 2, 30));
console.log(`SEO 모의 감사: ${score}/100`);
console.log(`검사 페이지: ${htmlFiles.length}, 오류: ${errors.length}, 개선 권고: ${warnings.length}`);
if (errors.length) console.log('\n[오류]\n' + errors.map(x => '- ' + x).join('\n'));
if (warnings.length) console.log('\n[개선 권고]\n' + warnings.map(x => '- ' + x).join('\n'));
if (errors.length) process.exitCode = 1;
