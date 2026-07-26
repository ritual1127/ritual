# 주간 시간표 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `todayclass/` 페이지에 "일간/주간" 토글을 추가해, 월~금 5일치 시간표를 한 번의 NEIS API 호출로 받아 그리드로 보여준다.

**Architecture:** `neis-common.js`에 날짜-범위 조회 함수를 추가하고, `todayclass/index.html`의 기존 일간 렌더링 로직 옆에 주간 렌더링 로직을 추가한다. 새 백엔드/빌드 도구 없음 — 기존 정적 HTML/JS + NEIS 프록시 패턴 그대로 확장.

**Tech Stack:** Vanilla JS, `neis-common.js` 공용 헬퍼, NEIS Open API (`meister-calendar-neis-proxy.smilepea.workers.dev` 프록시), `localStorage`.

## Global Constraints

- 빌드 도구 없음 — 순수 HTML/CSS/JS, `<script src>`로만 로드.
- NEIS 프록시 엔드포인트는 `NEIS_BASE = 'https://meister-calendar-neis-proxy.smilepea.workers.dev'` (변경 금지, `neis-common.js` 상단 상수).
- 자동화 테스트 프레임워크 없음 — 모든 검증은 브라우저 수동 확인.
- 주간 범위는 월~금만 (스펙에서 확정, 주말 제외).
- 기존 일간 모드 동작/UI는 그대로 유지 (회귀 금지).

---

### Task 1: `neis-common.js`에 주간 조회 함수 추가

**Files:**
- Modify: `neis-common.js` (파일 하단, 기존 `fetchNeisTimetable` 함수 바로 아래에 추가)

**Interfaces:**
- Consumes: 기존 `NEIS_BASE`, `NEIS_TIMETABLE_PATH`, `neisYmd(date)` (이미 파일에 존재)
- Produces:
  - `mondayOf(date)` → 해당 날짜가 속한 주의 월요일 `Date` 객체
  - `fetchNeisWeekTimetable(school, mondayDate, grade, classNum, department)` → `Promise<{ [ymd: string]: { period: number, subject: string }[] }>` (해당 요일에 데이터 없으면 키 자체가 없음 — 호출부에서 `byDate[ymd] || []`로 처리)

- [ ] **Step 1: `neis-common.js` 맨 아래(마지막 `}` 다음)에 두 함수를 추가**

```javascript
// date가 속한 주의 월요일을 반환 (일요일이면 전주 월요일 취급하지 않고 다음날 기준 계산)
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
```

- [ ] **Step 2: 브라우저 콘솔로 수동 확인**

`todayclass/index.html`을 로컬 정적 서버(예: `npx serve .` 또는 `python -m http.server`)로 열고, 학교 검색 후 개발자 콘솔에서 직접 호출:

```javascript
fetchNeisWeekTimetable(currentSchool, mondayOf(new Date()), 1, 1, '').then(console.log)
```

기대 결과: `{ "20260727": [{period:1, subject:"..."}], "20260728": [...], ... }` 형태로 날짜별 키가 찍혀야 한다. (여름방학 중이면 빈 객체 `{}`가 나올 수 있음 — 그 자체는 정상. 개학 중 학교로 재확인.)

- [ ] **Step 3: 커밋**

```bash
git add neis-common.js
git commit -m "feat: NEIS 주간 시간표 조회 함수 추가"
```

---

### Task 2: 주간 뷰 CSS 추가

**Files:**
- Modify: `styles.css` (기존 `.meal-tabs` 규칙 근처, `.period-list` 규칙 다음에 추가)

**Interfaces:**
- Consumes: 기존 CSS 변수 `--inp-border`, `--inp-bg`, `--fg`, `--primary`, `--muted`
- Produces: CSS 클래스 `.mode-tabs`, `.week-grid`, `.week-day`, `.week-day-head`, `.week-period-list` (Task 3에서 HTML에 사용)

- [ ] **Step 1: `styles.css`의 `.meal-tabs button.active { ... }` 규칙 바로 다음 줄에 추가**

