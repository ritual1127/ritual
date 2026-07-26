# 주간 시간표 설계

## 배경

`todayclass/` 페이지는 현재 하루 단위로만 시간표를 보여준다. NEIS 시간표 API가 날짜 범위 쿼리(`TI_FROM_YMD`/`TI_TO_YMD`)를 지원하는 것을 프록시(`meister-calendar-neis-proxy.smilepea.workers.dev`)로 직접 확인했으므로, 한 번의 API 호출로 월~금 5일치 시간표를 받아올 수 있다.

## UI

- 시간표 박스(`#classBox`) 상단, 날짜 이동 UI 위에 "일간 / 주간" 토글 버튼을 추가한다.
- **일간 모드**: 기존 그대로 유지 — `◀ 날짜 ▶`로 하루씩 이동, `<ul class="period-list">`로 세로 리스트 표시.
- **주간 모드**: `◀ N주차 ▶`로 월요일 기준 한 주씩 이동. 5일(월~금)을 요일 컬럼으로 나열하는 그리드로 표시하고, 모바일 폭에서는 가로 스크롤 허용.
- 마지막으로 본 모드(`day`/`week`)는 `localStorage`(`neisTimetableMode`)에 저장해 다음 방문 시 유지한다.

## 데이터

`neis-common.js`에 함수 추가:

```
fetchNeisWeekTimetable(school, mondayYmd, fridayYmd, grade, classNum, department)
```

- 기존 `fetchNeisTimetable`과 같은 엔드포인트(`NEIS_TIMETABLE_PATH`로 초/중/고 분기)를 사용하되, `ALL_TI_YMD` 대신 `TI_FROM_YMD=mondayYmd&TI_TO_YMD=fridayYmd`를 붙인다.
- 응답 row들을 `ALL_TI_YMD` 값 기준으로 그룹핑해 `{ [ymd]: { period, subject }[] }` 형태로 반환한다.
- 학과 필터(`DDDEP_NM`)는 기존 로직과 동일하게 고등학교에서만 적용한다.
- 이번 주의 월요일 계산은 `currentDate` 기준 `getDay()`로 역산한다.

## 에러 처리

- 특정 요일에 데이터가 없으면(공휴일·재량휴업일 등) 그 요일 칸만 "정보 없음"으로 표시하고 나머지 요일은 정상 렌더링한다.
- API 호출 실패 시 기존 패턴대로 빈 배열로 처리해 "시간표 정보가 없어요" 안내를 보여준다.

## 테스트

정적 사이트라 자동화 테스트는 없음. 수동 확인 체크리스트:

- [ ] 실제 학교로 주간 토글 눌러 월~금 5일 데이터가 각 컬럼에 표시되는지
- [ ] 이전 주 / 다음 주 이동 시 올바른 주의 데이터로 갱신되는지
- [ ] 공휴일이 포함된 주에서 해당 요일만 "정보 없음"으로 표시되는지
- [ ] 일간 ↔ 주간 토글 후 새로고침해도 마지막 모드가 유지되는지
- [ ] 초/중/고 각 학교 종류에서 정상 동작하는지 (엔드포인트 분기 확인)

## 범위 밖

- 주말(토/일) 시간표 표시 — 대부분 학교에 데이터 없음, 이번 스펙에서는 제외.
- 여러 주 한번에 보기(월간 뷰) — 별도 요청 시 추후 검토.
