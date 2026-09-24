# 모션 & 편의 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 실행 방식: 사용자가 "끝까지 자동 진행"을 골랐다. 작성자가 이 세션에서 executing-plans로 직접 실행한다. 로직과 공용 헬퍼는 아래 코드가 정본이다. 페이지 연결은 각 Task의 체크리스트를 따르고, headless Chrome QA로 검증한다.

**Goal:** 결과 숫자 롤링, 등급 도장, 달성 축하, 손글씨 낙서, 결과 카드 초기화와 되돌리기 알림, 비율 빠른 채우기, 만약에 슬라이더를 "노트 & 형광펜" 톤에 맞춰 추가한다.

**Architecture:** 공용 모션과 알림 헬퍼는 `site-nav.js`에 둔다. 새 순수 함수 두 개(`splitWeights`, `projectedScore`)는 `calc-core.js`에 넣고 Node 테스트로 검증한다. 스타일은 `styles.css`, 페이지별 연결은 각 계산기의 인라인 스크립트가 맡는다.

**Tech Stack:** Vanilla JS(Web Animations API, CSS animations), 기존 정적 사이트.

**Spec:** `docs/superpowers/specs/2026-09-24-motion-convenience-design.md`

## Global Constraints

- 새 라이브러리와 효과음은 없다. `prefers-reduced-motion: reduce`이면 움직임, 종이 조각, 진동을 모두 끈다.
- 제목(h1, LCP 후보)에는 등장 애니메이션을 걸지 않는다. 낙서 밑줄만 그린다.
- 축하(종이 조각 + 진동)는 사용자 입력으로 조건에 **들어가는 순간**에만 한다. 첫 렌더에서는 스티커만 조용히 보여준다.
- 모든 계산기 결과 카드 머리줄에 `초기화` 버튼을 둔다. 누르면 즉시 실행하고 되돌리기 알림을 띄운다. `armReset`은 제거한다.
- 기존 저장 키와 형식, SEO 메타는 유지한다. `npm test` 통과, SEO 100/100.
- 외부나 사용자 값을 DOM에 넣을 때는 `textContent`만 쓴다. `insertAdjacentHTML`은 고정 문자열인 SVG에만 허용한다.

## Review Focus

1. **빠르게 입력할 때 롤링**: 키를 연달아 누르면 이전 전환 중에 새 값이 들어온다. 최종 표시와 `data-value`, sr 텍스트가 마지막 값과 같아야 한다.
2. **되돌리기 뒤 상태 일관성**: 초기화 → 입력 → 되돌리기 순서여도 알림이 가리키는 직전 상태로 정확히 돌아와야 하고, 저장값도 같이 복원돼야 한다.
3. **축하 반복**: A 상태에서 점수를 조금씩 바꿔도 종이 조각이 다시 터지면 안 된다. A를 벗어났다가 다시 들어올 때만 터진다.
4. **좁은 화면 겹침**: 360px에서 스티커, 초기화 버튼, 등급 배지, 숫자가 서로 겹치지 않아야 한다.
5. **reduced-motion**: 종이 조각 0개, 진동 없음. 롤링과 도장은 즉시 최종 상태로 보인다.

---

### Task 1: 순수 함수 — `splitWeights`, `projectedScore`

**Files:** Modify `calc-core.js`, `scripts/test-calc.mjs`

- [ ] **Step 1: 실패 테스트 추가** (`test-calc.mjs`의 export 목록에 두 함수를 넣고)

```js
// 비율 빠른 채우기: 합이 정확히 total이 되도록 나머지는 마지막 칸에
assert.deepEqual(plain(c.splitWeights(40, 3)), [13.33, 13.33, 13.34]);
assert.deepEqual(plain(c.splitWeights(60, 2)), [30, 30]);
assert.deepEqual(plain(c.splitWeights(100, 1)), [100]);
assert.deepEqual(plain(c.splitWeights(50, 0)), []);
assert.equal(c.splitWeights(70, 3).reduce((a, b) => a + b, 0).toFixed(2), '70.00');
// 만약에 슬라이더
assert.equal(c.projectedScore(51, 40, 97.5), 90);
assert.equal(c.projectedScore(51, 40, 100), 91);
assert.equal(c.projectedScore(51, 40, 0), 51);
```