```css
.meal-tabs, .mode-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.mode-tabs button {
  flex: 1; height: 38px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--inp-border); background: var(--inp-bg); color: var(--fg);
  font-size: 14px; font-weight: 600;
}
.mode-tabs button.active { background: var(--primary); color: #fff; border-color: var(--primary); }

.week-grid {
  display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
}
.week-day { flex: 0 0 130px; }
.week-day-head {
  font-size: 13px; font-weight: 700; text-align: center;
  padding: 6px 0; margin-bottom: 8px; border-radius: 8px;
  background: var(--inp-bg); color: var(--fg);
}
.week-day-head.today { background: var(--primary); color: #fff; }
.week-period-list { list-style: none; }
.week-period-list li {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 4px; font-size: 13px; border-bottom: 1px solid var(--inp-border);
}
.week-period-list li:last-child { border-bottom: none; }
.week-period-list .period-no {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  background: var(--primary); color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
```

주의: `.meal-tabs, .mode-tabs { ... }` 처럼 선택자에 `.meal-tabs`를 다시 쓰는 이유는 기존 `.meal-tabs` 단독 규칙과 겹치는 공용 스타일을 한 곳에 합치기 위함 — 기존 `.meal-tabs { display: flex; gap: 8px; margin-bottom: 16px; }` 줄은 삭제하지 말고 그 값과 동일하게 맞춰서 새 규칙이 덮어써도 시각적으로 차이가 없게 한다. (기존 줄을 지워도 되지만, 최소 diff를 위해 그대로 둬도 무방 — 어차피 동일한 값이라 순서상 나중 규칙이 이겨도 결과는 같음)

- [ ] **Step 2: 브라우저에서 확인**

아직 HTML에서 이 클래스들을 안 썼으니 시각적으로 확인할 건 없음 — `styles.css` 문법 오류만 없으면 됨. 브라우저에서 `todayfood/index.html`(기존 `.meal-tabs` 사용 페이지)을 열어 급식 탭 토글이 여전히 정상 동작하는지만 확인 (회귀 체크).

- [ ] **Step 3: 커밋**

```bash
git add styles.css
git commit -m "feat: 주간 시간표용 그리드/토글 CSS 추가"
```

---

### Task 3: `todayclass/index.html`에 주간 뷰 UI/로직 연결

**Files:**
- Modify: `todayclass/index.html`

**Interfaces:**
- Consumes: `fetchNeisWeekTimetable`, `mondayOf` (Task 1), `.mode-tabs`/`.week-grid`/`.week-day`/`.week-day-head`/`.week-period-list` (Task 2), 기존 `currentSchool`, `currentDate`, `neisYmd`, `saveNeisClass`, `loadNeisClass`
- Produces: 없음 (최종 페이지)

- [ ] **Step 1: `<div class="date-nav">` 위에 모드 토글 버튼 추가**

`todayclass/index.html`의 42번째 줄 근처, `<div class="date-nav">` 바로 위에 삽입:

```html
<div class="mode-tabs">
  <button type="button" id="dayModeBtn" class="active">일간</button>
  <button type="button" id="weekModeBtn">주간</button>
</div>
```

- [ ] **Step 2: `<div class="date-nav">` 블록을 주간 네비게이션도 포함하도록 교체**

기존:
```html
<div class="date-nav">
  <button type="button" class="btn-outline" id="prevDayBtn">◀</button>
  <span class="date-label" id="dateLabel"></span>
  <button type="button" class="btn-outline" id="nextDayBtn">▶</button>
</div>
<div id="periodList"><div class="empty-hint">학교와 학년·반을 입력하면 시간표가 표시돼요.</div></div>
```

교체 후:
```html
<div class="date-nav" id="dayNav">
  <button type="button" class="btn-outline" id="prevDayBtn">◀</button>
  <span class="date-label" id="dateLabel"></span>
  <button type="button" class="btn-outline" id="nextDayBtn">▶</button>
</div>
<div class="date-nav" id="weekNav" style="display:none;">
  <button type="button" class="btn-outline" id="prevWeekBtn">◀</button>
  <span class="date-label" id="weekLabel"></span>
  <button type="button" class="btn-outline" id="nextWeekBtn">▶</button>
</div>
<div id="periodList"><div class="empty-hint">학교와 학년·반을 입력하면 시간표가 표시돼요.</div></div>
<div id="weekGrid" class="week-grid" style="display:none;"></div>
```

