# 급식 알림 PWA 푸시 설계

## 배경

`todayfood/` 페이지에서 매번 학교를 검색해 급식을 확인하는 대신, 매일 정해진 시각(중식 직전)에 자동으로 알림을 받고 싶다는 요청. PWA의 Web Push API를 사용하되, 서버가 급식 메뉴 텍스트를 매일 전 구독자에게 암호화해서 보내는 대신 **빈 푸시로 깨우기만 하고 실제 메뉴 조회는 클라이언트(서비스워커)가 그 순간 직접 한다** — Web Push의 가장 복잡한 부분인 payload 암호화(AEAD)를 완전히 스킵할 수 있어 구현 난이도가 크게 낮아진다.

## 시간 기준

**매일 KST(한국 표준시) 11:30 고정, 개인화된 시간 설정은 이번 스펙에 포함하지 않음.** 한국은 서머타임이 없으므로 Cloudflare Cron Trigger는 `30 2 * * *` (UTC) 하나로 연중 고정 KST 11:30에 대응된다 — 별도 DST 보정 로직 불필요.

## 백그라운드 동작

Push API + Service Worker 구조는 브라우저/앱이 완전히 닫혀 있어도 OS가 서비스워커를 깨워 `push` 이벤트를 실행하는 것이 표준 동작이라 별도 구현 없이 만족된다.

**예외(플랫폼 제약, 우리가 해결 불가):** iOS Safari는 PWA를 **홈 화면에 추가(설치)한 경우에만** 백그라운드 푸시를 지원한다(iOS 16.4+). 그냥 사파리 탭으로 열어둔 사용자에게는 알림이 가지 않을 수 있다. 알림 켜기 UI에 "홈 화면에 추가해야 안정적으로 알림을 받을 수 있어요(iOS)" 안내 문구를 넣는다. 안드로이드/크롬은 설치 여부와 무관하게 정상 동작한다.

## 클라이언트 (`todayfood/index.html`)

- 학교 선택 후 화면에 "🔔 급식 알림 받기" 토글 버튼 추가 (iOS 안내 문구 포함).
- 켜기:
  1. `Notification.requestPermission()` 요청. 거부 시 안내 후 종료.
  2. `navigator.serviceWorker.ready`로 등록된 SW 확보.
  3. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`로 구독 생성.
  4. 구독 객체(`subscription.toJSON()`)를 서버 `/subscribe`로 POST.
  5. 학교 정보(`officeCode`, `schoolCode`, `schoolName`, `kind`)를 **IndexedDB**에 저장 — `localStorage`는 서비스워커에서 접근 불가하므로 페이지와 SW가 공유 가능한 IndexedDB를 사용한다. `neis-common.js`에 `saveNotifySchool(school)`/`loadNotifySchool()` 두 함수를 추가해 페이지·SW 양쪽에서 재사용한다.
- 끄기: `subscription.unsubscribe()` 호출 + 서버 `/unsubscribe`로 endpoint 전달, IndexedDB 항목 삭제.
- 토글 상태는 `pushManager.getSubscription()`으로 페이지 로드시 확인해 UI에 반영.

## 서비스워커 (`app-sw.js`)

현재 `app-sw.js`는 `install`/`fetch`만 있는 빈 stub. 추가:

```javascript
importScripts('./neis-common.js');

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush());
});

