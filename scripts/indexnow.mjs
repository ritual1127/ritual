// IndexNow로 새 주소·바뀐 주소를 검색엔진(Bing·네이버 등)에 알린다. 구글은 받지 않으므로 Search Console에서 따로 요청한다.
// 쓰는 법(배포 뒤): node scripts/indexnow.mjs https://naver1.cloud/suneung/ https://naver1.cloud/faq/
const HOST = 'naver1.cloud';
const KEY = '52743e41e90c2b752c774fd611d11040';
const urlList = process.argv.slice(2);
if (!urlList.length) { console.error('알릴 주소를 인자로 넘겨 주세요.'); process.exit(1); }
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList })
});
console.log(`IndexNow ${response.status} ${response.statusText} · 주소 ${urlList.length}개`);
if (!response.ok) { console.error(await response.text()); process.exit(1); } // 200·202가 성공