- [ ] **Step 3: `<script>` 블록의 상태 변수 아래에 모드 상태와 헬퍼 추가**

기존:
```javascript
let currentDate = new Date();
let currentSchool = null;
```

교체 후:
```javascript
let currentDate = new Date();
let currentSchool = null;
let viewMode = localStorage.getItem('neisTimetableMode') || 'day';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('neisTimetableMode', mode);
  document.getElementById('dayModeBtn').classList.toggle('active', mode === 'day');
  document.getElementById('weekModeBtn').classList.toggle('active', mode === 'week');
  document.getElementById('dayNav').style.display = mode === 'day' ? 'flex' : 'none';
  document.getElementById('weekNav').style.display = mode === 'week' ? 'flex' : 'none';
  document.getElementById('periodList').style.display = mode === 'day' ? 'block' : 'none';
  document.getElementById('weekGrid').style.display = mode === 'week' ? 'flex' : 'none';
  if (currentSchool) renderTimetable();
}
```

- [ ] **Step 4: `renderPeriodList` 함수 아래에 주간 렌더 함수 추가**

기존 `renderPeriodList` 함수 바로 다음에 추가:

```javascript
function renderWeekGrid(byDate, mondayDate) {
  const el = document.getElementById('weekGrid');
  const todayYmd = neisYmd(new Date());
  el.innerHTML = WEEKDAY_LABELS.map((label, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    const ymd = neisYmd(d);
    const periods = byDate[ymd] || [];
    const isToday = ymd === todayYmd;
    const body = periods.length
      ? `<ul class="week-period-list">${periods.map(p => `<li><span class="period-no">${p.period}</span>${p.subject}</li>`).join('')}</ul>`
      : '<div class="empty-hint">정보 없음</div>';
    return `<div class="week-day">
      <div class="week-day-head${isToday ? ' today' : ''}">${label} ${d.getMonth() + 1}/${d.getDate()}</div>
      ${body}
    </div>`;
  }).join('');
}
```

- [ ] **Step 5: `renderTimetable` 함수를 모드 분기하도록 교체**

기존:
```javascript
async function renderTimetable() {
  if (!currentSchool) return;
  document.getElementById('dateLabel').textContent = neisDateLabel(currentDate);
  document.getElementById('periodList').innerHTML = '<div class="empty-hint">불러오는 중...</div>';

  const grade = +document.getElementById('gradeInput').value || 1;
  const classNum = +document.getElementById('classInput').value || 1;
  const department = document.getElementById('deptInput').value.trim();
  saveNeisClass({ grade, classNum, department });

  const { periods } = await fetchNeisTimetable(currentSchool, neisYmd(currentDate), grade, classNum, department).catch(() => ({ periods: [] }));
  renderPeriodList(periods);
}
```

교체 후:
```javascript
async function renderTimetable() {
  if (!currentSchool) return;
  const grade = +document.getElementById('gradeInput').value || 1;
  const classNum = +document.getElementById('classInput').value || 1;
  const department = document.getElementById('deptInput').value.trim();
  saveNeisClass({ grade, classNum, department });

  if (viewMode === 'week') {
    const monday = mondayOf(currentDate);
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    document.getElementById('weekLabel').textContent =
      `${monday.getMonth() + 1}/${monday.getDate()} ~ ${friday.getMonth() + 1}/${friday.getDate()}`;
    document.getElementById('weekGrid').innerHTML = '<div class="empty-hint">불러오는 중...</div>';
    const byDate = await fetchNeisWeekTimetable(currentSchool, monday, grade, classNum, department).catch(() => ({}));
    renderWeekGrid(byDate, monday);
    return;
  }

  document.getElementById('dateLabel').textContent = neisDateLabel(currentDate);
  document.getElementById('periodList').innerHTML = '<div class="empty-hint">불러오는 중...</div>';
  const { periods } = await fetchNeisTimetable(currentSchool, neisYmd(currentDate), grade, classNum, department).catch(() => ({ periods: [] }));
  renderPeriodList(periods);
}
```

