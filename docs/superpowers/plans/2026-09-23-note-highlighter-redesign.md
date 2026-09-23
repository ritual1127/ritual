# 노트 & 형광펜 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 실행 방식: 사용자가 "끝까지 자동 진행"을 골랐으므로 작성자가 이 세션에서 직접 실행한다(executing-plans). 이 계획의 코드 블록은 **로직과 인터페이스의 정본**이다. CSS와 페이지 마크업은 아래 "컴포넌트 계약"을 따라 작성하고, Task 8의 브라우저 QA에서 시각 품질을 검증한다.

**Goal:** 기능·URL·SEO는 그대로 두고, 21개 페이지 전체를 "노트 & 형광펜" 디자인 시스템과 실시간 계산 UX로 다시 만든다.

**Architecture:** 정적 멀티 페이지 구조를 유지한다. `styles.css`와 `site-nav.js`는 새로 쓴다. 계산 순수 함수는 `calc-core.js` 하나로 모으고 Node 테스트(`scripts/test-calc.mjs`)로 검증한다. 공통 셸(상단바·도구 칩·푸터)은 각 페이지의 정적 마크업으로 넣는다. 가이드 글 8개는 `scripts/rebuild-guides.mjs` 템플릿으로 다시 생성한다.

**Tech Stack:** Vanilla HTML/CSS/JS, Pretendard Variable(jsDelivr), localStorage, NEIS 프록시, Node 24(검증 스크립트).

**Spec:** `docs/superpowers/specs/2026-09-23-note-highlighter-redesign-design.md`

## Global Constraints

- 새 프레임워크나 빌드 도구는 쓰지 않는다. 외부 리소스는 `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css` 하나만 추가한다.
- `<head>`의 title, description, keywords, robots, canonical, og:*, twitter:*, JSON-LD, GTM, AdSense는 바꾸지 않는다. 바꾸는 것은 theme-color(라이트 `#FAF7F0`, 다크 `#14161D`)와 폰트 링크 추가뿐이다.
- localStorage 키와 형식을 유지한다: `rankRows`, `rankSystem`, `gpaRows`, `gpaScale`, `theme`, `neisSchool`, `neisClass`, `neisTimetableMode`. 새 키는 `scoreCalc`, `targetCalc`.
- 문구는 해요체. 이모지를 아이콘으로 쓰지 않고 인라인 SVG를 쓴다.
- 입력 글자는 16px 이상, 터치 대상은 44px 이상.
- 자원 경로는 상대 경로(`styles.css`, `../styles.css`, `../../styles.css`), 페이지 이동 링크는 절대 경로(`/rank/`).
- 페이지마다 `<h1>`은 정확히 1개. `npm test` 통과, `npm run test:seo`는 100/100.
- 외부 데이터와 저장값은 `textContent`/`.value`로만 DOM에 넣는다.

## Review Focus

1. **한글 IME 조합 중 Enter**: 과목명 입력 중 조합을 확정하려고 Enter를 누르면 다음 칸으로 넘어가면 안 된다. `event.isComposing`이 참이면 무시한다(Task 1, 코드 리뷰와 수동 확인).
2. **망가진 저장값**: `scoreCalc`/`targetCalc` JSON이 깨졌거나, `rankRows`에 `null`이 있거나, 4.5 만점인데 `gpaRows`에 `A-`가 있는 경우. 기본값이나 매핑된 값으로 조용히 복구해야 한다(Task 2~5, Task 8 QA 3단계).
3. **부동소수 경계**: 합이 89.99999999가 되어 90이 B로 떨어지는 경우, 4% 경계, 필요 점수 97.5가 97.51로 과대 표시되는 경우(Task 1 `test-calc.mjs`).
4. **범위 밖 입력**: "150", "-5"를 치면 결과 대신 안내가 나오고 해당 칸이 `aria-invalid`가 된다. blur하면 0~100으로 보정되고 재계산된다(Task 1 보정 로직, Task 8 QA).
5. **NEIS 실패·빈 응답**: 주말, 네트워크 오류, CORS 차단에서도 콘솔 예외 없이 안내 문구가 나와야 한다. 학교명의 특수문자는 텍스트로 그대로 보여야 한다(Task 6).

---

## 컴포넌트 계약 (styles.css ↔ 마크업 ↔ 스크립트)

| 클래스/속성 | 역할 |
|---|---|
| `.skip-link` | 포커스될 때만 보이는 본문 바로가기 |
| `.appbar` > `.appbar-inner` > `.logo`(`.logo-mark`), `.mini-result`(JS 생성 button), `.theme-toggle` | sticky 상단바 56px |
| `.toolnav` > `.toolnav-inner`(`data-start`/`data-end` 양끝 페이드) > `a.tool[aria-current=page]`, `.toolnav-sep` | 도구 칩 줄 |
| `main.page` / `main.page.page-narrow` | 최대 1080px / 720px 컨테이너 |
| `.page-head` > `.eyebrow`, `h1`, `.lede` | 페이지 제목 |
| `.calc` > `.result-card` + `.input-stack` | 모바일 1단(결과 먼저), 960px 이상 2단(결과 오른쪽 sticky) |
| `.card`, `.card-head`(`h2` + `.card-actions`), `.card-sub` | 종이 카드 |
| `.btn`, `.btn-ghost`, `.btn-sm`, `.icon-btn` | 버튼. `.is-armed`는 초기화 대기 상태 |
| `.seg[role=group]` > `button[aria-pressed]` | 세그먼트 |
| `.stepper` > `button[data-count][data-delta]` + `output` | 개수 − n + |
| `.rows` > `.row` | 괘선 행. `.row-name`, `.cell` |
| `.input-wrap` > `input.input` + `.unit` | 밑줄 입력칸과 단위 |
| `.field` > `label.field-label` + `.input-wrap` | 라벨이 위에 있는 입력 |
| `.meter[data-state=under/ok/over]` > `.meter-track > .meter-fill`, `.meter-text` | 비율 미터 |
| `.result-card[data-state=empty/partial/done/warn/bad]` | 결과 상태 |
| `.result-label`, `.result-main` > `.result-value` > `.marker`, `.result-unit`, `.grade[data-grade]` | 큰 숫자와 형광펜, 등급 배지 |
| `.scorebar` > `.scorebar-track > .scorebar-fill`, `.scorebar-zones` | 0~100 진행바와 A~E 구간 |
| `.result-note`, `.result-meta`, `details.formula` | 결과 보조 정보 |
| `[data-grade=A..E]` | `--g`와 `--g-bg`를 설정해 등급 색을 적용 |
| `.chip`, `.chip-grid`, `.chip.is-hit` | 작은 알약. 구간표·평점표 |
| `.table-wrap` > `table.table` | 결과 표 |
| `.note` | 계산기 아래 설명 섹션. `details.faq` 아코디언 |
| `.prose`, `.article-lead`, `.formula-box`, `.cta` | 글 본문 |
| `.topic`, `.topic-grid`, `a.topic-card` | 가이드 허브 |
| `.school-search`, `.school-results` > `button.school-option`, `.school-card` | 학교 선택기 |
| `.date-nav`, `.dish-list`, `.period-list`, `.week-grid`, `.switch[aria-pressed]` | 급식/시간표 |
| `.status` | 로딩/없음/오류 안내(점선 박스) |
| `.site-footer` > `.footer-links` | 푸터 |

