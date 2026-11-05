# 수능 최저 계산기 · 시즌 안내 한 줄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/suneung/` 수능 최저 계산기(+D-day·시간표)와 모든 도구 페이지의 "시즌 안내 한 줄"을 만들고, 수능 키워드 SEO를 갖춰 배포한다.

**Architecture:** 정적 사이트(GitHub Pages) 그대로. 순수 계산은 `calc-core.js`(최저·절대평가 등급), 날짜 판단은 새 `season.js`(수능 날짜표·연간 시즌표·D-day·시험 당일 교시)에 두고 둘 다 Node `vm`으로 `scripts/test-calc.mjs`에서 검증한다. 화면은 기존 도구 페이지 골격과 `styles.css` 토큰을 쓴다.

**Tech Stack:** HTML/CSS/바닐라 JS, Node 24(테스트·생성 스크립트), 헤드리스 Chrome CDP(화면 검증), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-05-suneung-season-design.md`

## Global Constraints
- 수능 날짜표: `[['2026-11-19','2026-12-11',2027], ['2027-11-18','2027-12-10',2028]]` (시험일, 성적 통지일, 학년도).
- 2027 시간표: 입실 08:10 / 1교시 국어 08:40~10:00 / 2교시 수학 10:30~12:10 / 점심 12:10~13:00 / 3교시 영어 13:10~14:20 / 4교시 한국사·탐구 14:50~16:37 / 5교시 제2외국어·한문 17:05~17:45.
- 이의신청 11-19~11-23(월), 정답 확정 12-01(화) 17시, 성적 통지 12-11(금).
- 영어 등급 하한 `[90,80,70,60,50,40,30,20]`, 한국사 `[40,35,30,25,20,15,10,5]`, 그 아래 9등급.
- 디자인: 한 가지 파란 강조, 초록·빨강은 상태에만, 페이지 위 줄은 단색, 입력칸은 테두리 있는 상자, 휴대폰 좌우 스크롤 없음, 설명 글은 짧게.
- 공용 파일 버전 쿼리는 모두 `?v=20261105a`. `app-sw.js` CACHE는 `app-20261105`. assistant.js `V`는 `20261105a`.
- 문장은 다른 페이지처럼 "~해요"체. 결과는 참고용임을 본문에 밝힌다.
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. 반영 영역을 끄거나 개수를 키워서 개수 > 켠 영역 수, 또는 필수 영역이 꺼진 상태 → 화면은 범위를 당기고, 함수는 invalid/필수 무시로 깨지지 않는다. (Task 1 테스트 `invalid`, `must ignored`)
2. 탐구 "2과목 평균"인데 한 과목만 입력 → 한 과목으로 몰래 계산하지 않고 입력 부족(`inq`)을 알린다. (Task 1)
3. 소수 합(평균 2.5 + 2 + 1 = 5.5)과 기준 비교가 정확하다(5.5 ≤ 6 충족, 6.5 > 6 미충족 차이 0.5). (Task 1)
4. 날짜 경계: D-30 시작일, 수능+4일 끝, 통지+3일 끝, 다음 수능이 표에 없을 때 줄 숨김. (Task 2 테스트)
5. 영어 120점·한국사 60점 같은 범위 밖 원점수 → 등급을 바꾸지 않고 칸을 오류로 표시(사이트 공용 blur 보정과 충돌 없이). (Task 3 화면 검증)

---

### Task 1: 최저·절대평가 계산 함수

**Files:**
- Modify: `calc-core.js` (끝에 추가)
- Test: `scripts/test-calc.mjs` (수능 절 추가, vm 노출 목록에 두 함수 추가)

**Interfaces:**
- Produces:
  - `absGrade(subject: 'english'|'history', score: number|null) -> number|null` — 범위(영어 0~100, 한국사 0~50) 밖이거나 숫자가 아니면 null.
  - `suneungMinimum(grades, rule) -> result`
    - `grades = { kor, math, eng, hist, inq1, inq2 }` 각 1~9 또는 null.
    - `rule = { areas: Array<'kor'|'math'|'eng'|'inq'>, count: number, mode: 'sum'|'each', limit: number, inq: 'best'|'avg'|'avgFloor', must: ''|'kor'|'math'|'eng'|'inq', hist: number }` (hist 0 = 조건 없음).
    - 반환: `{ status: 'invalid' }` | `{ status: 'pending', missing: string[], need, have }` (missing 항목: `'inq'` 평균인데 한 과목뿐, `'must'` 필수 영역 등급 없음, `'count'` 후보 부족, `'hist'` 한국사 조건인데 등급 없음) | `{ status: 'met'|'unmet', picked: [{ area, grade }], sum, within, gap, histOk, inqValue }`.
    - picked 순서: 필수 영역 먼저, 그다음 등급 오름차순, 같으면 kor→math→eng→inq 순.
    - sum = picked 등급 합(roundFloat). within = picked 중 limit 이하 개수. gap = sum 모드 `max(0, sum − limit)`, each 모드 `count − within`. histOk = 조건 없으면 null.
    - met = (sum 모드 sum ≤ limit | each 모드 within === count) && histOk !== false.

- [ ] **Step 1: 실패하는 테스트 작성** — `scripts/test-calc.mjs`의 vm 노출 목록에 `absGrade, suneungMinimum` 추가 후 아래 절을 `console.log` 앞에 넣는다.

```js
// 수능
assert.equal(c.absGrade('english', 100), 1); assert.equal(c.absGrade('english', 90), 1); assert.equal(c.absGrade('english', 89), 2);
assert.equal(c.absGrade('english', 20), 8); assert.equal(c.absGrade('english', 19), 9); assert.equal(c.absGrade('english', 0), 9);
assert.equal(c.absGrade('english', 101), null); assert.equal(c.absGrade('english', null), null);
assert.equal(c.absGrade('history', 50), 1); assert.equal(c.absGrade('history', 40), 1); assert.equal(c.absGrade('history', 39), 2);
assert.equal(c.absGrade('history', 5), 8); assert.equal(c.absGrade('history', 4), 9); assert.equal(c.absGrade('history', 51), null);
const G = o => ({ kor: null, math: null, eng: null, hist: null, inq1: null, inq2: null, ...o });
const R = o => ({ areas: ['kor', 'math', 'eng', 'inq'], count: 3, mode: 'sum', limit: 6, inq: 'best', must: '', hist: 0, ...o });
const m = (g, r) => plain(c.suneungMinimum(G(g), R(r)));
let r = m({ kor: 2, math: 4, eng: 2, inq1: 1, inq2: 3 });
assert.equal(r.status, 'met'); assert.equal(r.sum, 5); assert.deepEqual(r.picked.map(p => p.area), ['inq', 'kor', 'eng']);
r = m({ kor: 3, math: 4, eng: 3, inq1: 3 }); assert.equal(r.status, 'unmet'); assert.equal(r.gap, 3);
r = m({ kor: 2, eng: 2, inq1: 2, inq2: 3 }, { inq: 'avgFloor' }); assert.equal(r.status, 'met'); assert.equal(r.sum, 6); assert.equal(r.inqValue, 2);
r = m({ kor: 2, eng: 2, inq1: 2, inq2: 3 }, { inq: 'avg' }); assert.equal(r.status, 'unmet'); assert.equal(r.sum, 6.5); assert.equal(r.gap, 0.5);
r = m({ kor: 2, eng: 1, inq1: 2, inq2: 3 }, { inq: 'avg' }); assert.equal(r.sum, 5.5); assert.equal(r.status, 'met');
r = m({ kor: 1, math: 2, eng: 2, inq1: 1 }, { inq: 'avg' }); assert.equal(r.status, 'met'); // 탐구 평균 불가여도 다른 3개로 충족
r = m({ kor: 1, eng: 2, inq1: 1 }, { inq: 'avg' }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('inq'));
r = m({ kor: 1, math: 3, eng: 1, inq1: 1 }, { count: 2, limit: 4, must: 'math' }); assert.equal(r.status, 'met'); assert.deepEqual(r.picked.map(p => p.area), ['math', 'kor']);
r = m({ kor: 1, math: 3, eng: 1, inq1: 1 }, { count: 2, limit: 3, must: 'math' }); assert.equal(r.status, 'unmet'); assert.equal(r.gap, 1);
r = m({ kor: 1, eng: 1, inq1: 1 }, { count: 2, must: 'math' }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('must'));
r = m({ kor: 1, eng: 1 }, { areas: ['kor', 'eng'], count: 2, limit: 2, must: 'math' }); assert.equal(r.status, 'met'); // must ignored: 꺼진 영역
r = m({ kor: 1, math: 3, eng: 2, inq1: 2 }, { mode: 'each', limit: 2 }); assert.equal(r.status, 'met'); assert.equal(r.within, 3);
r = m({ kor: 1, math: 3, eng: 3, inq1: 2 }, { mode: 'each', limit: 2 }); assert.equal(r.status, 'unmet'); assert.equal(r.within, 2); assert.equal(r.gap, 1);
r = m({ kor: 1, math: 1, eng: 1, inq1: 1, hist: 5 }, { hist: 4 }); assert.equal(r.status, 'unmet'); assert.equal(r.histOk, false);
r = m({ kor: 1, math: 1, eng: 1, inq1: 1 }, { hist: 4 }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('hist'));
r = m({ kor: 1, math: 1, eng: 1, inq1: 1, hist: 4 }, { hist: 4 }); assert.equal(r.status, 'met'); assert.equal(r.histOk, true);
r = m({ kor: 2, eng: 2 }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('count')); assert.equal(r.need, 3); assert.equal(r.have, 2);
r = m({ kor: 1, math: 1, eng: 1 }, { areas: ['kor', 'math'], count: 3 }); assert.equal(r.status, 'invalid');
r = m({ kor: 1, math: 9, eng: 1, inq1: 1 }, { areas: ['kor', 'math', 'inq'], count: 2, limit: 2 }); assert.equal(r.status, 'met'); assert.deepEqual(r.picked.map(p => p.area), ['kor', 'inq']);
```

- [ ] **Step 2: 실패 확인** — Run: `node scripts/test-calc.mjs` / Expected: `absGrade is not defined`로 실패.
- [ ] **Step 3: `calc-core.js`에 구현** — `SUNEUNG_ABS = { english: [90,80,70,60,50,40,30,20,100], history: [40,35,30,25,20,15,10,5,50] }`(마지막 값은 만점)처럼 표 하나로 두고, `suneungMinimum`은 ① 탐구 값 계산 ② 후보 목록(켠 영역 ∩ 값 있음) ③ 필수 처리 후 정렬해 count개 선택 ④ 한국사 조건 순서로 짠다. 기존 `roundFloat` 사용.
- [ ] **Step 4: 통과 확인** — Run: `node scripts/test-calc.mjs` / Expected: `계산 함수 자체 점검 통과`.
- [ ] **Step 5: 커밋** — `git add calc-core.js scripts/test-calc.mjs && git commit -m "수능 최저·절대평가 등급 계산 함수와 점검"`

### Task 2: season.js — 날짜표·시즌 줄·D-day

**Files:**
- Create: `season.js`
- Test: `scripts/test-calc.mjs` (season 절 추가: `season.js`를 document 없는 별도 vm 컨텍스트에서 실행)

**Interfaces:**
- Produces (전역, 브라우저와 vm 모두):
  - `SUNEUNG_DATES` (Global Constraints 값), `SUNEUNG_TIMES = [[key, 교시, 영역, 'HH:MM', 'HH:MM'], ...]` key `'1'..'5'`.
  - `seasonFor(today: 'YYYY-MM-DD') -> { tag, text, href } | null` — 스펙 표 순서(수능 D-30~D-1 `D-n`/"수능 가채점·최저 계산기", 당일 `오늘`/"수능 시간표·가채점 최저 확인", +1~+4 `가채점`/"가채점 등급으로 최저 확인", 통지~+3 `발표`/"수능 성적으로 최저 확인", 그다음 연간 표).
  - `suneungLine(now: Date) -> { tag, text, period } | null` — period는 시간표 줄 키(`'enter'|'1'..'5'|'lunch'|'done'`) 또는 null.
    수능 전 `{ tag:'D-14', text:'2027학년도 수능 · 11월 19일(목)' }`, 당일(스펙의 문구), 다음 날~통지 전날 `{ tag:'D-n', text:'수능 성적 통지 · 12월 11일(금)' }`, 통지일 `{ tag:'오늘', text:'수능 성적 통지일' }`, 그 뒤 다음 표 줄 `{ tag:'D-n', text:'2028학년도 수능 · 2027년 11월 18일(목)' }`, 표에 없으면 null.
- 화면 처리(같은 파일 끝, `typeof document !== 'undefined'`일 때만): 
  - `body[data-app="suneung"]`: `#dday`의 태그·문구를 `suneungLine(new Date())`로 바꾸고(null이면 숨김), 시간표 `tr[data-period]` 중 period가 같은 줄에 `is-hit`.
  - 그 밖에 `.page-head`가 있는 페이지: `seasonFor(오늘)`이 있고 href ≠ `location.pathname`이면 `<a class="season" href>` + `.season-tag` + `.season-text` + 화살표 svg를 `(.tool-seg || .page-head).after(...)`.
  - 모든 페이지 `<head>`에서 `site-nav.js` 다음 줄에 `defer`로 싣는다(Task 4).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const sctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../season.js', import.meta.url), 'utf8'), sctx);
