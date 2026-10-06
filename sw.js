/* Service worker для PWA: офлайн-кэш и установка приложения */
const CACHE_NAME = 'beauty-master-v2.7';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './main/fon_1.jpg',
  /* Локальные шрифты Nunito (cyrillic + latin объединены в один файл) */
  './fonts/nunito-600.woff2',
  './fonts/nunito-700.woff2',
  './fonts/nunito-800.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      /* Кэшируем каждый файл отдельно: если одного ассета нет в деплое,
         остальной офлайн-кэш всё равно соберётся. */
      .then((cache) => Promise.all(
        CORE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* fetch с таймаутом: если сеть "мёртвая" (Wi-Fi без интернета, слабый LTE),
   не ждём 30–60 секунд, а падаем через ms миллисекунд и уходим в кэш. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Навигация (открытие страницы): сеть с таймаутом 3 сек, иначе — кэш.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request, 3000)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((c) => c || caches.match('./'))
        )
    );
    return;
  }

  // Всё остальное (локальные файлы, шрифты): сначала кэш.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