- [ ] **Step 2:** `node scripts/test-calc.mjs` → `ReferenceError: splitWeights is not defined`
- [ ] **Step 3: 구현**

```js
// 비율을 칸 수로 나눈다. 소수 둘째 자리까지, 합이 total에서 어긋나지 않게 나머지는 마지막 칸에 준다.
function splitWeights(total, count) {
  if (!(count > 0)) return [];
  const base = Math.floor(total / count * 100) / 100;
  const out = Array(count).fill(base);
  out[count - 1] = roundFloat(total - base * (count - 1));
  return out;
}

function projectedScore(completedScore, remainingWeight, examScore) {
  return roundFloat(completedScore + examScore * remainingWeight / 100);
}
```

- [ ] **Step 4:** `npm test` → 통과
- [ ] **Step 5:** 커밋 `비율 나누기·예상 점수 계산 함수 추가`

### Task 2: 공용 모션·알림 헬퍼와 스타일

**Files:** Modify `site-nav.js`, `styles.css`

**Produces(전역):** `rollNumber(el, text)`, `stampIn(el)`, `celebrate(card)`, `setSticker(card, text, animate)`, `showToast(message, { action, onAction })`. 로드 시 제목 낙서를 주입한다. `armReset`은 제거한다.

- [ ] **Step 1: `site-nav.js`에 헬퍼 추가, `armReset` 제거**

