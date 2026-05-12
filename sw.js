const CACHE_NAME = 'ultracine-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/filmes.js',
  '/manifest.json',
  '/icon.svg'
];

// Instalação: cache dos assets principais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estratégia de fetch: stale-while-revalidate para assets, network-first para filmes.js, apenas rede para vídeos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Para vídeos (MP4, M3U8, etc) – nunca cache, apenas rede
  if (url.pathname.endsWith('.mp4') || url.pathname.endsWith('.m3u8') || url.pathname.includes('/film/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para filmes.js (catálogo) – prioriza rede, fallback para cache
  if (url.pathname.endsWith('/filmes.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para os demais assets (HTML, CSS, JS, ícones) – stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => null);
      
      return cachedResponse || fetchPromise;
    })
  );
});