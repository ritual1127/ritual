// NEIS Open API 프록시 공용 헬퍼. 프록시가 서버에서 인증키를 붙이므로 클라이언트엔 키가 없다.
const NEIS_BASE = 'https://meister-calendar-neis-proxy.smilepea.workers.dev';
const NEIS_TIMETABLE_PATH = { ELEMENTARY: 'elsTimetable', MIDDLE: 'misTimetable', HIGH: 'hisTimetable' };
const MEAL_LABELS = { '1': '조식', '2': '중식', '3': '석식' };

function loadNeisSchool() { return JSON.parse(localStorage.getItem('neisSchool') || 'null'); }
function saveNeisSchool(school) { localStorage.setItem('neisSchool', JSON.stringify(school)); }
function clearNeisSchool() { localStorage.removeItem('neisSchool'); }
function loadNeisClass() { return JSON.parse(localStorage.getItem('neisClass') || '{}'); }
function saveNeisClass(info) { localStorage.setItem('neisClass', JSON.stringify(info)); }

function neisSchoolKind(name) {
  if (name && name.includes('초등')) return 'ELEMENTARY';
  if (name && name.includes('중학')) return 'MIDDLE';
  return 'HIGH';
}

function neisYmd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function neisDateLabel(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

function defaultMealCode(now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= 17 * 60 + 20 || m < 7 * 60 + 20) return '1';
  if (m < 12 * 60 + 40) return '2';
  return '3';
}

async function searchNeisSchool(name) {
  const url = `${NEIS_BASE}/schoolInfo?Type=json&pIndex=1&pSize=30&SCHUL_NM=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.schoolInfo) return [];
  return json.schoolInfo[1].row.map(r => ({
    officeCode: r.ATPT_OFCDC_SC_CODE,
    officeName: r.ATPT_OFCDC_SC_NM,
    schoolCode: r.SD_SCHUL_CODE,
    schoolName: r.SCHUL_NM,
    kind: neisSchoolKind(r.SCHUL_KND_SC_NM)
  }));
}

async function fetchNeisMeal(school, dateYmd) {
  const url = `${NEIS_BASE}/mealServiceDietInfo?Type=json&pIndex=1&pSize=10` +
    `&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}&MLSV_YMD=${dateYmd}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.mealServiceDietInfo) return { slots: [] };
  const rows = json.mealServiceDietInfo[1].row;
  return {
    slots: rows.map(row => ({
      code: row.MMEAL_SC_CODE,
      label: MEAL_LABELS[row.MMEAL_SC_CODE] || row.MMEAL_SC_NM,
      items: row.DDISH_NM.split(/<br\s*\/?>/i)
        .map(s => s.replace(/\([\d.]+\)/g, '').replace(/-\s*$/, '').trim())
        .filter(Boolean)
    }))
  };
}

async function fetchNeisTimetable(school, dateYmd, grade, classNum, department) {
  const path = NEIS_TIMETABLE_PATH[school.kind] || 'hisTimetable';
  let url = `${NEIS_BASE}/${path}?Type=json&pIndex=1&pSize=100` +
    `&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}` +
    `&ALL_TI_YMD=${dateYmd}&GRADE=${grade}&CLASS_NM=${classNum}`;
  if (school.kind === 'HIGH' && department) url += `&DDDEP_NM=${encodeURIComponent(department)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json[path]) return { periods: [] };
  const rows = json[path][1].row;
  const byPeriod = {};
  rows.forEach(row => {
    if (school.kind === 'HIGH' && department && (row.DDDEP_NM || '').trim() !== department) return;
    const p = +row.PERIO;
    if (!byPeriod[p] && row.ITRT_CNTNT) byPeriod[p] = row.ITRT_CNTNT.trim();
  });
  const periods = Object.keys(byPeriod).map(Number).sort((a, b) => a - b).map(p => ({ period: p, subject: byPeriod[p] }));
  return { periods };
}

// date가 속한 주의 월요일을 반환
function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=일 ... 6=토
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// 월요일부터 5일(월~금) 시간표를 한 번의 API 호출로 가져와 날짜별로 그룹핑
async function fetchNeisWeekTimetable(school, mondayDate, grade, classNum, department) {
  const fridayDate = new Date(mondayDate);
  fridayDate.setDate(mondayDate.getDate() + 4);
  const path = NEIS_TIMETABLE_PATH[school.kind] || 'hisTimetable';
  let url = `${NEIS_BASE}/${path}?Type=json&pIndex=1&pSize=200` +
    `&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}` +
    `&TI_FROM_YMD=${neisYmd(mondayDate)}&TI_TO_YMD=${neisYmd(fridayDate)}` +
    `&GRADE=${grade}&CLASS_NM=${classNum}`;
  if (school.kind === 'HIGH' && department) url += `&DDDEP_NM=${encodeURIComponent(department)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json[path]) return {};
  const rows = json[path][1].row;
  const byDate = {};
  rows.forEach(row => {
    if (school.kind === 'HIGH' && department && (row.DDDEP_NM || '').trim() !== department) return;
    if (!row.ITRT_CNTNT) return;
    const ymd = row.ALL_TI_YMD;
    if (!byDate[ymd]) byDate[ymd] = {};
    const p = +row.PERIO;
    if (!byDate[ymd][p]) byDate[ymd][p] = row.ITRT_CNTNT.trim();
  });
  const result = {};
  Object.keys(byDate).forEach(ymd => {
    result[ymd] = Object.keys(byDate[ymd]).map(Number).sort((a, b) => a - b)
      .map(p => ({ period: p, subject: byDate[ymd][p] }));
  });
  return result;
}