### 공통 셸 스니펫 (모든 페이지 `<body>` 시작과 끝)

```html
<a class="skip-link" href="#main">본문 바로가기</a>
<header class="appbar">
  <div class="appbar-inner">
    <a class="logo" href="/"><span class="logo-mark">성적</span>계산기</a>
    <button type="button" class="theme-toggle" aria-pressed="false" aria-label="다크 모드">
      <svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>
      <svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
    </button>
  </div>
</header>
<nav class="toolnav" aria-label="도구">
  <div class="toolnav-inner">
    <a class="tool" href="/">수행·지필</a>
    <a class="tool" href="/target-score/">목표점수</a>
    <a class="tool" href="/rank/">내신등급</a>
    <a class="tool" href="/gpa/">학점</a>
    <a class="tool" href="/gpa-converter/">GPA 환산</a>
    <span class="toolnav-sep" aria-hidden="true"></span>
    <a class="tool" href="/todayfood/">급식</a>
    <a class="tool" href="/todayclass/">시간표</a>
  </div>
</nav>
…
<footer class="site-footer">
  <p>계산 결과는 참고용이에요. 실제 성적은 학교·대학의 평가 규정을 따라요.</p>
  <nav class="footer-links" aria-label="사이트 정보"><a href="/blog/">계산 가이드</a><a href="/faq/">자주 묻는 질문</a><a href="/guide/">사용법</a><a href="/privacy/">개인정보처리방침</a></nav>
  <p class="copyright">© 2026 성적 계산기</p>
</footer>
```

현재 페이지의 `a.tool`에만 `aria-current="page"`를 단다.

### `<head>` 교체 규칙

`<meta name="theme-color" content="#4f46e5">` 한 줄을 아래로 바꾸고 폰트 두 줄을 스타일시트 링크 바로 앞에 넣는다.

```html
<meta name="theme-color" content="#FAF7F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14161D" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
```

---

### Task 1: 기반 — `calc-core.js`, 테스트, `site-nav.js`, `styles.css`, `manifest.json`

**Files:**
- Create: `calc-core.js`, `scripts/test-calc.mjs`
- Rewrite: `site-nav.js`, `styles.css`
- Modify: `package.json`(test 스크립트), `manifest.json`(색)

**Interfaces:**
- Produces(전역, `calc-core.js`): `GRADE_CUTS`, `formatNumber(value, digits=2) → string`, `gradeFor(score) → 'A'..'E'`, `nextGradeGap(score) → {grade, gap} | null`, `weightedSum([{score, weight}]) → number`, `ceil2(value) → number`, `requiredScore(target, completedScore, remainingWeight) → {status: 'possible'|'reached'|'impossible'|'no-remaining', score?}`, `RANK_CUTS`, `rankPercentile(rank, tie, total) → number`, `rankGrade(pct, system) → 1..9`, `rankTier(grade, system) → 'A'..'E'`, `rankRowStatus({total, rank, tie}) → 'pending'|'invalid'|'ok'`, `GPA_SCALES`, `mapGrade(grade, scale) → string`, `gpaSummary([{credit, grade}], scale) → {total, graded, gpa|null}`, `convertGpa(value, from, to) → number|null`
- Produces(전역, `site-nav.js`): `setMiniResult(text: string)`, `armReset(button: HTMLButtonElement, action: () => void)`. 자동 적용: 테마 토글, 도구 칩 가운데 정렬과 양끝 페이드, SW 등록, `.calc` 안 Enter로 다음 칸 이동, 숫자 칸 포커스 시 전체 선택, blur 시 min/max 보정(보정하면 `input` 이벤트 재발행).

- [ ] **Step 1: 실패하는 테스트 작성** — `scripts/test-calc.mjs`

