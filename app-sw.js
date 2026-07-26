importScripts('./neis-common.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', () => {});

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