- [ ] **Step 6: 이벤트 바인딩부에 모드 토글 버튼과 주간 네비게이션 버튼 추가**

기존:
```javascript
document.getElementById('applyClassBtn').onclick = renderTimetable;
document.getElementById('prevDayBtn').onclick = () => { currentDate.setDate(currentDate.getDate() - 1); renderTimetable(); };
document.getElementById('nextDayBtn').onclick = () => { currentDate.setDate(currentDate.getDate() + 1); renderTimetable(); };
```

교체 후:
```javascript
document.getElementById('applyClassBtn').onclick = renderTimetable;
document.getElementById('prevDayBtn').onclick = () => { currentDate.setDate(currentDate.getDate() - 1); renderTimetable(); };
document.getElementById('nextDayBtn').onclick = () => { currentDate.setDate(currentDate.getDate() + 1); renderTimetable(); };
document.getElementById('prevWeekBtn').onclick = () => { currentDate.setDate(currentDate.getDate() - 7); renderTimetable(); };
document.getElementById('nextWeekBtn').onclick = () => { currentDate.setDate(currentDate.getDate() + 7); renderTimetable(); };
document.getElementById('dayModeBtn').onclick = () => setViewMode('day');
document.getElementById('weekModeBtn').onclick = () => setViewMode('week');
```

- [ ] **Step 7: `renderSchoolPicker` 콜백 마지막 줄(`renderTimetable();`) 바로 위에 모드 초기 적용 추가**

기존 콜백 끝부분:
```javascript
    document.getElementById('deptInput').value = saved.department || '';
    renderTimetable();
  });
```

교체 후:
```javascript
    document.getElementById('deptInput').value = saved.department || '';
    setViewMode(viewMode);
  });
```

(`setViewMode`가 내부에서 `currentSchool`이 세팅된 뒤 `renderTimetable()`을 호출하므로 별도 호출 불필요)

- [ ] **Step 8: 브라우저 수동 확인**

로컬 정적 서버로 `todayclass/index.html`을 열고:
1. 실제 학교 검색 → 학년/반 입력 → "주간" 버튼 클릭 → 월~금 5개 컬럼이 나타나는지
2. "◀"/"▶"로 이전 주/다음 주 이동 시 주차 라벨과 데이터가 바뀌는지
3. 데이터 없는 요일(공휴일 등)이 "정보 없음"으로만 표시되고 나머지 요일은 정상인지
4. "일간" 버튼으로 되돌아갔을 때 기존 하루 보기가 그대로 동작하는지
5. 새로고침 후에도 마지막 모드(주간/일간)가 유지되는지
6. 오늘 날짜 컬럼에 강조 스타일(`.today`)이 적용되는지

- [ ] **Step 9: 커밋**

```bash
git add todayclass/index.html
git commit -m "feat: 오늘의 시간표에 주간 보기 추가"
```

---

## Self-Review

**스펙 커버리지:**
- 일간/주간 토글 유지 → Task 3 Step 1
- 주간 = 월~금 → Task 1 (`mondayDate` + 4일), Task 3 `WEEKDAY_LABELS`
- 마지막 모드 localStorage 저장 → Task 3 `setViewMode`
- 데이터 없는 요일만 "정보 없음" → Task 3 `renderWeekGrid`
- API 실패 시 빈 처리 → Task 3 `.catch(() => ({}))`
- 초/중/고 엔드포인트 분기 → Task 1 `NEIS_TIMETABLE_PATH` 재사용
- 수동 테스트 체크리스트 → Task 3 Step 8 (스펙의 체크리스트 5개 항목 모두 포함 + today 강조 확인 추가)

**타입/시그니처 일관성:** `fetchNeisWeekTimetable`의 반환 타입(`{ymd: periods[]}`)과 `renderWeekGrid(byDate, mondayDate)`의 파라미터 이름이 Task별로 동일하게 사용됨. `mondayOf(date)`가 Task 1에서 정의되고 Task 3에서 그대로 호출됨. 확인 완료.

**범위 밖 항목:** 스펙의 "주말 표시 제외", "월간 뷰"는 이 플랜에 포함하지 않음 — 의도된 범위 밖.