```js
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../calc-core.js', import.meta.url), 'utf8'), context);
const c = vm.runInContext('({ formatNumber, gradeFor, nextGradeGap, weightedSum, ceil2, requiredScore, rankPercentile, rankGrade, rankTier, rankRowStatus, mapGrade, gpaSummary, convertGpa })', context);

// 수행·지필
assert.equal(c.weightedSum([{ score: 90, weight: 40 }, { score: 80, weight: 30 }, { score: 70, weight: 30 }]), 81);
assert.equal(c.weightedSum([{ score: 92, weight: 20 }, { score: 88, weight: 20 }, { score: 81, weight: 30 }, { score: 86, weight: 30 }]), 86.5);
assert.equal(c.weightedSum([{ score: 89.7, weight: 30 }, { score: 90.3, weight: 30 }, { score: 90, weight: 40 }]), 90);
assert.equal(c.gradeFor(90), 'A');
assert.equal(c.gradeFor(89.99), 'B');
assert.equal(c.gradeFor(59.99), 'E');
assert.deepEqual(c.nextGradeGap(86.5), { grade: 'A', gap: 3.5 });
assert.equal(c.nextGradeGap(95), null);
assert.equal(c.formatNumber(86.5), '86.5');
assert.equal(c.formatNumber(90 - 86.66), '3.34');
assert.equal(c.formatNumber(-0.001), '0');

// 목표점수
assert.equal(c.requiredScore(90, 54, 40).score, 90);
assert.equal(c.requiredScore(90, 51, 40).score, 97.5);
assert.equal(c.requiredScore(80, 85, 20).status, 'reached');
assert.equal(c.requiredScore(95, 50, 40).status, 'impossible');
assert.equal(c.requiredScore(90, 90, 0).status, 'no-remaining');
assert.equal(c.ceil2(97.5), 97.5);
assert.equal(c.ceil2(97.501), 97.51);
assert.equal(c.ceil2(97.49999999999999), 97.5);

// 내신등급
assert.equal(c.rankPercentile(8, 1, 200), 4);
assert.equal(c.rankPercentile(10, 3, 100), 11);
assert.equal(c.rankGrade(4, 9), 1);
assert.equal(c.rankGrade(4.01, 9), 2);
assert.equal(c.rankGrade(100, 9), 9);
assert.equal(c.rankGrade(10, 5), 1);
assert.equal(c.rankGrade(10.1, 5), 2);
assert.equal(c.rankTier(3, 9), 'B');
assert.equal(c.rankTier(5, 5), 'E');
assert.equal(c.rankRowStatus({ total: 30, rank: 29, tie: 3 }), 'invalid');
assert.equal(c.rankRowStatus({ total: 30, rank: null, tie: 1 }), 'pending');
assert.equal(c.rankRowStatus({ total: 30, rank: 28, tie: 3 }), 'ok');

// 학점
assert.equal(c.gpaSummary([{ credit: 3, grade: 'A+' }, { credit: 2, grade: 'B0' }], '4.5').gpa, 3.9);
assert.equal(c.gpaSummary([{ credit: 3, grade: 'F' }, { credit: 2, grade: 'A0' }], '4.5').gpa, 1.6);
assert.deepEqual(c.gpaSummary([{ credit: 2, grade: 'P' }], '4.5'), { total: 2, graded: 0, gpa: null });
assert.equal(c.mapGrade('A-', '4.5'), 'A0');
assert.equal(c.mapGrade('P', '4.3'), 'P');
assert.equal(c.mapGrade('??', '4.5'), 'A+');

// GPA 환산
assert.equal(c.convertGpa(4.5, 4.5, 4.3), 4.3);
assert.equal(c.convertGpa(-1, 4.5, 4.3), null);
assert.equal(c.convertGpa(5, 4.5, 4.3), null);
assert.equal(c.convertGpa(1, 0, 4.3), null);

console.log('계산 함수 자체 점검 통과');
```

- [ ] **Step 2: 실패 확인** — `node scripts/test-calc.mjs` → `ENOENT ... calc-core.js`

- [ ] **Step 3: `calc-core.js` 구현**

```js
// 계산기 공용 순수 함수. DOM을 건드리지 않으며 scripts/test-calc.mjs가 Node에서 그대로 검증한다.
const GRADE_CUTS = [['A', 90], ['B', 80], ['C', 70], ['D', 60], ['E', 0]];
const RANK_CUTS = { 9: [4, 11, 23, 40, 60, 77, 89, 96, 100], 5: [10, 34, 66, 90, 100] };
const RANK_TIERS = { 9: ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E'], 5: ['A', 'B', 'C', 'D', 'E'] };
const GPA_SCALES = {
  '4.5': { 'A+': 4.5, 'A0': 4.0, 'B+': 3.5, 'B0': 3.0, 'C+': 2.5, 'C0': 2.0, 'D+': 1.5, 'D0': 1.0, 'F': 0 },
  '4.3': { 'A+': 4.3, 'A0': 4.0, 'A-': 3.7, 'B+': 3.3, 'B0': 3.0, 'B-': 2.7, 'C+': 2.3, 'C0': 2.0, 'C-': 1.7, 'D+': 1.3, 'D0': 1.0, 'D-': 0.7, 'F': 0 },
  '4.0': { 'A+': 4.0, 'A0': 4.0, 'A-': 3.7, 'B+': 3.3, 'B0': 3.0, 'B-': 2.7, 'C+': 2.3, 'C0': 2.0, 'C-': 1.7, 'D+': 1.3, 'D0': 1.0, 'D-': 0.7, 'F': 0 }
};

// 0.1 + 0.2 같은 이진 소수 오차를 등급 경계 비교 전에 걷어낸다.
function roundFloat(value) { return Math.round(value * 1e9) / 1e9; }

function formatNumber(value, digits = 2) {
  const fixed = Number(value.toFixed(digits));
  return String(Object.is(fixed, -0) ? 0 : fixed);
}

function gradeFor(score) { return GRADE_CUTS.find(([, min]) => score >= min)[0]; }

function nextGradeGap(score) {
  const index = GRADE_CUTS.findIndex(([, min]) => score >= min);
  if (index === 0) return null;
  const [grade, min] = GRADE_CUTS[index - 1];
  return { grade, gap: roundFloat(min - score) };
}

function weightedSum(items) {
  return roundFloat(items.reduce((sum, { score, weight }) => sum + score * weight, 0) / 100);
}

// 필요 점수는 덜 보여주면 안 되므로 소수 둘째 자리에서 올림한다.
function ceil2(value) { return Math.ceil(value * 100 - 1e-7) / 100; }

function requiredScore(target, completedScore, remainingWeight) {
  if (!(remainingWeight > 0)) return { status: 'no-remaining' };
  const score = roundFloat((target - completedScore) * 100 / remainingWeight);
  if (score <= 0) return { status: 'reached', score: 0 };
  if (score > 100) return { status: 'impossible', score };
  return { status: 'possible', score };
}

function rankPercentile(rank, tie, total) { return roundFloat((rank + (tie - 1) / 2) * 100 / total); }

function rankGrade(percentile, system) {
  const index = RANK_CUTS[system].findIndex(max => percentile <= max);
  return (index === -1 ? RANK_CUTS[system].length - 1 : index) + 1;
}

function rankTier(grade, system) { return RANK_TIERS[system][grade - 1]; }

function rankRowStatus({ total, rank, tie }) {
  if (!(total > 0) || !(rank > 0)) return 'pending';
  if (!(tie >= 1) || rank + tie - 1 > total) return 'invalid';
  return 'ok';
}

function mapGrade(grade, scale) {
  if (grade === 'P' || grade in GPA_SCALES[scale]) return grade;
  const base = String(grade).replace('-', '0');
  return base in GPA_SCALES[scale] ? base : 'A+';
}

function gpaSummary(rows, scale) {
  let total = 0, graded = 0, points = 0;
  for (const { credit, grade } of rows) {
    if (!(credit > 0)) continue;
    total += credit;
    if (grade === 'P') continue;
    graded += credit;
    points += (GPA_SCALES[scale][grade] ?? 0) * credit;
  }
  return { total, graded, gpa: graded ? roundFloat(points / graded) : null };
}

function convertGpa(value, fromScale, toScale) {
  if (![value, fromScale, toScale].every(Number.isFinite) || fromScale <= 0 || toScale <= 0 || value < 0 || value > fromScale) return null;
  return value / fromScale * toScale;
}
```

