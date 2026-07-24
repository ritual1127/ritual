<div align="center">

![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=성적%20계산기&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38)

[![Typing SVG](https://readme-typing-svg.demolab.com/?font=Pretendard&weight=600&size=22&pause=1000&color=4F46E5&center=true&vCenter=true&width=560&lines=%EC%88%98%ED%96%89%ED%8F%89%EA%B0%80+%2B+%EC%A7%80%ED%95%84%EA%B3%A0%EC%82%AC+%3D+%ED%95%9C+%EB%B2%88%EC%97%90+%EA%B3%84%EC%82%B0;%EB%AA%A9%ED%91%9C+%EB%93%B1%EA%B8%89%EA%B9%8C%EC%A7%80+%ED%95%84%EC%9A%94%ED%95%9C+%EC%A0%90%EC%88%98+%EC%9E%90%EB%8F%99+%EA%B3%84%EC%82%B0;%EC%98%A4%EB%8A%98%EC%9D%98+%EA%B8%89%EC%8B%9D%2C+%EC%8B%9C%EA%B0%84%ED%91%9C%EA%B9%8C%EC%A7%80+%ED%95%9C+%EA%B3%B3%EC%97%90%EC%84%9C)](https://naver1.cloud)

[![Website](https://img.shields.io/badge/site-naver1.cloud-4F46E5?style=for-the-badge)](https://naver1.cloud)
[![Status](https://img.shields.io/badge/status-live-10B981?style=for-the-badge)](https://naver1.cloud)
[![PWA](https://img.shields.io/badge/PWA-installable-818cf8?style=for-the-badge)](https://naver1.cloud)

</div>

## ✨ 뭘 할 수 있나요

- 📊 **성적 계산기** — 수행평가·지필고사 비중만 입력하면 최종 원점수·등급(A~E) 즉시 계산
- 🎯 **목표 등급 역산** — "A 맞으려면 몇 점 더 필요한지" 자동 계산
- 🔮 **IF 시뮬레이션** — 시험 점수별 예상 결과 미리보기
- 📈 **원점수 그래프** — 과목별 비교·순위·평균을 이미지 한 장으로 저장
- 🤖 **AI 성적분석 (베타)** — 강점/약점 과목, 성적 추이 자동 요약
- 🍱 **[오늘의 급식](https://naver1.cloud/todayfood)** — 학교 이름 검색 한 번으로 조식·중식·석식 확인
- 📅 **[오늘의 시간표](https://naver1.cloud/todayclass)** — 학년·반 입력으로 오늘 시간표 확인
- 🌙 다크모드 자동 대응, 홈 화면에 앱처럼 설치(PWA)

## 🛠 기술 스택

빌드 도구 없는 순수 HTML/CSS/JS 정적 사이트 · 데이터는 브라우저 `localStorage`에 저장 · 급식/시간표는 [NEIS Open API](https://open.neis.go.kr)를 Cloudflare Worker 프록시로 호출 · GitHub Pages로 배포

## 📁 구조

```
index.html          성적 계산기 메인 페이지
styles.css           공용 디자인 시스템
neis-common.js       NEIS 급식/시간표 공용 로직
todayfood/           오늘의 급식 페이지
todayclass/          오늘의 시간표 페이지
manifest.json        PWA 매니페스트
```

## 🔗 바로가기

| 페이지 | 주소 |
|---|---|
| 성적 계산기 | https://naver1.cloud |
| 오늘의 급식 | https://naver1.cloud/todayfood |
| 오늘의 시간표 | https://naver1.cloud/todayclass |

<div align="center">

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer&animation=fadeIn)

</div>