const s = vm.runInContext('({ SUNEUNG_DATES, seasonFor, suneungLine })', sctx);
for (const [exam, score] of s.SUNEUNG_DATES) { assert.equal(new Date(exam + 'T00:00').getDay(), 4); assert.ok(score > exam); }
const sf = d => plain(s.seasonFor(d));
assert.deepEqual(sf('2026-11-05'), { tag: 'D-14', text: '수능 가채점·최저 계산기', href: '/suneung/' });
assert.equal(sf('2026-10-20').tag, 'D-30'); assert.equal(sf('2026-10-19'), null);
assert.equal(sf('2026-11-19').tag, '오늘'); assert.equal(sf('2026-11-23').tag, '가채점');
assert.deepEqual(sf('2026-11-24'), { tag: '기말', text: '기말고사 목표 점수 계산', href: '/target-score/' });
assert.equal(sf('2026-12-11').tag, '발표'); assert.equal(sf('2026-12-14').href, '/rank/');
assert.equal(sf('2027-03-25').href, '/suneung/'); assert.equal(sf('2027-01-15'), null);
const sl = (...a) => plain(s.suneungLine(new Date(...a)));
assert.deepEqual(sl(2026, 10, 5, 9), { tag: 'D-14', text: '2027학년도 수능 · 11월 19일(목)', period: null });
assert.equal(sl(2026, 10, 19, 7, 30).period, 'enter');
assert.deepEqual(sl(2026, 10, 19, 10, 45), { tag: '오늘', text: '지금 2교시 수학 · 12:10 종료', period: '2' });
assert.equal(sl(2026, 10, 19, 12, 30).period, 'lunch'); assert.equal(sl(2026, 10, 19, 18).period, 'done');
assert.equal(sl(2026, 10, 20, 9).text, '수능 성적 통지 · 12월 11일(금)'); assert.equal(sl(2026, 10, 20, 9).tag, 'D-21');
assert.equal(sl(2026, 11, 12, 9).text, '2028학년도 수능 · 2027년 11월 18일(목)');
assert.equal(s.suneungLine(new Date(2027, 11, 11, 9)), null);
```

- [ ] **Step 2: 실패 확인** — Run: `node scripts/test-calc.mjs` / Expected: `ENOENT ... season.js`.
- [ ] **Step 3: `season.js` 구현** — 날짜 차이는 `Date.UTC(y, m-1, d)` 차 ÷ 86400000으로 정수 일수, 연간 표는 `'MM-DD'` 문자열 비교. 날짜 표기 도우미 하나(`11월 19일(목)`, 연도 포함 옵션).
- [ ] **Step 4: 통과 확인** — Run: `node scripts/test-calc.mjs` / Expected: 통과.
- [ ] **Step 5: 커밋** — `git add season.js scripts/test-calc.mjs && git commit -m "시즌 날짜표·D-day 계산(season.js)과 점검"`

### Task 3: `/suneung/` 페이지와 스타일

**Files:**
- Create: `suneung/index.html`
- Modify: `styles.css` (도구 색 `[data-app="suneung"]` 옆에, `.season`·`.sn-*`·상태 알약은 `.tool-seg` 절 근처)

**Interfaces:**
- Consumes: Task 1 `absGrade`, `suneungMinimum`; Task 2 `season.js` 화면 처리(`#dday`, `tr[data-period]`); 공용 `rollNumber`, `stampIn`, `achievement`, `setMiniResult`, `showToast`, `formatNumber`.
- Produces: 페이지 골격(다른 도구 복사): `body[data-app="suneung"]`, `.bar-main[data-label="수능"]`, 메뉴에 수능 링크(aria-current), `h1` "수능 최저 계산기", `#resetBtn`, `p.season#dday`(정적 문구 "2027학년도 수능 2026년 11월 19일(목) · 성적 통지 12월 11일(금)"), `form#suneungForm`, `#resultCard`, `.note`.
  - CSS 클래스: `.season`(inline-flex 캡슐, 헤어라인, 단색), `.season-tag`(회색 칩·굵게·tabular-nums), `.season-text`(말줄임), `.sn-rows`/`.sn-row`(영역명 | 원점수 | 등급, 등급은 항상 3열), `.sn-rule`(문장형 고르기 줄, 줄바꿈 허용), `.sn-opts`(600px↑ 3열), `.grade[data-status="met"|"unmet"]`(상태색 옅은 바탕 + 상태색 글자, 그림자 없음).
  - 앱 색: `--app-ink: #855700; --app-a: #FFD54A; --app-b: #F2A500; --app-glow: rgba(242,165,0,.55)`, 글리프 = 체크 표시 시험지(`rect x5 y3.5 w14 h17 rx2.5` + `M8.5 10.5l2.2 2.2 4.8-4.8M8.5 16.5h7`).