async function handlePush() {
  const school = await loadNotifySchool();
  if (!school) return;
  const today = new Date();
  const { slots } = await fetchNeisMeal(school, neisYmd(today)).catch(() => ({ slots: [] }));
  const lunch = slots.find(s => s.code === '2');
  const title = lunch && lunch.items.length
    ? `오늘 중식: ${lunch.items.slice(0, 3).join(', ')}`
    : '오늘 급식 정보를 확인해보세요';
  await self.registration.showNotification(title, {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/todayfood/' }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

`neis-common.js`가 `localStorage`/`document`를 쓰는 다른 함수들도 갖고 있지만, `importScripts`는 파일을 로드해 함수를 "정의"만 할 뿐이므로 SW 컨텍스트에서 실제로 호출하는 건 `fetchNeisMeal`, `neisYmd`, `loadNotifySchool`뿐이라 문제 없다.

## 서버 (기존 `feedback-api` Worker에 라우트 추가)

새 Worker를 만들지 않고 이미 배포된 `feedback-api`(`seongjeok-feedback-api`)에 라우트와 스케줄 핸들러를 추가한다. 새 KV 네임스페이스 `PUSH_KV` 바인딩을 하나 더 추가한다 (기존 `FEEDBACK_KV`와 분리해 관심사 섞지 않음).

- **`POST /subscribe`**: body `{ subscription }`. 키는 `subscription.endpoint`의 해시(SHA-256, hex 앞 32자)로 만들어 같은 구독이 중복 저장되지 않게 한다. `PUSH_KV.put(key, JSON.stringify(subscription))`.
- **`POST /unsubscribe`**: body `{ endpoint }`. 같은 방식으로 키를 만들어 `PUSH_KV.delete(key)`.
- **`scheduled(event, env, ctx)`** (Cron Trigger `30 2 * * *`): `PUSH_KV.list()`로 전체 구독을 순회하며 각 구독의 `endpoint`에 VAPID 인증 헤더만 실은 **빈 푸시**(payload 없음)를 전송한다. 응답이 404/410이면 만료된 구독이므로 해당 KV 키를 삭제한다.
- **VAPID JWT 서명**: 외부 라이브러리 없이 Workers의 Web Crypto API(`crypto.subtle.importKey`/`sign`, ECDSA P-256/SHA-256)로 RFC 8292 규격의 `Authorization: vapid t=<jwt>, k=<publicKey>` 헤더를 직접 만든다.
- CORS는 기존 `ALLOWED_ORIGINS`(`https://naver1.cloud`) 패턴을 그대로 재사용.

## 필요한 배포 준비 (사람이 승인 후 실행)

1. VAPID 키 쌍 생성 (예: `npx web-push generate-vapid-keys`) — 공개키는 클라이언트 코드에 상수로 넣고, 개인키는 `wrangler secret put VAPID_PRIVATE_KEY`로 Worker 시크릿 등록 (커밋 금지).
2. `wrangler kv:namespace create PUSH_KV` 실행 후 `feedback-api/wrangler.jsonc`에 바인딩 추가.
3. `feedback-api/wrangler.jsonc`에 `"triggers": { "crons": ["30 2 * * *"] }` 추가.
4. `wrangler deploy`로 재배포.

## 에러 처리

- 알림 권한 거부: "알림을 켜려면 브라우저 설정에서 권한을 허용해주세요" 안내.
- 구독 생성 실패(오프라인 등): "알림 등록에 실패했어요. 잠시 후 다시 시도해주세요."
- SW의 `push` 핸들러 내 NEIS 조회 실패: 카탈로그성 문구("오늘 급식 정보를 확인해보세요")로 대체해 알림 자체는 계속 뜨게 한다 (조용히 죽지 않음).
- 만료된 구독으로의 발송 실패(410 Gone): 크론 핸들러가 자동으로 KV에서 삭제.

## 테스트

자동화 테스트 없음(정적 사이트 + Workers, 별도 테스트 프레임워크 미사용). 수동 확인 체크리스트:

- [ ] 알림 켜기 → 브라우저 권한 프롬프트 → 허용 후 구독 성공 토스트/상태 표시
- [ ] `wrangler tail`로 구독 요청이 Worker에 도달하고 `PUSH_KV`에 저장되는지 확인
- [ ] 수동으로 스케줄 핸들러 트리거(`wrangler dev`의 테스트 스케줄 실행 또는 curl로 임시 테스트 라우트) → 실제 기기에 알림이 뜨는지, 브라우저를 완전히 닫은 상태에서도 뜨는지
- [ ] 알림 클릭 시 `/todayfood/`가 열리는지
- [ ] 알림 끄기 → `PUSH_KV`에서 항목이 삭제되는지
- [ ] iOS에서: 사파리 탭 상태(미설치)와 홈 화면 추가 상태 각각에서 백그라운드 알림 수신 차이 확인
- [ ] 만료/무효 구독에 발송 시도 시 크론이 해당 KV 항목을 정리하는지

## 범위 밖

- 사용자별 알림 시간 개인화 (전원 KST 11:30 고정).
- 조식/석식 등 다른 끼니 알림 선택 (중식 고정).
- Web Push payload 암호화를 통한 실시간 메뉴 전송 (빈 푸시 + 클라이언트 조회 방식으로 대체).