```js
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // 결과 숫자를 슬롯머신처럼 굴린다. 보이지 않는 원문이 너비·기준선을, 롤 레이어가 움직임을, sr-only가 읽기를 맡는다.
  window.rollNumber = (el, text) => {
    if (el.dataset.value === text) return;
    el.dataset.value = text;
    const shape = text.replace(/\d/g, '0');
    let roll = el.querySelector(':scope > .roll');
    if (!roll || roll.dataset.shape !== shape) {
      roll = make('span', 'roll');
      roll.dataset.shape = shape;
      const ghost = make('span', 'roll-ghost');
      const layer = make('span', 'roll-layer');
      ghost.setAttribute('aria-hidden', 'true');
      layer.setAttribute('aria-hidden', 'true');
      let column = 0;
      for (const ch of text) {
        if (!/\d/.test(ch)) { layer.append(make('span', 'roll-char', ch)); continue; }
        const strip = make('span', 'roll-strip');
        strip.style.setProperty('--i', column++);
        strip.append(...[...'0123456789'].map(digit => make('span', '', digit)));
        const col = make('span', 'roll-col');
        col.append(strip);
        layer.append(col);
      }
      roll.append(ghost, layer, make('span', 'sr-only'));
      el.replaceChildren(roll);
      void roll.offsetWidth; // 새 띠는 0에서 굴러 들어오도록 첫 위치를 확정한다
    }
    roll.querySelector('.roll-ghost').textContent = text;
    roll.querySelector('.sr-only').textContent = text;
    const digits = [...text].filter(ch => /\d/.test(ch));
    roll.querySelectorAll('.roll-strip').forEach((strip, i) => { strip.style.transform = `translateY(calc(var(--roll-h) * -${digits[i]}))`; });
  };

  window.stampIn = el => {
    el.classList.remove('is-stamp');
    void el.offsetWidth;
    el.classList.add('is-stamp');
  };

  // 결과 옆 빨간 인주 스티커. 빈 문자열이면 숨긴다.
  window.setSticker = (card, text, animate) => {
    let sticker = card.querySelector('.sticker');
    if (!text) { if (sticker) sticker.hidden = true; return; }
    if (!sticker) {
      sticker = make('span', 'sticker');
      sticker.setAttribute('aria-hidden', 'true');
      card.querySelector('.result-main').append(sticker);
    }
    const changed = sticker.hidden || sticker.textContent !== text;
    sticker.textContent = text;
    sticker.hidden = false;
    if (animate && changed) stampIn(sticker);
  };

  const CONFETTI = ['--hl', '--primary', '--gA', '--gB', '--gC', '--gD'];
  window.celebrate = card => {
    if (reduceMotion()) return;
    navigator.vibrate?.(18);
    const box = (card.querySelector('.result-main') || card).getBoundingClientRect();
    const colors = getComputedStyle(document.documentElement);
    const layer = make('div', 'confetti');
    layer.setAttribute('aria-hidden', 'true');
    const x0 = box.left + box.width / 2, y0 = box.top + box.height / 2;
    let longest = 0;
    for (let i = 0; i < 26; i++) {
      const piece = make('i');
      Object.assign(piece.style, {
        left: `${x0}px`, top: `${y0}px`,
        width: `${6 + Math.random() * 6}px`, height: `${8 + Math.random() * 10}px`,
        background: colors.getPropertyValue(CONFETTI[i % CONFETTI.length]).trim(),
        borderRadius: i % 5 === 0 ? '50%' : '2px'
      });
      layer.append(piece);
      const angle = (-165 + Math.random() * 150) * Math.PI / 180;
      const dist = 90 + Math.random() * 130;
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
      const spin = (Math.random() - .5) * 900;
      const duration = 1100 + Math.random() * 450;
      longest = Math.max(longest, duration);
      piece.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: .45 },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy + 260}px)) rotate(${spin}deg)`, opacity: 0 }
      ], { duration, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' });
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), longest + 120);
  };

  // 되돌리기 알림: 한 번에 하나, 상단바 아래, 5초 뒤 사라진다.
  let toast = null, toastTimer = 0;
  window.showToast = (message, { action, onAction } = {}) => {
    if (!toast) {
      toast = make('div', 'toast');
      toast.setAttribute('role', 'status');
      document.body.append(toast);
    }
    clearTimeout(toastTimer);
    const hide = () => toast.classList.remove('is-shown');
    toast.replaceChildren(make('span', '', message));
    if (action) {
      const button = make('button', '', action);
      button.type = 'button';
      button.addEventListener('click', () => { hide(); onAction(); });
      toast.append(button);
    }
    toast.classList.add('is-shown');
    toastTimer = setTimeout(hide, 5000);
  };

  // 제목 아래 펜 낙서 밑줄. 고정 SVG 문자열만 넣는다.
  function doodle() {
    document.querySelectorAll('.page-head h1, .prose h1').forEach(h1 => {
      h1.insertAdjacentHTML('beforeend', '<svg class="doodle" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M2 9.5C28 4 52 12.5 82 8.5S140 3.5 168 7.5 194 10 198 7"/></svg>');
    });
  }