- [ ] **Step 4: 통과 확인** — `node scripts/test-calc.mjs` → `계산 함수 자체 점검 통과`

- [ ] **Step 5: `package.json` test 스크립트 연결**

```json
"test": "node scripts/validate.mjs && node scripts/test-calc.mjs",
```

- [ ] **Step 6: `site-nav.js` 재작성**

```js
// 모든 페이지 공통: 테마, 도구 칩, 서비스워커, 계산기 입력 보조, 미니 결과, 초기화 확인
(function () {
  const root = document.documentElement;
  const PAPER = { light: '#FAF7F0', dark: '#14161D' };
  const media = matchMedia('(prefers-color-scheme: dark)');

  function savedTheme() { try { return localStorage.getItem('theme'); } catch { return null; } }
  function currentTheme() { return root.dataset.theme || (media.matches ? 'dark' : 'light'); }
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', PAPER[currentTheme()]));
    document.querySelector('.theme-toggle')?.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  }
  applyTheme(savedTheme());

  function setupThemeToggle() {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    applyTheme(savedTheme());
    button.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch {}
      applyTheme(next);
    });
    media.addEventListener('change', () => applyTheme(savedTheme()));
  }

  function setupToolnav() {
    const nav = document.querySelector('.toolnav-inner');
    if (!nav) return;
    const active = nav.querySelector('[aria-current="page"]');
    if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    const edges = () => {
      nav.dataset.start = String(nav.scrollLeft <= 2);
      nav.dataset.end = String(nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
    };
    nav.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges, { passive: true });
    edges();
  }

  // 계산기 입력 보조: 포커스 시 전체 선택, Enter로 다음 칸, blur 시 범위 보정
  document.addEventListener('focusin', event => {
    const input = event.target;
    if (input.matches?.('.calc input[type="number"]')) setTimeout(() => input.select(), 0);
  });
  document.addEventListener('keydown', event => {
    const input = event.target;
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || !input.matches?.('.calc input')) return;
    event.preventDefault();
    const fields = [...input.closest('.calc').querySelectorAll('input, select')].filter(field => !field.disabled && field.offsetParent !== null);
    const next = fields[fields.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });
  document.addEventListener('focusout', event => {
    const input = event.target;
    if (!input.matches?.('input[type="number"]') || input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);
    const clamped = Math.min(max, Math.max(min, input.valueAsNumber));
    if (clamped === input.valueAsNumber) return;
    input.value = String(clamped);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 결과 카드가 화면 밖일 때만 상단바에 결과를 띄운다. 스크린리더에는 입력이 멈춘 뒤 한 번만 읽힌다.
  let mini = null, live = null, liveTimer = 0, miniText = '', cardVisible = true;
  function paintMini() { mini.textContent = miniText; mini.hidden = !miniText || cardVisible; }
  window.setMiniResult = text => {
    if (!mini) {
      const card = document.querySelector('.result-card');
      mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'mini-result';
      mini.hidden = true;
      mini.addEventListener('click', () => card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }));
      document.querySelector('.appbar-inner')?.insertBefore(mini, document.querySelector('.theme-toggle'));
      live = document.createElement('p');
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.append(live);
      if (card && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { cardVisible = entry.isIntersecting; paintMini(); }, { rootMargin: '-64px 0px 0px 0px' }).observe(card);
      }
    }
    miniText = text;
    paintMini();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = text; }, 600);
  };

  // 초기화처럼 되돌릴 수 없는 버튼: 3초 안에 두 번 눌러야 실행한다.
  window.armReset = (button, action) => {
    const label = button.textContent;
    let timer = 0;
    const disarm = () => { clearTimeout(timer); timer = 0; button.textContent = label; button.classList.remove('is-armed'); };
    button.addEventListener('click', () => {
      if (timer) { disarm(); action(); return; }
      button.textContent = '한 번 더 누르면 초기화';
      button.classList.add('is-armed');
      timer = setTimeout(disarm, 3000);
    });
  };

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/app-sw.js').catch(() => {}));
  }

  function init() { setupThemeToggle(); setupToolnav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
```