- [ ] **Step 1: 페이지 마크업** — `rank/index.html` 머리·셸·푸터를 복사해 메타를 바꾼다: title `수능 최저 계산기 - 2027 수능 가채점 등급·최저 충족 확인 | 성적 계산기`, description(35~170자, 11월 19일·가채점·최저·영어·한국사·D-day 포함), keywords, canonical·og:url `https://naver1.cloud/suneung/`, JSON-LD 배열 `[WebApplication, FAQPage]`(FAQ는 본문 details와 같은 문답). 스크립트: 머리 `site-nav.js` 다음 `season.js` defer, 본문 끝 `calc-core.js` → 페이지 스크립트.
- [ ] **Step 2: 입력 카드** — 영역 줄 6개(kor, math, eng, hist, inq1, inq2; 이름 국어·수학·영어·한국사·탐구 1·탐구 2). 등급 select는 JS가 `''`(선택) + `1등급`~`9등급`으로 채운다. 영어·한국사만 `input[data-raw]`(type=number, min 0, max 100/50, step 1, inputmode numeric, 단위 "점"). 짧은 안내 한 줄: "영어·한국사는 원점수만 넣어도 등급이 정해져요." 조건 카드: 반영 영역 토글(`.seg`, aria-pressed, 마지막 하나는 못 끔), `#ruleCount`(1~켠 수) "개 영역" `#ruleMode`(등급 합/각각) `#ruleLimit`(합: count~count×9, 각각: 1~9등급) "이내", `#ruleInq`(상위 1과목/2과목 평균/2과목 평균(소수점 버림)), `#ruleMust`(없음 + 켠 영역 "○○ 포함"), `#ruleHist`(조건 없음 + 1~9등급 이내). 기본: 영역 4개, 3개 합 6, 상위 1과목, 필수 없음, 한국사 조건 없음.
- [ ] **Step 3: 페이지 스크립트** — 상태 `{ grades, raw, rule }`를 localStorage `suneungCalc`에 저장/불러오기(형식 검사 후 기본값으로 보정). 원점수 입력 → `absGrade` 값이 있으면 등급 select 갱신, 없으면 `aria-invalid="true"`; 등급 select를 직접 바꾸면 해당 원점수는 비운다. 모드 바꾸면 각각=2, 합=count×2로 한도 초기화; 영역을 끄면 필수·개수·한도를 범위로 당긴다. 결과:
  - empty(아무 등급 없음): `—`, "등급을 고르면 바로 확인돼요."
  - pending: 메시지 우선순위 inq("탐구 2과목 평균은 두 과목 등급이 모두 필요해요.") → must("○○ 등급이 필요해요(필수 영역).") → count("○개 영역 등급이 필요해요(지금 ○개).") → hist("한국사 등급이 필요해요.").
  - met/unmet: 합 모드 라벨 "등급 합 (○개 영역)", 값 sum; 각각 모드 라벨 "○등급 이내 영역", 값 within, 단위 "개". 알약 `충족`/`미충족`(data-status). 풀이: "국어 2 + 영어 2 + 탐구 1 · 기준 6 이내"(탐구 평균이면 "탐구(평균) 2.5"). 미충족 합: "합을 ○ 더 낮춰야 해요", 각각: "○개 더 필요해요". 메타: 한국사 조건이 있으면 "한국사 ○등급 · ○등급 이내 충족/미달".
  - 미니 바: `합 5 · 충족` / `3개 · 미충족`. `achievement(card, '최저 충족')`. 초기화는 되돌리기 토스트.
