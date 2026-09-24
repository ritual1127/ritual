# 미니멀 도구 + 리퀴드 글래스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 작성자가 이 세션에서 직접 실행한다(사용자는 "검증 후 바로 배포"를 골랐다).

**Goal:** 형광펜 하나만 포인트로 남긴 미니멀 도구 스타일로 바꾸고, 상단 조작부를 떠 있는 리퀴드 글래스 캡슐로 만든 뒤 naver1.cloud에 배포한다.

**Spec:** `docs/superpowers/specs/2026-09-24-minimal-glass-design.md`

## Global Constraints
- 기능, URL, SEO 메타, 저장 키, 롤링과 축하 모션은 유지한다. `npm test` 통과, SEO 100/100.
- 도구 링크 7개는 모든 페이지의 `<nav aria-label="도구">`에 DOM으로 남긴다.
- 새 라이브러리는 없다. 글래스는 `backdrop-filter`로 만들고, 지원하지 않는 브라우저에서는 반투명 종이색으로 대신한다.

## Review Focus
1. 모바일 도구 메뉴: 열기, Esc, 바깥 클릭, 링크 이동 뒤 상태와 `aria-expanded`가 맞는지.
2. 캡슐 안 미니 결과: 390px에서 로고, 메뉴, 미니 결과, 토글이 겹치거나 넘치지 않는지.
3. 등급 색을 걷어낸 뒤에도 정보가 전달되는지. 등급은 문자로 항상 표시된다.
4. 상자를 걷어낸 뒤 섹션 경계가 보이는지(가는 선과 여백).
5. 다크 모드에서 글래스 대비와 가독성.

### Task 1: 글래스 캡슐 헤더
- 파이썬 스크립트로 22곳(`index.html` 21개 + `rebuild-guides.mjs`)의 `appbar` + `toolnav` 마크업을 새 캡슐 마크업으로 교체한다. 메뉴 버튼 라벨은 각 페이지의 `aria-current` 도구명, 없으면 "도구".
- `site-nav.js`: `setupToolMenu()`(토글, Esc, 바깥 클릭)을 추가하고, `setupToolnav()`와 `doodle()`은 제거한다.
- CSS: `.appbar`(sticky 투명 래퍼), `.glass`(토큰, 하이라이트, 윤광), `.tools`(모바일 팝오버, 데스크톱 인라인 탭), `.tool-menu-btn`, 캡슐 안 미니 결과.
- QA: 메뉴 동작, 데스크톱 탭, `backdrop-filter` 적용.

### Task 2: 미니멀 스타일
- `styles.css`: 점 격자 제거, 카드를 평평하게, 칩과 세그먼트를 텍스트와 형광펜으로, 등급 색 중립화, 입력칸 밑줄만, 설명·글·허브·NEIS·푸터 평평하게, 알림 글래스, 낙서와 종이 등장 스타일 제거.

### Task 3: 문구 정리
- 윗제목, 페이지 설명 줄, 카드 부제, 저장 안내, 링크 화살표를 제거하고, 학교 선택기 문구를 줄인다(`neis-common.js`).
- `rebuild-guides.mjs`를 반영하고 글을 다시 생성한다.

### Task 4: 검증
- QA 스위트를 새 선택자에 맞게 갱신해 전부 통과시킨다. 360·390·1440 라이트·다크 스크린샷을 찍고 겹침과 가로 스크롤을 점검한다.

### Task 5: 배포
- main에 fast-forward로 합치고 push한다. Pages 빌드가 끝나면 라이브 해시와 스모크 테스트를 확인한다.