- [ ] **Step 7: `styles.css` 재작성.** 스펙의 색 토큰(라이트, 다크는 `prefers-color-scheme`+`:root:not([data-theme=light])`와 `[data-theme=dark]` 두 곳), 타이포, 모티프(점 격자, 형광펜 `::before`, 밑줄 입력칸, 괘선), 컴포넌트 계약의 모든 클래스, 960px 2단 그리드, `prefers-reduced-motion`, `.google-auto-placed` 보호 규칙을 넣는다. 기존 CSS는 한 줄도 가져오지 않는다.

- [ ] **Step 8: `manifest.json` 색** — `"background_color": "#FAF7F0"`, `"theme_color": "#FAF7F0"`

- [ ] **Step 9: 확인** — `node --check site-nav.js && node --check calc-core.js && npm test` → 통과

- [ ] **Step 10: 커밋** — `git add calc-core.js scripts/test-calc.mjs site-nav.js styles.css package.json manifest.json && git commit -m "노트 & 형광펜 디자인 시스템과 공통 셸 기반 추가"`

---

### Task 2: 수행·지필 계산기 (`index.html`)

**Files:** Rewrite body: `index.html`(head는 교체 규칙만 적용)

**Interfaces:**
- Consumes: `weightedSum`, `gradeFor`, `nextGradeGap`, `formatNumber`, `setMiniResult`, `armReset`
- 마크업 ID: `resultCard`, `resultLabel`, `finalValue`, `finalGrade`, `scoreFill`, `resultNote`, `resultMeta`, `formulaBox`, `formulaText`, `performanceRows`, `examRows`, `performanceCount`, `examCount`, `performanceEmpty`, `examEmpty`, `weightMeter`, `weightFill`, `weightText`, `resetBtn`, `<template id="rowTemplate">`

- [ ] **Step 1: 마크업.** page-head(eyebrow "수행평가 + 지필고사", h1 "성적 계산기", lede) 아래 `.calc` 안에 `section.card.result-card#resultCard[data-state=empty]`를 두고, 그다음 `form.input-stack#gradeForm`에 수행평가 카드, 정기고사 카드, 미터 카드(미터 + 초기화 버튼)를 넣는다. 결과 카드 안에는 `.scorebar`(구간 E 0–60 / D 60–70 / C 70–80 / B 80–90 / A 90–100, `--from`과 `--to` 인라인 변수)를 둔다. 계산기 아래 `section.note`에는 기존 SEO 문장 두 단락("수행평가·지필고사 최종점수 계산법", "A~E 등급 기준")과 `/blog/performance-exam-weight/` 링크를 넣는다. 스크립트는 `<script src="calc-core.js"></script>` 뒤에 인라인으로 둔다.

- [ ] **Step 2: 스크립트 — 상태·저장·렌더**

```js
(() => {
  const STORE = 'scoreCalc';
  const KINDS = { performance: '수행평가', exam: '정기고사' };
  const DEFAULTS = () => ({ performance: [{ score: '', weight: '20' }, { score: '', weight: '20' }], exam: [{ score: '', weight: '30' }, { score: '', weight: '30' }] });
  const $ = id => document.getElementById(id);
  const form = $('gradeForm');
  const card = $('resultCard');
  const isRow = item => item && typeof item === 'object';

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE));
      if (Array.isArray(saved?.performance) && Array.isArray(saved?.exam)) {
        const tidy = list => list.filter(isRow).slice(0, 10).map(({ score, weight }) => ({ score: String(score ?? ''), weight: String(weight ?? '') }));
        return { performance: tidy(saved.performance), exam: tidy(saved.exam) };
      }
    } catch {}
    return DEFAULTS();
  }
  let state = load();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };

  function renderRows(kind) {
    $(kind + 'Rows').replaceChildren(...state[kind].map((item, index) => {
      const row = $('rowTemplate').content.firstElementChild.cloneNode(true);
      row.querySelector('.row-name').textContent = `${index + 1}번`;
      row.querySelectorAll('input').forEach(input => {
        const field = input.dataset.field;
        input.value = item[field];
        input.dataset.kind = kind;
        input.dataset.index = index;
        input.setAttribute('aria-label', `${KINDS[kind]} ${index + 1}번 ${field === 'score' ? '점수' : '반영비율'}`);
      });
      return row;
    }));
    $(kind + 'Count').value = state[kind].length;
    $(kind + 'Empty').hidden = state[kind].length > 0;
  }
```

- [ ] **Step 3: 스크립트 — 계산과 상태 표시**

