// 대학 학식: 대학 학식은 공용 API가 없어 학교마다 홈페이지 식단 페이지를 읽어 같은 모양으로 바꾼다.
// GET /campus-meal?u=snu&date=2026-10-27
//   → { u, name, date, link, places: [{ name, meals: [{ label: '중식', time, menus: [{ name, price, dishes }] }] }] }
// 학교 페이지는 Cloudflare 캐시에 1시간 두어 같은 페이지를 거듭 받지 않는다(학교 서버 부담 줄이기).
import { DAY, allowed, ipOf, json } from './lib.js';

const UA = 'Mozilla/5.0 (compatible; SeongjeokMeal/1.0; +https://naver1.cloud/todayfood/)';
const LABELS = ['조식', '중식', '석식'];

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// HTML 조각을 줄 목록으로: <br>과 문단·목록 끝을 줄바꿈으로 보고 태그를 지운다
export const lines = html => decode(String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, ''))
  .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const cells = (html, tag) => [...String(html || '').matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map(m => m[1]);
const won = s => `${s.replace(/[^\d,]/g, '')}원`;

// "갈비탕 : 6,000원"·"자율코너(5,500원)"·"일품[6,500원]"·"[일품:6,500원]"·"<셀프코너> 7,000원"·"<+세미뷔페>"·"(한식)"은 메뉴(묶음) 이름,
// 가격만 있는 줄("자율배식" 다음 "(5,500원)")은 바로 앞 줄을 그 가격의 메뉴 이름으로 올린다. 나머지 줄은 앞 메뉴의 반찬이고,
// 이름 붙은 줄보다 앞에 나온 반찬은 이름 없는 메뉴 하나로 묶는다. 이름 앞의 "<A코너>"는 "A코너 · "로
export function menusOf(list) {
  const menus = [];
  for (const line of list) {
    const last = menus[menus.length - 1];
    const alone = line.match(/^\(?([\d,]+)\s*원\)?$/);
    if (alone) {
      if (last && !last.dishes.length && !last.price) last.price = `${alone[1]}원`;
      else if (last && last.dishes.length) {
        menus.push({ name: last.dishes.pop(), price: `${alone[1]}원`, dishes: [] });
        if (!last.name && !last.dishes.length) menus.splice(menus.length - 2, 1);
      }
      continue;
    }
    const head = line.match(/^[<[](.+?)(?:\s*:\s*([\d,]+)\s*원)?[>\]]\s*(?:([\d,]+)\s*원)?$/) || line.match(/^(.+?)\s*(?::|\(|\[)\s*([\d,]+)\s*원[)\]]?$/) || line.match(/^\(([^()]+)\)$/);
    const price = head && (head[2] || head[3]);
    if (head) menus.push({ name: head[1].replace(/^<([^<>]+)>\s*/, '$1 · ').trim(), price: price ? `${price}원` : '', dishes: [] });
    else if (last) last.dishes.push(line);
    else menus.push({ name: '', price: '', dishes: [line] });
  }
  return menus;
}

// 서울대: 하루 한 장에 모든 식당이 줄로, 아침·점심·저녁이 칸으로.
// 이름이 *로 시작하는 곳은 날마다 같은 메뉴판(버거·분식 가게)이라 빼고, "<뷔페 특성상 …>" 같은 안내는 지운다
export function parseSnu(html) {
  const body = (html.match(/<table class="menu-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/) || [])[1];
  return cells(body, 'tr').map(row => {
    const name = (lines((row.match(/<td class="title">([\s\S]*?)<\/td>/) || [])[1])[0] || '').replace(/\s*\([\d-]+\)$/, '');
    const meals = ['breakfast', 'lunch', 'dinner'].map((cls, i) => {
      const list = lines((row.match(new RegExp(`<td class="${cls}">([\\s\\S]*?)</td>`)) || [])[1]).join('\n').replace(/<[^<>]*\s[^<>]*>/g, '').split('\n').filter(Boolean);
      const time = (list.find(s => s.startsWith('※ 운영시간')) || '').replace(/^※ 운영시간\s*:\s*/, '');
      const menus = menusOf(list.filter(s => !s.startsWith('※')).map(s => s.replace(/\(#\)/g, '').trim()));
      return { label: LABELS[i], time, menus };
    }).filter(meal => meal.menus.length);
    return { name, meals };
  }).filter(place => place.name && !place.name.startsWith('*') && place.meals.length);
}

// KAIST: 식당마다 한 장, 조식·중식·석식이 칸으로. 식당마다 적는 법이 조금씩 달라서
// 알레르기 번호("(5,6)"·"(1,5,6*)"·"어묵국5,6")·열량·안내 문구(*·★·●·-로 시작, " / "로 이은 줄)를 빼고, "고로케*케찹"의 *는 &로
export function parseKaist(html) {
  const table = (html.match(/<table class="table">([\s\S]*?)<\/table>/) || [])[1] || '';
  const heads = cells(table, 'th').map(th => lines(th)[0] || '');
  const tds = cells(table.split(/<tbody>/i)[1], 'td');
  return heads.map((head, i) => {
    const label = LABELS.find(l => head.startsWith(l));
    const list = lines(tds[i])
      .filter(s => !/^[*★●-]/.test(s) && !s.includes(' / ') && !/kcal|칼로리/i.test(s))
      .map(s => s.replace(/\s*\((\d+,\s*)*\d+\*?\)/g, '').replace(/\s*\d{1,2}(,\s*\d{1,2})*$/, '').replace(/\*/g, '&').trim()).filter(Boolean);
    return label && { label, time: head.slice(label.length).trim(), menus: menusOf(list) };
  }).filter(meal => meal && meal.menus.length);
}

// 부산대: 식당마다 한 주(월~토)가 한 장. 날짜 칸을 찾아 끼니 줄마다 그 칸만 읽는다
export function parsePnu(html, date) {
  const at = html.indexOf('<div class="date">');
  if (at < 0) return [];
  const table = html.slice(html.lastIndexOf('<table', at), html.indexOf('</table>', at));
  const col = [...table.matchAll(/<div class="date">\s*([\d.]+)\s*<\/div>/g)].map(m => m[1].replace(/\./g, '-')).indexOf(date);
  if (col < 0) return [];
  return cells(table.split(/<tbody>/i)[1], 'tr').map(row => {
    const head = lines((row.match(/<th[^>]*>([\s\S]*?)<\/th>/) || [])[1]);
    const label = LABELS.find(l => (head[0] || '').startsWith(l));
    const menus = cells(cells(row, 'td')[col], 'li').map(li => {
      const title = lines((li.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1])[0] || '';
      const priced = title.match(/^(.+?)\s*-\s*([\d,]+원)$/);
      return { name: priced ? priced[1] : title, price: priced ? priced[2] : '', dishes: lines((li.match(/<p>([\s\S]*?)<\/p>/) || [])[1]) };
    }).filter(menu => menu.name || menu.dishes.length);
    return label && { label, time: (head[1] || '').replace(/\s*-\s*/, '~'), menus };
  }).filter(meal => meal && meal.menus.length);
}

// 경북대: 식당마다 고른 날부터 6일이 한 장, 끼니마다 표가 따로. 메뉴(li)는 이름·(시간)·반찬·가격 순이고,
// 정식 식당은 이름 없이 반찬 칸에 "운영시간 11:15~13:30"까지 적어서 칸 머리("정식")를 이름으로 쓴다.
// 시간은 "(13:00~15:30)"이 줄바꿈으로 갈리거나 "17:00~1900"처럼 적힌 것도 있어 이름·반찬 전체에서 찾아 뺀다
const HOURS = /\(?\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}):?(\d{2})\s*\)?/g;
const withoutHours = text => text.replace(HOURS, '').split('\n').map(s => s.replace(/★|운영시간/g, '').trim()).filter(s => s && !/^[(),\s]+$/.test(s));
export function parseKnu(html, date) {
  const col = [...html.matchAll(/class="week_t">\s*\((\d{2}\/\d{2})\)/g)].map(m => m[1]).indexOf(date.slice(5).replace('-', '/'));
  if (col < 0) return [];
  const meals = [];
  for (const section of html.matchAll(/<p class="title">\s*(조식|중식|석식)\s*<\/p>\s*<table[\s\S]*?<\/table>/g)) {
    const menus = [];
    let time = '';
    for (const row of cells(section[0].split(/<tbody>/i)[1], 'tr')) {
      const td = cells(row, 'td')[col] || '';
      const kind = lines((td.match(/<div class="button_m[^"]*">([\s\S]*?)<\/div>/) || [])[1])[0] || '';
      for (const li of cells(td, 'li')) {
        const head = lines(li.split(/<p>/i)[0]).join('\n');
        const ps = cells(li, 'p');
        const body = lines(ps[0]).join('\n');
        const hours = [...`${head}\n${body}`.matchAll(HOURS)].map(m => `${m[1]}~${m[2]}:${m[3]}`).join(', ');
        if (hours && !time) time = hours;
        const name = withoutHours(head).join(', ') || kind;
        const cost = lines(ps[1])[0];
        menus.push({ name: hours && hours !== time ? `${name} (${hours})` : name, price: cost ? won(cost) : '', dishes: withoutHours(body) });
      }
    }
    if (menus.length) meals.push({ label: section[1], time, menus });
  }
  return meals;
}

async function page(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.text();
}

// 식당 여러 곳을 한꺼번에 받는다. 실패하거나 빈 식당은 빼고, 모두 실패하면 오류로 본다
async function each(list, load) {
  const results = await Promise.allSettled(list.map(load));
  if (results.every(r => r.status === 'rejected')) throw results[0].reason;
  return results.filter(r => r.status === 'fulfilled' && r.value.meals.length).map(r => r.value);
}

const KAIST = 'https://www.kaist.ac.kr/kr/html/campus/053001.html';
const PNU = 'https://www.pusan.ac.kr/kor/CMS/MenuMgr/menuListOnBuilding.do?mCode=MN202';
const KNU = 'https://coop.knu.ac.kr/sub03/sub01_01.html';

export const CAMPUSES = {
  snu: {
    name: '서울대학교',
    link: date => `https://snuco.snu.ac.kr/foodmenu/?date=${date}`,
    load: async date => parseSnu(await page(`https://snuco.snu.ac.kr/foodmenu/?date=${date}`))
  },
  kaist: {
    name: 'KAIST',
    link: date => `${KAIST}?dvs_cd=fclt&stt_dt=${date}`,
    load: date => each([['fclt', '카이마루(북측 카페테리아)'], ['west', '서맛골(서측식당)'], ['east1', '동맛골(동측 학생식당)'], ['east2', '동맛골(동측 교직원식당)'], ['emp', '교수회관'], ['hawam', '화암 기숙사식당']],
      async ([code, name]) => ({ name, meals: parseKaist(await page(`${KAIST}?dvs_cd=${code}&stt_dt=${date}`)) }))
  },
  pnu: {
    name: '부산대학교',
    link: () => PNU,
    load: date => each([['R001', 'PG002', '금정회관 학생 식당'], ['R004', 'PH002', '학생회관 학생 식당'], ['R001', 'PG001', '금정회관 교직원 식당']],
      async ([building, code, name]) => ({ name, meals: parsePnu(await page(`${PNU}&campus_gb=PUSAN&building_gb=${building}&restaurant_code=${code}&menu_date=${date}`), date) }))
  },
  knu: {
    name: '경북대학교',
    link: () => KNU,
    load: date => each([[35, '정보센터식당'], [37, '카페테리아 첨성'], [86, '공학관 학생식당'], [46, 'GP감꽃식당'], [36, '복지관 교직원식당'], [85, '공학관 교직원식당']],
      async ([shop, name]) => ({ name, meals: parseKnu(await page(`${KNU}?shop_sqno=${shop}&selDate=${date}`), date) }))
  }
};

export async function handleCampusMeal(request, env, url) {
  const id = url.searchParams.get('u') || '';
  const date = url.searchParams.get('date') || '';
  const campus = Object.hasOwn(CAMPUSES, id) ? CAMPUSES[id] : null;
  // 날짜는 오늘 앞뒤 40일 안에서만(아무 날짜나 학교 페이지를 받아 오지 않게)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && Math.abs(Date.parse(`${date}T12:00:00+09:00`) - Date.now()) < 40 * DAY;
  if (!campus || !valid) return json({ error: '학교나 날짜가 올바르지 않아요.' }, 400);
  if (!(await allowed(env.TRACK_RL, `campus:${ipOf(request)}`))) return json({ error: '잠시 후 다시 시도해 주세요.' }, 429);
  let places;
  try {
    places = await campus.load(date);
  } catch (error) {
    console.error('campus', id, error?.message);
    return json({ error: '학교 홈페이지에서 학식을 불러오지 못했어요.', link: campus.link(date) }, 502);
  }
  return new Response(JSON.stringify({ u: id, name: campus.name, date, link: campus.link(date), places }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' }
  });
}
