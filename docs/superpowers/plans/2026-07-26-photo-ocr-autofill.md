# 성적표 사진 OCR 자동입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성적 계산기 점수 입력 화면에 "사진으로 채우기" 버튼을 추가해, 성적표 사진을 OCR로 읽어 이미 등록된 과목의 점수 입력창을 자동으로 채운다.

**Architecture:** 새 파일 `ocr-autofill.js`에 순수 파싱/매칭 함수(OCR 텍스트 → 과목 블록 → 등록된 항목과 매칭)와 Tesseract.js 로딩/인식 래퍼를 둔다. `index.html`은 이 함수들을 불러와 버튼·파일선택·검토 모달 UI만 담당한다. 새 백엔드 없음.

**Tech Stack:** Vanilla JS, Tesseract.js(CDN 동적 로드), 기존 `.modal`/`.entry`/`.score-input`/`.mini-btn` CSS 재사용.

## Global Constraints

- 빌드 도구 없음 — 순수 HTML/CSS/JS, `<script src>`로만 로드.
- 항목 라벨 텍스트 매칭 금지 — 앱이 자동 부여하는 라벨(`수행1`, `중간고사` 등)과 실제 성적표 항목명은 겹치지 않으므로, 매칭은 반드시 "구분(지필/수행) + 등장 순서 + 비중(%)" 기준이어야 한다.
- 과목 설정은 `loadCustomSubjects()`가 반환하는 객체(`{[과목명]: {performances:[{label,weight,memo}], exams:[{label,weight}]}}`)에서 읽는다 — `index.html:208`.
- 현재 선택된 과목명은 전역 변수 `selectedSubject`, 설정은 `currentCfg` (`index.html:204-205`).
- 점수 입력창 id는 수행평가 `s${i}`, 지필평가 `t${i}` (`index.html:304, 314`). 값 정제는 기존 `sanitizeScoreInput(el)` 함수(`index.html:285`)를 그대로 재사용.
- 자동화 테스트 프레임워크 없음 — 순수 로직 함수는 Node로, UI는 브라우저 수동 확인.
- OCR 결과는 항상 검토 모달을 거친 뒤에만 실제 입력창에 반영한다 (자동 즉시반영 금지).

---

### Task 1: `ocr-autofill.js` — OCR 텍스트 파싱 + 과목 매칭 (순수 함수)

**Files:**
- Create: `ocr-autofill.js` (프로젝트 루트, `neis-common.js`와 같은 위치)

**Interfaces:**
- Consumes: 없음 (순수 함수, DOM/전역 상태 의존 없음)
- Produces:
  - `parseReportCardText(text)` → `{ subject: string|null, items: { kind: 'performance'|'exam', weight: number, score: number }[] }[]` (블록 배열)
  - `matchOcrBlockToSubject(blocks, subjectName, cfg)` → `{ performances: {index:number, label:string, weight:number, score:number|null, weightMismatch:boolean}[], exams: (같은 구조)[], countMismatch: {performances:boolean, exams:boolean} } | null`

- [ ] **Step 1: `ocr-autofill.js` 파일을 만들고 파싱 함수 작성**

```javascript
// 나이스 표준 성적표 사진 OCR 텍스트를 과목별 블록으로 분리
// 각 행 패턴: [과목(선택)] [구분:지필/수행] [항목명(비율%)] [만점] [점수]
function parseReportCardText(text) {
  const itemPattern = /(지필|수행)[^%\d]*\((\d+(?:\.\d+)?)\s*%?\)\s*([\d]+(?:\.\d+)?)\s+([\d]+(?:\.\d+)?)/;
  const subjectOnlyPattern = /^[가-힣·\s]{1,12}$/;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const blocks = [];
  let current = { subject: null, items: [] };

  lines.forEach(line => {
    const m = line.match(itemPattern);
    if (m) {
      const [, kind, weight, , score] = m;
      const prefix = line.slice(0, m.index).trim();
      if (prefix && !/[\d%()]/.test(prefix)) {
        if (current.items.length) { blocks.push(current); current = { subject: null, items: [] }; }
        current.subject = prefix;
      }
      current.items.push({ kind: kind === '지필' ? 'exam' : 'performance', weight: +weight, score: +score });
      return;
    }
    if (!/\d/.test(line) && subjectOnlyPattern.test(line)) {
      if (current.items.length) { blocks.push(current); current = { subject: null, items: [] }; }
      current.subject = line;
    }
  });
  if (current.items.length) blocks.push(current);
  return blocks;
}
```