```js
  const num = text => (text === '' ? null : Number(text));
  const inRange = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 100);

  function show(stateName, { label = '내 최종점수', value = null, grade = '', note = '', meta = '', mini = '', formula = '' }) {
    const wasDone = card.dataset.state === 'done';
    card.dataset.state = stateName;
    $('resultLabel').textContent = label;
    $('finalValue').textContent = value === null ? '—' : formatNumber(value);
    $('finalGrade').hidden = !grade;
    $('finalGrade').textContent = grade;
    $('finalGrade').dataset.grade = grade;
    card.dataset.grade = grade;
    $('scoreFill').style.transform = `scaleX(${value === null ? 0 : Math.min(value, 100) / 100})`;
    $('resultNote').textContent = note;
    $('resultMeta').textContent = meta;
    $('formulaBox').hidden = !formula;
    $('formulaText').textContent = formula;
    if (stateName === 'done' && !wasDone) {
      card.classList.remove('is-fresh');
      void card.offsetWidth;
      card.classList.add('is-fresh');
    }
    setMiniResult(mini);
  }

  function renderMeter(total) {
    const ok = Math.abs(total - 100) <= 0.01;
    $('weightMeter').dataset.state = ok ? 'ok' : total > 100 ? 'over' : 'under';
    $('weightFill').style.transform = `scaleX(${Math.min(total, 100) / 100})`;
    $('weightText').textContent = ok ? '100% 맞음'
      : total > 100 ? `${formatNumber(total)}% · ${formatNumber(total - 100)}% 초과`
      : `${formatNumber(total)}% · ${formatNumber(100 - total)}% 더 필요`;
  }

  function update() {
    save();
    const rows = [...state.performance, ...state.exam].map(({ score, weight }) => ({ score: num(score), weight: num(weight) }));
    form.querySelectorAll('input[data-field]').forEach(input => input.setAttribute('aria-invalid', String(!inRange(num(input.value)))));
    const weightTotal = rows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0);
    renderMeter(weightTotal);
    const filled = rows.filter(row => row.score !== null);
    const blanks = rows.length - filled.length;
    const weightText = `반영비율 ${formatNumber(weightTotal)}% · 입력 ${filled.length}/${rows.length}`;

    if (!rows.length) return show('empty', { note: '수행평가나 정기고사를 1개 이상 추가해 주세요.' });
    if (!rows.every(row => inRange(row.score) && inRange(row.weight))) return show('warn', { note: '점수와 반영비율은 0~100 사이로 입력해 주세요.', meta: weightText });
    if (!filled.length) return show('empty', { note: '점수를 입력하면 바로 계산돼요.', meta: weightText });

    const sum = weightedSum(filled.map(row => ({ score: row.score, weight: row.weight ?? 0 })));
    if (blanks) return show('partial', { label: '지금까지 반영된 점수', value: sum, note: `빈칸 ${blanks}개 남음 · 다 채우면 최종점수가 나와요.`, meta: weightText, mini: `반영 ${formatNumber(sum)}점` });
    if (Math.abs(weightTotal - 100) > 0.01) return show('warn', { note: `반영비율 합계를 100%로 맞춰 주세요. (현재 ${formatNumber(weightTotal)}%)`, meta: weightText });

    const grade = gradeFor(sum);
    const next = nextGradeGap(sum);
    show('done', {
      value: sum,
      grade,
      note: next ? `${next.grade}까지 ${formatNumber(next.gap)}점 남았어요` : 'A등급 구간이에요',
      meta: weightText,
      mini: `${formatNumber(sum)}점 · ${grade}`,
      formula: `${rows.map(row => `${formatNumber(row.score)}×${formatNumber(row.weight)}%`).join(' + ')} = ${formatNumber(sum)}점`
    });
  }
```

- [ ] **Step 4: 스크립트 — 이벤트**

```js
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', event => {
    const { kind, index, field } = event.target.dataset;
    if (!kind || !field) return;
    state[kind][index][field] = event.target.value;
    update();
  });
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-count]');
    if (!button) return;
    const kind = button.dataset.count;
    const next = Math.min(10, Math.max(0, state[kind].length + Number(button.dataset.delta)));
    const defaults = DEFAULTS()[kind];
    while (state[kind].length < next) state[kind].push(defaults[state[kind].length] || { score: '', weight: '' });
    state[kind].length = next;
    renderRows(kind);
    update();
  });
  armReset($('resetBtn'), () => { state = DEFAULTS(); renderRows('performance'); renderRows('exam'); update(); });

  renderRows('performance');
  renderRows('exam');
  update();
})();
```

- [ ] **Step 5: 확인** — `npm test` 통과. 브라우저에서 92/88/81/86(20/20/30/30)을 넣으면 86.5·B·"A까지 3.5점 남았어요"가 나오는지, 새로고침 후 값이 유지되는지 확인.

- [ ] **Step 6: 커밋** — `git commit -m "수행·지필 계산기를 실시간 결과 중심으로 재설계"`

---

### Task 3: 목표점수 (`target-score/index.html`)

**Interfaces:** Consumes `weightedSum`, `requiredScore`, `ceil2`, `formatNumber`, `GRADE_CUTS`, `setMiniResult`, `armReset`. 저장 키 `targetCalc`.

- [ ] **Step 1: 마크업.** page-head(h1 "남은 시험에서 몇 점 받아야 할까?"). 결과 카드(`requiredValue`, `requiredNote`, `gradeTable` tbody). input-stack은 네 카드로 구성한다.
  1. 목표 카드: `.seg`(점수로/등급으로), `#scoreGoal .field > #target`, `#gradeGoal` A~E 버튼.
  2. 지금까지 본 평가: `#completedRows`, `#addCompleted`.
  3. 앞으로 볼 시험: `#remainingName`, `#remainingWeight`.
  4. 미터 + 초기화.
  기존 SEO 문장과 `/blog/target-exam-score/` 링크는 `section.note`에 둔다.

- [ ] **Step 2: 계산 로직**

```js
const GOAL = Object.fromEntries(GRADE_CUTS); // { A: 90, B: 80, C: 70, D: 60, E: 0 }

function evaluate(state) {
  const rows = state.completed
    .map(row => ({ score: row.score === '' ? null : Number(row.score), weight: row.weight === '' ? null : Number(row.weight) }))
    .filter(row => row.score !== null || row.weight !== null);          // 둘 다 빈 행은 무시
  const remaining = state.remaining.weight === '' ? null : Number(state.remaining.weight);
  const target = state.mode === 'grade' ? GOAL[state.grade] : (state.target === '' ? null : Number(state.target));
  const values = [target, remaining, ...rows.flatMap(row => [row.score, row.weight])];
  if (values.some(value => value !== null && !(Number.isFinite(value) && value >= 0 && value <= 100))) return { kind: 'range' };
  if (target === null || remaining === null || rows.some(row => row.score === null || row.weight === null)) return { kind: 'blank' };
  const total = rows.reduce((sum, row) => sum + row.weight, 0) + remaining;
  if (Math.abs(total - 100) > 0.01) return { kind: 'weight', total };
  const completed = weightedSum(rows);
  return { kind: 'ok', completed, remaining, target, answer: requiredScore(target, completed, remaining) };
}
```

결과 표시:
- `possible`: 큰 숫자 `ceil2(score)` + "{시험명}에서 {n}점 이상 받으면 돼요". 미니 결과는 "필요 {n}점".
- `reached`: 큰 숫자 0 + "이미 목표 달성! 0점을 받아도 최종 {completed}점이에요". 미니 결과는 "목표 달성".
- `impossible`: `data-state=bad` + "100점을 받아도 최종 {completed + remaining}점이에요".
- `no-remaining`: "남은 시험 비율이 0%라 계산할 수 없어요".
- 등급표: A~D 각각 `requiredScore(GOAL[g], completed, remaining)` → "{n}점" / "달성" / "불가". 등급 모드에서 선택한 행에 `.is-hit`.

