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

// 학교 검색/선택 UI를 컨테이너에 렌더링. 선택된 학교가 있으면 onReady(school)를 호출.
function renderSchoolPicker(container, onReady) {
  const fromQuery = schoolFromQuery();
  if (fromQuery) saveNeisSchool(fromQuery);
  const school = fromQuery || loadNeisSchool();
  if (school) {
    container.innerHTML = `
      <div class="school-current">
        <div><strong>${school.schoolName}</strong><div class="meta">${school.officeName || ''}</div></div>
        <div class="school-actions">
          <button type="button" class="mini-btn" id="shareSchoolBtn">링크 공유</button>
          <button type="button" class="mini-btn" id="changeSchoolBtn">학교 변경</button>
        </div>
      </div>`;
    document.getElementById('changeSchoolBtn').onclick = () => {
      clearNeisSchool();
      history.replaceState(null, '', location.pathname);
      renderSchoolPicker(container, onReady);
    };
    document.getElementById('shareSchoolBtn').onclick = async (e) => {
      const ok = await copyText(schoolShareUrl(school));
      const btn = e.currentTarget;
      btn.textContent = ok ? '복사됨!' : '복사 실패';
      setTimeout(() => { btn.textContent = '링크 공유'; }, 1500);
    };
    onReady(school);
    return;
  }

  container.innerHTML = `
    <div class="entry" style="grid-template-columns:1fr;">
      <div class="score-row">
        <input type="text" id="schoolSearchInput" placeholder="학교 이름 검색 (예: OO고등학교)">
        <button type="button" class="btn-outline" id="schoolSearchBtn">검색</button>
      </div>
    </div>
    <div id="schoolSearchResults"></div>`;

  const doSearch = async () => {
    const name = document.getElementById('schoolSearchInput').value.trim();
    if (!name) return;
    const box = document.getElementById('schoolSearchResults');
    box.innerHTML = '<div class="empty-hint">검색 중...</div>';
    const results = await searchNeisSchool(name).catch(() => []);
    if (!results.length) { box.innerHTML = '<div class="empty-hint">검색 결과가 없습니다.</div>'; return; }
    box.innerHTML = results.map((s, i) => `
      <div class="subj-list-item" data-i="${i}">
        <div><strong>${s.schoolName}</strong><div class="meta">${s.officeName}</div></div>
      </div>`).join('');
    box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
      saveNeisSchool(results[+el.dataset.i]);
      renderSchoolPicker(container, onReady);
    });
  };
  document.getElementById('schoolSearchBtn').onclick = doSearch;
  document.getElementById('schoolSearchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });
}