- [ ] **Step 2: 같은 파일에 매칭 함수 추가**

```javascript
// 파싱된 블록들 중 subjectName과 일치하는 블록을 찾아, 등록된 cfg(performances/exams)와
// "구분 + 등장 순서" 기준으로 매칭한다. 항목명 텍스트는 절대 비교하지 않는다.
function matchOcrBlockToSubject(blocks, subjectName, cfg) {
  const norm = s => (s || '').replace(/\s/g, '');
  let block = blocks.find(b => b.subject && (
    norm(b.subject) === norm(subjectName) ||
    norm(b.subject).includes(norm(subjectName)) ||
    norm(subjectName).includes(norm(b.subject))
  ));
  if (!block && blocks.length === 1) block = blocks[0];
  if (!block) return null;

  const perfItems = block.items.filter(it => it.kind === 'performance');
  const examItems = block.items.filter(it => it.kind === 'exam');

  const matchList = (registered, ocrItems) => registered.map((reg, i) => {
    const ocr = ocrItems[i];
    if (!ocr) return { index: i, label: reg.label, weight: reg.weight, score: null, weightMismatch: false };
    return { index: i, label: reg.label, weight: reg.weight, score: ocr.score, weightMismatch: Math.abs(ocr.weight - reg.weight) > 1 };
  });

  return {
    performances: matchList(cfg.performances, perfItems),
    exams: matchList(cfg.exams, examItems),
    countMismatch: {
      performances: perfItems.length !== cfg.performances.length,
      exams: examItems.length !== cfg.exams.length
    }
  };
}
```

- [ ] **Step 3: Node로 실제 성적표 샘플 텍스트를 이용해 검증**

`ocr-autofill.js` 맨 아래에 임시로 아래 스크립트를 추가해 실행 후 삭제한다 (파일에 영구히 남기지 않음 — 검증 후 Step 4에서 제거):

```javascript
if (typeof module !== 'undefined') {
  const sample = `
역사
지필 1회고사(20.00%) 100.00 97.00
지필 2회고사(20.00%) 100.00 96.00
수행 NIE 포트폴리오(30.00%) 100.00 100.00
수행 추체험 학습(15.00%) 100.00 100.00
수행 논술형 평가(15.00%) 100.00 100.00
수학
지필 1회고사(30.00%) 100.00 92.30
지필 2회고사(30.00%) 100.00 100.00
수행 단원마무리활동(20.00%) 100.00 96.00
수행 학습결과물(10.00%) 100.00 100.00
수행 수업참여도(10.00%) 100.00 100.00
`;
  const blocks = parseReportCardText(sample);
  console.log('blocks:', JSON.stringify(blocks, null, 2));

  const cfg = {
    performances: [{ label: '수행1', weight: 30 }, { label: '수행2', weight: 15 }, { label: '수행3', weight: 15 }],
    exams: [{ label: '중간고사', weight: 20 }, { label: '기말고사', weight: 20 }]
  };
  const match = matchOcrBlockToSubject(blocks, '역사', cfg);
  console.log('역사 match:', JSON.stringify(match, null, 2));
  console.assert(match.exams[0].score === 97, '지필1 점수는 97이어야 함');
  console.assert(match.exams[1].score === 96, '지필2 점수는 96이어야 함');
  console.assert(match.performances[0].score === 100, '수행1 점수는 100이어야 함');
  console.assert(match.countMismatch.performances === false, '역사는 개수 일치해야 함');

  const mathCfg = { performances: [{ label: '수행1', weight: 20 }], exams: [{ label: '중간고사', weight: 30 }, { label: '기말고사', weight: 30 }] };
  const mathMatch = matchOcrBlockToSubject(blocks, '수학', mathCfg);
  console.assert(mathMatch.exams[0].score === 92.3, '수학 지필1 점수는 92.3이어야 함');
  console.assert(mathMatch.countMismatch.performances === true, '수학은 수행 개수가 등록(1)보다 사진(3)이 많아 mismatch여야 함');

  console.log('OK: all assertions passed (no output above means pass, console.assert only logs on failure)');
}
```

Run: `node ocr-autofill.js`
Expected: 콘솔에 `blocks`, `match` JSON이 출력되고, `console.assert` 실패 메시지가 하나도 안 뜨면 통과.