- [ ] **Step 4: 본문(.note)** — h2 "수능 최저학력기준 계산법"(설명 + `.examples` 3개: 3합 6, 탐구 평균 버림, 수학 포함), h2 "영어·한국사 절대평가 등급"(표: 등급 | 영어 | 한국사), h2 "2027학년도 수능 시간표"(표, `tr[data-period]`: enter·1·2·lunch·3·4·5), h2 "2027학년도 수능 일정"(시험일·이의신청·정답 확정·성적 통지), FAQ details 4개(가채점 등급은 어떻게? / 탐구 평균 버림이란? / 성적표엔 원점수가 없어요 / 결과를 믿어도 되나요? → 모집요강·참고용), more-link → `/blog/suneung-minimum/`. 표는 `.table`, 휴대폰 폭에서 3열 이내.
- [ ] **Step 5: 스타일** — 위 Produces의 클래스와 앱 색·글리프를 `styles.css`에 추가.
- [ ] **Step 6: 확인** — Run: `npm test && npm run test:seo` / Expected: 통과, SEO 오류 0(새 페이지 sitemap 경고는 Task 5에서 해소).
- [ ] **Step 7: 커밋** — `git add suneung/index.html styles.css && git commit -m "수능 최저 계산기 페이지: 가채점 등급·최저 조건·D-day·시간표"`