// URL 쿼리(?o=&s=&n=&k=)로 전달된 학교 정보를 읽는다. 공유 링크로 바로 들어왔을 때 검색을 건너뛰기 위함.
function schoolFromQuery() {
  const p = new URLSearchParams(location.search);
  if (!p.get('o') || !p.get('s') || !p.get('n')) return null;
  return { officeCode: p.get('o'), schoolCode: p.get('s'), schoolName: p.get('n'), kind: p.get('k') || 'HIGH' };
}

// 현재 학교를 다른 사람에게 공유할 수 있는 링크로 만든다.
function schoolShareUrl(school) {
  const p = new URLSearchParams({ o: school.officeCode, s: school.schoolCode, n: school.schoolName, k: school.kind });
  return `${location.origin}${location.pathname}?${p.toString()}`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// 학교 검색/선택 UI를 컨테이너에 렌더링한다. 학교가 정해지면 onReady(school), 검색 화면이면 onReady(null)을 부른다.
// 외부(API·저장소) 값은 모두 textContent로만 넣는다.
function renderSchoolPicker(container, onReady) {
  const fromQuery = schoolFromQuery();
  if (fromQuery) saveNeisSchool(fromQuery);
  const school = fromQuery || loadNeisSchool();
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  if (school) {
    const card = el('div', 'school-card');
    const info = el('div', 'school-info');
    info.append(el('span', 'school-meta', '우리 학교'), el('strong', '', school.schoolName), el('span', 'school-meta', school.officeName || ''));
    const actions = el('div', 'school-actions');
    const share = el('button', 'btn-ghost btn-sm', '링크 공유');
    const change = el('button', 'btn-ghost btn-sm', '학교 변경');
    share.type = change.type = 'button';
    share.onclick = async () => {
      share.textContent = (await copyText(schoolShareUrl(school))) ? '복사됐어요' : '복사 실패';
      setTimeout(() => { share.textContent = '링크 공유'; }, 1500);
    };
    change.onclick = () => {
      clearNeisSchool();
      history.replaceState(null, '', location.pathname);
      renderSchoolPicker(container, onReady);
      container.querySelector('input')?.focus();
    };
    actions.append(share, change);
    card.append(info, actions);
    container.replaceChildren(card);
    onReady(school);
    return;
  }

  const title = el('h2', 'card-title', '학교를 먼저 찾아 주세요');
  const hint = el('p', 'card-sub', '한 번 고르면 이 기기에 저장돼서 다음부터 바로 보여요.');
  const form = el('form', 'school-search mt');
  form.setAttribute('role', 'search');
  const label = el('label', 'sr-only', '학교 이름');
  label.htmlFor = 'schoolSearchInput';
  const input = el('input', 'input');
  Object.assign(input, { id: 'schoolSearchInput', type: 'search', placeholder: '학교 이름 (예: 한국고)', autocomplete: 'off', enterKeyHint: 'search' });
  const submit = el('button', 'btn', '검색');
  submit.type = 'submit';
  const results = el('div', 'school-results');
  results.setAttribute('aria-live', 'polite');
  form.append(label, input, submit);
  container.replaceChildren(title, hint, form, results);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    results.replaceChildren(el('p', 'status', '검색 중…'));
    const found = await searchNeisSchool(name).catch(() => null);
    if (!found) { results.replaceChildren(el('p', 'status', '검색하지 못했어요. 잠시 후 다시 시도해 주세요.')); return; }
    if (!found.length) { results.replaceChildren(el('p', 'status', '검색 결과가 없어요. 학교 이름을 줄여서 검색해 보세요.')); return; }
    const list = el('ul', 'school-list');
    found.forEach(item => {
      const option = el('button', 'school-option');
      option.type = 'button';
      option.append(el('strong', '', item.schoolName), el('span', 'school-meta', item.officeName));
      option.onclick = () => { saveNeisSchool(item); renderSchoolPicker(container, onReady); };
      const li = el('li');
      li.append(option);
      list.append(li);
    });
    results.replaceChildren(list);
  });
  onReady(null);
}

// 급식 알림용 학교 정보 저장소. localStorage는 서비스워커에서 못 쓰므로
// 페이지와 서비스워커가 공유 가능한 IndexedDB를 쓴다.
function openNotifyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('seongjeokNotify', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('school');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNotifySchool(school) {
  const db = await openNotifyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('school', 'readwrite');
    tx.objectStore('school').put(school, 'current');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadNotifySchool() {
  const db = await openNotifyDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('school', 'readonly').objectStore('school').get('current');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function clearNotifySchool() {
  const db = await openNotifyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('school', 'readwrite');
    tx.objectStore('school').delete('current');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