- [ ] **Step 4: 임시 검증 스크립트 제거, 브라우저에서 쓸 전역 함수만 남기기**

Step 3에서 추가한 `if (typeof module !== 'undefined') { ... }` 블록 전체를 삭제한다. 최종 `ocr-autofill.js`에는 `parseReportCardText`와 `matchOcrBlockToSubject` 두 함수 선언만 남는다 (다음 Task에서 이 파일에 계속 추가함).

- [ ] **Step 5: 커밋**

```bash
git add ocr-autofill.js
git commit -m "feat: 성적표 OCR 텍스트 파싱/매칭 순수 함수 추가"
```

---

### Task 2: `ocr-autofill.js` — Tesseract.js 로딩 및 인식 래퍼

**Files:**
- Modify: `ocr-autofill.js` (Task 1에서 만든 파일 하단에 추가)

**Interfaces:**
- Consumes: 브라우저 전역 `window.Tesseract` (CDN 스크립트가 채움), Task 1의 함수들과 독립적
- Produces:
  - `loadTesseractScript()` → `Promise<void>` (이미 로드됐으면 즉시 resolve, 실패 시 reject)
  - `recognizeReportCard(file)` → `Promise<string>` (OCR 원문 텍스트)

- [ ] **Step 1: `ocr-autofill.js` 끝에 추가**

```javascript
let tesseractLoadPromise = null;
function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => { tesseractLoadPromise = null; reject(new Error('tesseract-load-failed')); };
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

async function recognizeReportCard(file) {
  await loadTesseractScript();
  const result = await Tesseract.recognize(file, 'kor+eng');
  return result.data.text;
}
```

- [ ] **Step 2: 로컬 정적 서버로 브라우저 콘솔에서 로딩 확인**

```bash
cd "성적계산기 프로젝트 루트"
python -m http.server 8791
```

브라우저에서 `http://localhost:8791/index.html` 열고 개발자 콘솔에서:

```javascript
loadTesseractScript().then(() => console.log('Tesseract 로드됨:', typeof Tesseract))
```

기대 결과: `Tesseract 로드됨: object` (또는 `function`)가 찍혀야 한다. 실제 이미지 인식 테스트는 Task 4에서 전체 UI가 연결된 뒤 진행한다 (여기서는 로딩만 확인).

- [ ] **Step 3: 커밋**

```bash
git add ocr-autofill.js
git commit -m "feat: Tesseract.js 동적 로딩 및 OCR 인식 래퍼 추가"
```

---

### Task 3: 검토 모달 CSS 추가

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: 기존 `--inp-border`, `--fg` 변수
- Produces: CSS 클래스 `.ocr-warn-banner`, `.ocr-review-section h3` (Task 4에서 사용)

- [ ] **Step 1: `styles.css` 파일 끝에 추가**

```css
.ocr-warn-banner {
  background: rgba(245,158,11,0.12); border: 1px solid #f59e0b; color: #f59e0b;
  border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px;
}
.ocr-review-section h3 { font-size: 15px; margin: 14px 0 8px; color: var(--fg); }
```

(버튼은 기존 `.mini-btn`, 점수 입력창은 기존 `.entry`/`.score-input`, 모달 틀은 기존 `.modal`/`.modal-content`를 그대로 재사용하므로 이 두 클래스만 추가하면 된다.)

- [ ] **Step 2: 커밋**

```bash
git add styles.css
git commit -m "feat: OCR 검토 모달용 경고 배너 CSS 추가"
```

---

### Task 4: `index.html` UI 연결 (버튼 · 파일선택 · 검토모달 · 적용)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `parseReportCardText`, `matchOcrBlockToSubject`, `recognizeReportCard` (Task 1-2), `.ocr-warn-banner`/`.ocr-review-section` (Task 3), 기존 `selectedSubject`, `currentCfg`, `sanitizeScoreInput`, `saveDraft`
- Produces: 없음 (최종 페이지)

- [ ] **Step 1: `subjectModal` 뒤(158번째 줄 근처, `</div>` 다음)에 OCR 모달과 숨김 파일 입력 추가**