- [ ] **Step 3: 저장과 복구** — `targetCalc`를 `{mode:'score'|'grade', target:string, grade:'A'..'E', completed:[{name,score,weight}], remaining:{name,weight}}`로 저장한다. 형태가 틀리면 기본값(수행평가 90/30, 중간고사 80/30, 기말고사 40, 목표 90, 모드 score)으로 복구한다.

- [ ] **Step 4: 확인** — 기본값에서 "97.5점", 목표를 100으로 올리면 불가와 "100점을 받아도 최종 91점", 목표 50이면 달성, 남은 비율 0이면 안내.

- [ ] **Step 5: 커밋** — `git commit -m "목표점수 계산기 재설계: 실시간 필요 점수와 등급별 표"`

---

### Task 4: 내신등급 (`rank/index.html`)

**Interfaces:** Consumes `rankPercentile`, `rankGrade`, `rankTier`, `rankRowStatus`, `RANK_CUTS`, `formatNumber`, `setMiniResult`, `armReset`. 저장은 `rankRows`, `rankSystem`(기존 형식).

- [ ] **Step 1: 마크업.** page-head(h1 "내신 석차등급 계산기"). 결과 카드(`avgValue`, `avgMeta`, `resultTable`). 입력은 `.seg`(9/5등급제), 과목 카드 목록 `#rows`, `#addRowBtn`, 초기화. 등급 구간 카드는 `#cutGrid .chip-grid`. note에는 기존 SEO 문장, details 2개, `/blog/rank-percentile/` 링크를 둔다. 과목 카드는 `<template>`으로 만든다: 과목명(text), 단위수·수강자·석차·동점자(number, 라벨 위), 삭제 `.icon-btn`, 상태 칩 `.row-chip`, 인라인 오류 `.row-error`.
- [ ] **Step 2: 계산.** 행마다 `rankRowStatus`를 구하고, `ok`이면 백분율, 등급, 칩("{pct}% · {g}등급", `data-grade=rankTier`)을 표시한다. `invalid`이면 "석차 + 동점자 수 − 1이 수강자 수보다 클 수 없어요"를 보여준다. 평균은 Σ(g×unit)/Σunit이고, unit이 비었거나 0 이하면 1로 친다. `ok`인 행이 없으면 empty 상태다. 미니 결과는 "평균 {avg}등급".
- [ ] **Step 3: 복구.** `rankRows`의 null/NaN은 빈칸으로 바꾼다. tie가 없으면 1. 저장값이 없으면 빈 행 1개(모바일)나 3개(데스크톱).
- [ ] **Step 4: 확인.** 200명 중 8등(동점 1)이면 4%·1등급이다. 5등급제로 바꾸면 결과가 즉시 다시 계산된다. 30명 중 29등(동점 3)이면 인라인 오류가 뜬다.
- [ ] **Step 5: 커밋** — `git commit -m "내신등급 계산기 재설계: 과목 카드와 실시간 등급"`

---

### Task 5: 학점 + GPA 환산 (`gpa/index.html`, `gpa-converter/index.html`)

**Interfaces:** Consumes `GPA_SCALES`, `gpaSummary`, `mapGrade`, `convertGpa`, `formatNumber`, `setMiniResult`, `armReset`. 저장은 `gpaRows`, `gpaScale`.

- [ ] **Step 1: 학점 마크업과 로직.** `.seg`(4.5/4.3/4.0), 과목 행(과목명·학점·`select` 성적·삭제), 결과("{gpa} / {scale}", "총 이수 n학점 · 평점 반영 n학점 · 만점 대비 n%"), 과목별 표, 평점표 칩. 만점을 바꾸면 각 행에 `mapGrade`를 적용한다. P만 있으면 "P 과목만 있어 평점을 계산할 수 없어요". note에는 기존 SEO 문장, details, `/gpa-converter/` 안내를 둔다.
- [ ] **Step 2: 환산 마크업과 로직.** 세 `.field`. 만점 두 칸 아래에 빠른 선택 칩(`button.chip[data-set-from|data-set-to]`)을 둔다. 결과는 "{x} / {to}"와 비율 막대 2개(`--ratio`)로 보여준다. null이면 warn 상태에 "GPA는 0 이상, 현재 만점 이하로 입력해 주세요". 기존 note 내용은 유지한다.
- [ ] **Step 3: 확인.** A+ 3학점과 B0 2학점이면 3.90이다. 4.3에서 A-를 입력하고 4.5로 바꾸면 A0가 된다. 환산 3.8/4.5→4.3은 3.63이다.
- [ ] **Step 4: 커밋** — `git commit -m "학점·GPA 환산 계산기 재설계"`

---

### Task 6: 급식·시간표와 학교 선택기

**Files:** Modify `neis-common.js`(`renderSchoolPicker`만 새로 작성, 나머지 API 함수는 유지). Rewrite body: `todayfood/index.html`, `todayclass/index.html`

**Interfaces:** `renderSchoolPicker(container, onReady)` 시그니처는 유지한다. 내부 DOM은 모두 `createElement`와 `textContent`로 만든다.

- [ ] **Step 1: 학교 선택기**