```

`init()`에서 `doodle()`을 호출한다.

- [ ] **Step 2: `styles.css`** — 롤(`--roll-h:1.08em`, 원문 `visibility:hidden`, 레이어 절대 배치, 띠 0.6s 탄성 전환 + 자리별 40ms), 도장(`--tilt` 변수 keyframes, 잉크 테), 스티커(64px 원, `--gE` 인주색, -12°), 종이 조각(fixed 레이어), 알림(top 72px, 가운데, 잉크 배경), 낙서(`stroke-dashoffset` 그리기), 카드 등장(`paper-in`, nth-child 시차, `prefers-reduced-motion: no-preference` 안에서만), 새 행(`is-new` → `row-in`), 결과 머리줄(`.result-head`), 슬라이더(`.range`, `--pct` 채움, 28px 손잡이), 만약에 블록과 눈금.
- [ ] **Step 3:** `node --check site-nav.js && npm test`
- [ ] **Step 4:** 커밋 `공용 모션·알림 헬퍼와 스타일 추가`

### Task 3: 수행·지필 (`index.html`)

- [ ] 결과 카드 머리줄: `<div class="result-head"><p class="result-label" id="resultLabel">…</p><button id="resetBtn" class="btn-ghost btn-sm reset-btn">↺ 초기화</button></div>`. 아래쪽 초기화 버튼은 빼고 안내 문구만 남긴다.
- [ ] 폼 맨 위에 "반영비율 빠른 선택" 카드(칩 `data-preset` 20/30/40/50, `aria-pressed`)를 두고 `applyPreset`에서 `splitWeights`를 쓴다.
- [ ] 비율 카드에 `#fillRestBtn`(비율 빈칸이 정확히 1개이고 합 < 100일 때만 보임)을 둔다.
- [ ] `show()`: 숫자는 `rollNumber(finalValue, text)`. 등급이 바뀌면 `stampIn(badge)`. A에 새로 들어오면 `celebrate` + `setSticker('참 잘했어요', true)`. A가 아니면 스티커를 숨긴다. 첫 렌더에서는 조각 없이 스티커만.
- [ ] 초기화: 직전 상태 JSON을 보관하고 즉시 기본값으로 바꾼 뒤 `showToast('입력을 초기화했어요', 되돌리기)`.
- [ ] 스테퍼 −로 점수가 있는 행이 지워지면 알림으로 복원할 수 있게 한다. 스테퍼 +와 복원된 행에는 `is-new`.
- [ ] QA: 프리셋 40:60(3+2행) → 13.33/13.33/13.34/30/30, 남은 % 채우기, A 진입 시 조각과 스티커, 재방문 시 스티커만, 초기화 → 되돌리기 복원, 스테퍼 − 되돌리기, 기존 스위트(`data-value` 기준).
- [ ] 커밋 `수행·지필: 롤링·도장·축하, 비율 빠른 채우기, 초기화 되돌리기`

### Task 4: 목표점수 (`target-score/index.html`)

- [ ] 결과 머리줄 초기화 + 되돌리기. `rollNumber(requiredValue)`. `reached`에 새로 들어오면 축하 + 스티커 `목표 달성`.
- [ ] 만약에 블록(`#whatIf`): 라벨, `input[type=range]#whatIfRange`, 눈금 `#whatIfTicks`, 결과 `최종 X점` + 등급 칩. `projectedScore`로 계산하고, 사용자가 움직이기 전에는 필요 점수를 올림한 값을 따른다. `aria-valuetext`를 넣는다.
- [ ] 비율 카드에 `#fillRemainingBtn`(`남은 시험 비율을 N%로 맞추기`)을 둔다.
- [ ] 행 삭제 되돌리기(같은 위치로 복원), 행 추가 시 `is-new`.
- [ ] QA: 슬라이더 100이면 최종 91 B, 슬라이더 97이면 89.8 B, 남은 비율 버튼, 삭제 → 되돌리기, 달성 축하, 기존 스위트.
- [ ] 커밋 `목표점수: 만약에 슬라이더, 남은 비율 맞추기, 롤링·축하, 되돌리기`

### Task 5: 내신등급·학점·GPA 환산

- [ ] 세 페이지 모두 결과 머리줄에 초기화와 되돌리기를 넣고 숫자는 `rollNumber`로 바꾼다. 환산은 기본값 3.8/4.5/4.3으로 초기화한다.
- [ ] 내신: 평균이 1.5 미만에 새로 들어오면 축하 + `1등급`. 학점: 만점 대비 90% 이상에 새로 들어오면 축하 + `참 잘했어요`.
- [ ] 내신과 학점의 행 삭제 되돌리기, 추가 시 `is-new`.
- [ ] QA: 각 축하 조건, 초기화 → 되돌리기, 삭제 → 되돌리기, 기존 스위트.
- [ ] 커밋 `내신·학점·환산: 롤링·축하·초기화 되돌리기`

### Task 6: 검증

- [ ] 모든 QA 스위트(`data-value`와 새 초기화 흐름으로 갱신), `reduced-motion`에서 조각 0개, 360/390/1440 라이트·다크 스크린샷(360에서 겹침 없음), 콘솔 오류 0, `npm test`, SEO 100/100.
- [ ] 리뷰 후 커밋 `모션·편의 기능 QA 수정`(필요할 때).