```html
  <div id="ocrModal" class="modal">
    <div class="modal-content">
      <button id="ocrModalCloseBtn" class="modal-close-btn">✕</button>
      <h2 style="margin-bottom:16px;">사진 인식 결과 확인</h2>
      <div id="ocrModalBody"></div>
      <button type="button" class="btn" id="ocrApplyBtn" style="display:none;">적용</button>
    </div>
  </div>
  <input type="file" id="ocrFileInput" accept="image/*" capture="environment" style="display:none;">
```

- [ ] **Step 2: `<script src="ocr-autofill.js"></script>`를 메인 `<script>` 태그 바로 앞에 추가**

기존 `index.html`의 `<script>` (약 200번째 줄, `const IF_SCENARIOS = ...`로 시작하는 줄) 바로 위에 삽입:

```html
  <script src="ocr-autofill.js"></script>
  <script>
```

- [ ] **Step 3: `renderScoreInputs()`에 OCR 버튼 추가**

기존:
```javascript
      let html = `<h2 style="margin-bottom:12px;">${selectedSubject}</h2><h2 style="font-size:16px;margin-bottom:12px;">수행평가</h2>`;
```

교체 후:
```javascript
      let html = `<h2 style="margin-bottom:12px;">${selectedSubject}</h2>`;
      html += `<button type="button" class="mini-btn" id="ocrTriggerBtn" style="margin-bottom:12px;">📷 사진으로 채우기 (베타)</button>`;
      html += '<h2 style="font-size:16px;margin-bottom:12px;">수행평가</h2>';
```

같은 함수의 `box.innerHTML = html;` 바로 다음 줄(기존 `box.querySelectorAll('.score-input')...` 줄 앞)에 추가:

```javascript
      document.getElementById('ocrTriggerBtn').onclick = () => document.getElementById('ocrFileInput').click();
```

- [ ] **Step 4: OCR 검토 렌더링 + 파일 선택 + 적용 로직을 `toggleIfMode` 함수 다음에 추가**

```javascript
    function renderOcrReview(match) {
      const body = document.getElementById('ocrModalBody');
      let html = '';
      if (match.countMismatch.performances) {
        html += `<div class="ocr-warn-banner">⚠️ 수행평가 개수가 등록(${currentCfg.performances.length}개)과 사진 인식 결과가 달라요 — 순서대로 매칭했으니 확인해주세요.</div>`;
      }
      if (match.countMismatch.exams) {
        html += `<div class="ocr-warn-banner">⚠️ 지필평가 개수가 등록(${currentCfg.exams.length}개)과 사진 인식 결과가 달라요 — 순서대로 매칭했으니 확인해주세요.</div>`;
      }
      html += '<div class="ocr-review-section"><h3>수행평가</h3>';
      match.performances.forEach(p => {
        html += `<div class="entry">
          <label>${p.label} (${p.weight}%)${p.weightMismatch ? ' <span style="color:#f59e0b;">⚠️ 비중 다름</span>' : ''}</label>
          <input type="text" inputmode="decimal" class="score-input ocr-score" data-kind="s" data-i="${p.index}" value="${p.score !== null ? p.score : ''}" placeholder="점수">
        </div>`;
      });
      html += '</div><div class="ocr-review-section"><h3>지필평가</h3>';
      match.exams.forEach(ex => {
        html += `<div class="entry">
          <label>${ex.label} (${ex.weight}%)${ex.weightMismatch ? ' <span style="color:#f59e0b;">⚠️ 비중 다름</span>' : ''}</label>
          <input type="text" inputmode="decimal" class="score-input ocr-score" data-kind="t" data-i="${ex.index}" value="${ex.score !== null ? ex.score : ''}" placeholder="점수">
        </div>`;
      });
      html += '</div>';
      body.innerHTML = html;
      body.querySelectorAll('.ocr-score').forEach(inp => inp.addEventListener('input', () => sanitizeScoreInput(inp)));
      document.getElementById('ocrApplyBtn').style.display = 'block';
    }

    document.getElementById('ocrApplyBtn').onclick = () => {
      document.querySelectorAll('#ocrModalBody .ocr-score').forEach(inp => {
        if (!inp.value) return;
        const target = document.getElementById(`${inp.dataset.kind}${inp.dataset.i}`);
        if (target) target.value = inp.value;
      });
      document.getElementById('ocrModal').style.display = 'none';
      saveDraft();
    };
    document.getElementById('ocrModalCloseBtn').onclick = () => document.getElementById('ocrModal').style.display = 'none';
    document.getElementById('ocrModal').addEventListener('click', (e) => {
      if (e.target.id === 'ocrModal') document.getElementById('ocrModal').style.display = 'none';
    });

    document.getElementById('ocrFileInput').onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file || !currentCfg) return;
      const body = document.getElementById('ocrModalBody');
      document.getElementById('ocrApplyBtn').style.display = 'none';
      body.innerHTML = '<div class="empty-hint">인식 중...</div>';
      document.getElementById('ocrModal').style.display = 'flex';
      try {
        const text = await recognizeReportCard(file);
        const blocks = parseReportCardText(text);
        const match = matchOcrBlockToSubject(blocks, selectedSubject, currentCfg);
        if (!match) {
          body.innerHTML = '<div class="empty-hint">사진에서 글자를 인식하지 못했어요. 더 밝은 곳에서 정면으로 다시 찍어보세요.</div>';
          return;
        }
        renderOcrReview(match);
      } catch (err) {
        body.innerHTML = '<div class="empty-hint">OCR 엔진을 불러오지 못했어요. 인터넷 연결을 확인하거나 직접 입력해주세요.</div>';
      }
    };
```

