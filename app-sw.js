importScripts('./neis-common.js');

// 오프라인: 계산기 페이지와 안내 화면을 미리 담아 두고, 인터넷이 끊기면 담아 둔 화면을 보여 준다(앱으로 감싸도 공룡 화면이 안 뜨게).
// 페이지는 늘 네트워크 먼저라 배포하면 바로 새 화면이 나온다. ?v=가 붙은 공용 파일은 버전이 바뀌면 주소가 달라지므로 캐시 먼저.
// 이 파일을 바꾸면 CACHE 이름도 바꾼다(옛 캐시는 activate에서 지운다).
const CACHE = 'app-20261025';
const PAGES = ['/', '/target-score/', '/rank/', '/gpa/', '/gpa-converter/', '/offline.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PAGES)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

const keep = (request, response) => {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/admin')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => keep(request, response))
      .catch(() => caches.match(request, { ignoreSearch: true }).then(hit => hit || caches.match('/offline.html'))));
    return;
  }
  if (url.search.includes('v=')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => keep(request, response))));
  }
});

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
