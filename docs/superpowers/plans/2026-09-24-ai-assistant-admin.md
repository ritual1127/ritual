# AI 도우미 · 문의하기 · 관리자 구현 계획

**Spec:** `docs/superpowers/specs/2026-09-24-ai-assistant-admin-design.md`
**브랜치:** `feat/ai-assistant-admin` → 검증 후 main 병합·푸시(사이트) + `wrangler deploy`(Worker)

## 전역 제약
- 새 라이브러리 없음. 사이트 기능·URL·SEO 메타·localStorage 키 유지.
- `npm test` 통과, `npm run test:seo` 100/100.
- CSS/JS를 바꾸면 모든 페이지와 `scripts/rebuild-guides.mjs`의 `?v=`를 올린다(이번 값 `20260924f`).
- 관리자 PIN·비밀값은 저장소에 두지 않는다(Worker secret).
- 기존 `/vote`, `/subscribe`, `/unsubscribe`, 급식 푸시 크론은 그대로 동작해야 한다.

## 리뷰 초점
1. 한글 조합 중 Enter로 질문이 두 번 가거나 잘리는 문제 → `isComposing` 검사.
2. AI 한도 초과·네트워크 오류 → 빈 말풍선이 아니라 관련 자료와 문의 안내가 나와야 한다.
3. 관리자 화면에 사용자가 쓴 문의·질문이 HTML로 해석되면 안 된다 → textContent만.
4. 휴대폰 키보드가 열려도 입력칸이 가려지지 않아야 한다.
5. PIN 무차별 대입 → IP별·전체 잠금이 실제로 걸리는지.

## 작업
1. **Worker**: `wrangler.jsonc`(D1·AI·Vectorize·rate limit), `migrations/0001_init.sql`,
   `src/index.js`(라우터·CORS·기존 기능·크론 정리), `src/track.js`(/t·/contact), `src/admin.js`(로그인·통계·문의·색인),
   `src/chat.js`(검색 합치기·스트리밍·대체 답). 순수 함수 테스트 `feedback-api/test.mjs`.
2. **엔진**: `assistant-core.js`(토큰화·BM25·다이스·규칙 의도) + `scripts/test-assistant.mjs`(npm test에 추가).
3. **지식**: `scripts/kb/*.mjs` 문답 300개 이상 + `scripts/build-kb.mjs`(사이트 본문 절 단위 조각 포함) → `assistant/kb.json`.
4. **UI**: `assistant.js`(PC 왼쪽 아래 도크, 휴대폰 메뉴 두 줄, 패널: 대화·문의), `styles.css`.
5. **통계**: `site-nav.js` 페이지뷰·첫 계산 완료 비컨.
6. **관리자**: `admin/index.html`, `admin/admin.js`.
7. **마무리**: 개인정보처리방침, robots `Disallow: /admin/`, 검사 스크립트 제외, 버전 올림, 가이드 재생성.
8. **검증·배포**: 로컬 wrangler dev + 헤드리스 크롬 QA(PC·휴대폰, 라이트·다크), D1 마이그레이션·비밀값·배포,
   지식 색인, 사이트 푸시, 실서버 확인.