- [ ] **Step 5: 브라우저 수동 확인**

로컬 정적 서버(`python -m http.server 8791`)로 `index.html`을 열고:

1. "과목 등록/관리"로 지필 2개 + 수행 3개짜리 과목을 실제 성적표와 같은 비중(예: 지필 20/20, 수행 30/15/15)으로 등록
2. 해당 과목 선택 → "📷 사진으로 채우기 (베타)" 버튼이 보이는지
3. 실제 성적표 사진(나이스 양식)을 선택 → "인식 중..." 표시 후 검토 모달에 항목별 점수가 채워지는지
4. 검토 모달에서 값 하나를 수정한 뒤 "적용" → 실제 점수 입력창(`s0`, `t0` 등)에 반영되는지
5. 등록 개수와 사진 인식 개수를 일부러 다르게 해서(예: 수행 1개만 등록) 경고 배너가 뜨는지
6. 모달 우측 상단 ✕ 또는 바깥 클릭으로 닫으면 입력값이 바뀌지 않는지
7. 글자 없는 사진(흰 배경만 촬영)으로 시도 시 실패 안내 문구가 뜨는지
8. 기기의 인터넷을 끄고 시도 시 "OCR 엔진을 불러오지 못했어요" 안내가 뜨는지 (Tesseract CDN 로드 실패)

- [ ] **Step 6: 커밋**

```bash
git add index.html
git commit -m "feat: 성적표 사진 OCR 자동입력 UI 연결"
```

---

## Self-Review

**스펙 커버리지:**
- 트리거 버튼 + 파일 선택 → Task 4 Step 1, 3
- Tesseract 동적 로드(CDN, 최초 클릭 시점) → Task 2
- 구분+순서+비중 매칭(항목명 텍스트 매칭 아님) → Task 1 Step 2
- 과목명 텍스트 매칭 → Task 1 Step 2 (`matchOcrBlockToSubject`의 `norm(...)` 비교)
- 개수 불일치 경고 배너 → Task 4 Step 4 (`countMismatch`)
- 비중 불일치 힌트(±1%p) → Task 1 Step 2 (`weightMismatch`), Task 4 Step 4에서 렌더
- 검토 모달에서 수정 후 적용 → Task 4 Step 4
- 에러 처리(로드 실패/인식 실패) → Task 4 Step 4 catch 블록 + `!match` 분기
- 수동 테스트 체크리스트 7개 항목 → Task 4 Step 5 (스펙 체크리스트 전부 포함)

**타입/시그니처 일관성:** `parseReportCardText`가 반환하는 블록 구조(`{subject, items:[{kind, weight, score}]}`)와 `matchOcrBlockToSubject`가 받는 인자가 Task 1 안에서 일관됨. `matchOcrBlockToSubject`의 반환 구조(`{performances, exams, countMismatch}`)를 Task 4의 `renderOcrReview`가 그대로 사용 — 필드명(`index`, `label`, `weight`, `score`, `weightMismatch`) 일치 확인.

**범위 밖 항목:** 스펙의 "항목명 텍스트 매칭 불가", "새 과목 자동 등록", "손글씨 인식"은 이 플랜에 포함하지 않음 — 의도된 범위 밖.
