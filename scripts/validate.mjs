import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const files=[];
function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){if(['.git','dist','node_modules','feedback-api','admin'].includes(x.name))continue;const p=path.join(d,x.name);if(x.isDirectory())walk(p);else if(x.name==='index.html')files.push(p)}}walk(root);
const titles=new Map(),h1s=new Map(),errors=[];
for(const f of files){const s=fs.readFileSync(f,'utf8'),rel=path.relative(root,f);const title=s.match(/<title>([^<]+)<\/title>/i)?.[1],h1=s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g,'').trim();if(!title)errors.push(`${rel}: title 없음`);if(!h1)errors.push(`${rel}: H1 없음`);if(title){if(titles.has(title))errors.push(`${rel}: title 중복 (${titles.get(title)})`);titles.set(title,rel)}if(!/rel="canonical"/i.test(s))errors.push(`${rel}: canonical 없음`);if(!/property="og:url"/i.test(s))errors.push(`${rel}: og:url 없음`);for(const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)){try{JSON.parse(m[1])}catch{errors.push(`${rel}: JSON-LD 오류`)}}}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');for(const f of files.filter(x=>!/today|guide|privacy/.test(x))){const rel=path.relative(root,f).replace(/\\/g,'/').replace(/index\.html$/,'');const url='https://naver1.cloud/'+rel;if(!sitemap.includes(url))errors.push(`${rel}: sitemap 누락`)}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`${files.length}개 HTML 메타데이터와 JSON-LD 검증 통과`);
