import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'server'), { recursive: true });
fs.mkdirSync(path.join(dist, 'static'), { recursive: true });
const skip = new Set(['.git','dist','feedback-api','docs','scripts','node_modules','.openai']);
function copy(dir, out) {
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    if (skip.has(item.name) || item.name === 'build-seo-content.mjs' || item.name === 'og-source.png' || item.name === 'package.json') continue;
    const src=path.join(dir,item.name), dst=path.join(out,item.name);
    if(item.isDirectory()){fs.mkdirSync(dst,{recursive:true});copy(src,dst);} else fs.copyFileSync(src,dst);
  }
}
copy(root,path.join(dist,'static'));
fs.writeFileSync(path.join(dist,'server','index.js'),`export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };\n`);
fs.mkdirSync(path.join(dist,'.openai'),{recursive:true});
fs.copyFileSync(path.join(root,'.openai','hosting.json'),path.join(dist,'.openai','hosting.json'));