```js
function renderSchoolPicker(container, onReady) {
  const fromQuery = schoolFromQuery();
  if (fromQuery) saveNeisSchool(fromQuery);
  const school = fromQuery || loadNeisSchool();
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

  if (school) {
    const cardNode = el('div', 'school-card');
    const info = el('div', 'school-info');
    info.append(el('strong', '', school.schoolName), el('span', 'school-meta', school.officeName || ''));
    const actions = el('div', 'school-actions');
    const share = el('button', 'btn-ghost btn-sm', '링크 공유');
    const change = el('button', 'btn-ghost btn-sm', '학교 변경');
    share.type = change.type = 'button';
    share.onclick = async () => {
      share.textContent = (await copyText(schoolShareUrl(school))) ? '복사됨' : '복사 실패';
      setTimeout(() => { share.textContent = '링크 공유'; }, 1500);
    };
    change.onclick = () => { clearNeisSchool(); history.replaceState(null, '', location.pathname); renderSchoolPicker(container, onReady); };
    actions.append(share, change);
    cardNode.append(info, actions);
    container.replaceChildren(cardNode);
    onReady(school);
    return;
  }

  const form = el('form', 'school-search');
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
  container.replaceChildren(form, results);
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
}
```

- [ ] **Step 2: 급식 페이지.** 학교 카드, `#mealBox`(`.date-nav`: 이전 · `#dateLabel` · 다음 + `#todayBtn`), `.seg#mealTabs`(버튼은 JS가 생성하고 `aria-pressed` 사용), `#dishList`(`ul.dish-list`, textContent), `.status`(로딩, 없음, 실패), 알림 `.switch#notifyToggleBtn[aria-pressed]`와 설명. 기존 Web Push 로직(PUSH_API, VAPID 키, subscribe/unsubscribe)은 그대로 옮긴다. 지원하지 않는 브라우저에서는 알림 줄을 숨긴다. `alert()`는 알림 줄의 `.switch-hint` 문구로 바꾼다.
- [ ] **Step 3: 시간표 페이지.** 학교 카드, `.class-fields`(학년/반/학과 `.field`; `change`하면 저장하고 조회), `.seg`(일간/주간), `.date-nav`(일·주 공용 라벨), `ol.period-list`(li마다 `.period-no`와 과목 textContent), `.week-grid`(표 형태의 `table.table.week-table`, 오늘 열에 `.is-today`). 기존 fetch 함수와 저장 키를 유지한다.
- [ ] **Step 4: 확인.** 로컬에서 학교를 검색해 급식·시간표가 나오는지 확인한다. 프록시가 CORS로 막으면 실패 안내만 확인하고, 실제 동작은 배포 도메인에서 확인할 항목으로 기록한다. 콘솔 예외는 0이어야 한다.
- [ ] **Step 5: 커밋** — `git commit -m "급식·시간표와 학교 선택기 재설계, 서비스워커 등록 복구"`

---

### Task 7: 가이드 허브·글·FAQ·사용법·개인정보

**Files:** Modify `scripts/rebuild-guides.mjs`(render 템플릿). 8개 글은 재생성한다. 손으로 고칠 파일: `blog/index.html`, `blog/grade-calculation/index.html`, `blog/target-exam-score/index.html`, `faq/index.html`, `guide/index.html`, `privacy/index.html`

- [ ] **Step 1: 글 템플릿.** head는 기존 템플릿에 교체 규칙만 적용한다. body는 셸 + `main#main.page.page-narrow` > `article.prose.article` 구조로 만든다. 순서는 `a.back-link "← 계산 가이드"`, h1, `.lede`(tagline), `.updated`, `p.article-lead`(intro), 섹션, CTA, 이어서 보기, FAQ. 제목에 "공식"이 들어간 섹션은 `.formula-box`로 감싼다. seo-audit가 `<main ... class="...article...">`에서 본문을 읽으므로 `main`에도 `article` 클래스를 둔다.
- [ ] **Step 2: 재생성** — `node scripts/rebuild-guides.mjs` → "8개 가이드 재작성 완료"
- [ ] **Step 3: 손으로 쓴 글 2개와 허브.** 허브는 주제 3그룹의 정적 마크업으로 만든다. 카드 제목과 설명은 기존 `buildBlogHub`의 최종 문구를 쓴다(목표점수 카드는 "남은 시험에서 몇 점 받아야 할까?"). JSON-LD `ItemList`는 그대로 둔다.
- [ ] **Step 4: FAQ·사용법·개인정보.** FAQ는 prose + `details.faq`. 사용법은 현재 기능 기준으로 다시 쓴다: ① 도구 고르기 ② 실시간 계산과 미니 결과 ③ 비율 미터 ④ 목표점수 등급표 ⑤ 저장과 초기화 ⑥ 급식·시간표 학교 저장·공유·알림 ⑦ 다크 모드. 개인정보는 마크업만 바꾼다.
- [ ] **Step 5: 확인** — `npm test && npm run test:seo` → 100/100
- [ ] **Step 6: 커밋** — `git commit -m "가이드·FAQ·사용법·개인정보 페이지를 새 레이아웃으로 정리"`

---

### Task 8: 검증과 다듬기

- [ ] **Step 1:** `npm test && npm run test:seo` → 통과, 100/100.
- [ ] **Step 2:** 로컬 서버(`python -m http.server 8765`, 프로젝트 루트)를 띄우고 Chrome에서 390×844와 1440×900으로 계산기 5개, 급식, 시간표, 가이드 허브, 글 1개를 라이트와 다크로 스크린샷한다.
- [ ] **Step 3:** 이상 입력을 확인한다.
  - 수행·지필 점수에 150 입력 → warn과 `aria-invalid`, blur 후 100.
  - `localStorage.setItem('scoreCalc','{bad')` 후 새로고침 → 기본값.
  - `rankRows`에 null이 든 배열 → 빈칸으로 복구.
  - `gpaScale='4.5'`에 `gpaRows=[{grade:'A-',credit:3}]` → A0.
- [ ] **Step 4:** 콘솔 오류는 0이어야 한다. 도구 칩 가로 스크롤과 현재 칩 가운데 정렬, 미니 결과(모바일에서 스크롤 후 표시·탭하면 결과로 이동), 초기화 두 번 누르기, 테마 토글과 새로고침 후 유지, 가로 스크롤 없음(390px)을 확인한다.
- [ ] **Step 5:** 발견한 문제를 고치고 다시 확인한다. 커밋 — `git commit -m "리디자인 QA 수정"`