### Task 4: 모든 페이지 — 메뉴의 수능, season.js, 버전, 오프라인

**Files:**
- Modify: 메뉴가 있는 HTML 21개(`git grep -l 'class="tools glass"'`), `scripts/rebuild-guides.mjs`(SHELL·버전), `app-sw.js`, `manifest.json`(description에 수능 최저)
- 일회용 스크립트는 스크래치패드에 두고 커밋하지 않는다.

**Interfaces:**
- Consumes: Task 2 `season.js`, Task 3 `[data-app="suneung"]`.
- Produces: 모든 메뉴에 `<a class="tool" href="/suneung/"><span class="app-icon" data-app="suneung" aria-hidden="true"></span><span class="tool-name">수능</span></a>`(내신등급 링크 바로 다음), 머리에 `<script src="{같은 상대 경로}season.js?v=20261105a" defer></script>`(site-nav.js 다음 줄), 공용 파일 `?v=` 전부 `20261105a`.

- [ ] **Step 1: 일회용 스크립트로 일괄 수정** — 정규식: rank 링크 줄 뒤에 수능 줄 삽입(들여쓰기 8칸), `((?:\.\./)*)site-nav\.js\?v=[^"]+"></script>` 뒤에 season.js 줄, `(styles\.css|site-nav\.js|calc-core\.js|assistant\.js|season\.js)\?v=[0-9a-z]+` → `$1?v=20261105a`. 같은 처리를 `scripts/rebuild-guides.mjs`에도.
- [ ] **Step 2: `app-sw.js`** — PAGES에 `'/suneung/'`, CACHE `app-20261105`. `manifest.json` description에 "수능 최저 충족" 추가.
- [ ] **Step 3: 확인** — Run: `git grep -c 'href="/suneung/"' -- '*.html' | wc -l` → 22(새 페이지 포함), `git grep -n 'v=20261025h\|v=20261028a'` → 출력 없음, `npm test` 통과.
- [ ] **Step 4: 커밋** — `git commit -am "모든 메뉴에 수능 추가, 시즌 안내 줄 스크립트, 공용 파일 버전 20261105a"`

### Task 5: SEO 글·목록·사이트맵·AI 도우미·IndexNow

**Files:**
- Modify: `scripts/rebuild-guides.mjs`(글별 `date`, 블록 HTML은 `<p>`로 안 감싸기, 새 글 2개), `blog/index.html`, `rss.xml`, `sitemap.xml`, `faq/index.html`, `guide/index.html`, `scripts/kb/10-suneung.txt`, `scripts/kb/01-site.txt`, `assistant.js`(PLACES·PATH·V), `assistant/kb.json`(생성)
- Create: `blog/suneung-minimum/index.html`, `blog/suneung-absolute-grade/index.html`(생성기 출력), `<키>.txt`(IndexNow 키), `scripts/indexnow.mjs`

**Interfaces:**
- Consumes: Task 3·4 결과.
- Produces: 새 URL 3개가 sitemap·RSS·목록·내부 링크에 걸린다. `node scripts/indexnow.mjs <url>...` → api.indexnow.org POST, 상태 코드 출력(200/202 성공).

- [ ] **Step 1: 생성기 확장 + 글 2개** — `date` 없으면 `'2026-08-09'`. 새 글(date `2026-11-05`):
  - `suneung-minimum` "수능 최저학력기준 계산법: 등급 합·탐구 평균·한국사" — 절: 최저학력기준이란 / 공식(가장 좋은 N개 영역 등급 합 ≤ 기준) / 예시 3합 6 / 탐구 2과목 평균과 버림 / '각각' 조건 / 가채점으로 미리 확인. cta `/suneung/`.
  - `suneung-absolute-grade` "수능 영어·한국사 절대평가 등급표" — 절: 영어 원점수 구간(표) / 한국사 원점수 구간(표) / 제2외국어·한문 45점 1등급 5점 간격 / 표준점수·백분위가 없는 이유 / 대학 반영 방식(등급별 점수·가감점). cta `/suneung/`.
  - Run: `node scripts/rebuild-guides.mjs` → `10개 가이드 재작성 완료`, 기존 8개 글은 `git diff`에 메뉴·버전 외 변화가 없어야 한다.
- [ ] **Step 2: 목록·RSS·사이트맵·FAQ·사용법** — blog 목록 맨 위에 새 글 2개, rss item 2개(pubDate `Thu, 05 Nov 2026 09:00:00 +0900`), sitemap에 `/suneung/`(weekly 0.9)·새 글 2개(monthly 0.7) lastmod 2026-11-05, `/faq/`·`/guide/`·`/blog/` lastmod 2026-11-05. FAQ에 수능 문답 3개(본문 + JSON-LD), 사용법에 "수능 최저 계산기" 절.
- [ ] **Step 3: AI 도우미** — `10-suneung.txt`: 날짜 문답을 정확한 날짜로(2027학년도 11-19/12-11, 2028학년도 2027-11-18/12-10), 시간표·이의신청·정답 확정·가채점표 문답, 최저·영어·한국사 문답에 `L: /suneung/`, 새 문답 "수능 최저 계산기 어디 있어"(C: 줄 포함). `01-site.txt` 소개 답에 수능 최저 추가 + 도구 위치 문답. `assistant.js` PLACES에 `'/suneung/': '수능 최저 계산기'`, PATH에 `suneung`, `V = '20261105a'`. Run: `npm run build:kb && npm test` → 통과.
- [ ] **Step 4: IndexNow** — 32자리 16진 키 생성, 루트 `<키>.txt`(내용 = 키), `scripts/indexnow.mjs`(키 상수, host `naver1.cloud`, keyLocation, 인자 URL 목록 POST, 응답 코드 출력). 실행은 배포 뒤(Task 7).
- [ ] **Step 5: 확인** — Run: `npm test && npm run test:seo` / Expected: SEO 100/100, 오류 0, 권고 0(새 글 유사도 55% 미만, 본문 700자 이상).
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "수능 SEO: 가이드 2편·FAQ·사용법·사이트맵·RSS·AI 도우미 지식, IndexNow 키"`

### Task 6: 화면 검증(헤드리스 Chrome CDP)

**Files:**
- Create(스크래치패드, 커밋 안 함): 정적 서버 + CDP 드라이버 `qa.mjs`, 스크린샷 폴더.

- [ ] **Step 1: 드라이버** — 워크트리를 루트로 하는 정적 서버, Chrome `--headless=new --remote-debugging-port`, 짧은 프로필 경로(`%TEMP%\cdpS`). `Page.addScriptToEvaluateOnNewDocument`로 `Date`를 고정 시각으로 바꿀 수 있게, `Emulation.setDeviceMetricsOverride`로 390×844(mobile)·1280×900, `Emulation.setEmulatedMedia`로 다크.
- [ ] **Step 2: 시나리오와 기대**
  - `/suneung/` 390·1280 × 라이트·다크: 가로 스크롤 없음(`scrollWidth ≤ innerWidth`), 입력 → 충족(합 5)·미충족(차이 표시)·입력 부족 문구, 영어 87 → 2등급 자동, 영어 120 → aria-invalid.
  - 날짜 2026-11-05/11-19 10:45/11-20/12-12: `#dday` 문구가 Task 2 기대와 같고, 11-19 10:45엔 `tr[data-period="2"]`가 `is-hit`.
  - `/rank/` 2026-11-05: 시즌 줄 "D-14 수능 가채점·최저 계산기"가 글자 탭 아래, 2026-11-24엔 "기말 …" → /target-score/, 2027-01-15엔 없음. `/suneung/`엔 시즌 줄 없음.
  - PC 상단 바 960·1280: 로고·도구 8개·다크 모드 버튼이 겹치지 않음(요소 사각형 교차 검사). 휴대폰 글자 탭 360·390: 6칸 글자가 칸 안(`scrollWidth ≤ clientWidth`). 메뉴 시트 열린 화면.
- [ ] **Step 3: 고칠 것 고치고 다시 실행**, 스크린샷을 보고(Read) 디자인 규칙(단색 줄, 차분한 제목, 상태색) 확인.
- [ ] **Step 4: 커밋**(고친 게 있으면) — `git commit -am "화면 검증 반영: …"`

### Task 7: 리뷰·배포·라이브 확인

- [ ] **Step 1: 전체 점검** — `npm test && npm run test:seo`, `git diff origin/main --stat` 훑기, 코드 리뷰(superpowers:requesting-code-review) 반영.
- [ ] **Step 2: 배포** — `git push origin HEAD:main`(fast-forward). `gh api repos/ritual1127/ritual/pages/builds/latest`가 `built` + 이 커밋.
- [ ] **Step 3: 라이브 확인** — `curl -sI https://naver1.cloud/suneung/` 200, 새 글 2개·키 파일 200, 라이브 HTML(줄바꿈 \r 제거)과 로컬 같은지, `?v=20261105a` 적용.
- [ ] **Step 4: IndexNow** — `node scripts/indexnow.mjs https://naver1.cloud/suneung/ https://naver1.cloud/blog/suneung-minimum/ https://naver1.cloud/blog/suneung-absolute-grade/ https://naver1.cloud/faq/ https://naver1.cloud/guide/ https://naver1.cloud/blog/ https://naver1.cloud/sitemap.xml` → 200/202.
- [ ] **Step 5: 마무리** — 메모리 갱신, 보고(스크린샷, 사용자 할 일: Search Console 색인 요청·사이트맵 재제출, 네이버 서치어드바이저 수집 요청, /admin "지금 색인하기", ADMIN_PIN 교체).
