const CACHE_VERSION = 'v2.0';
const ASSETS_CACHE = `assets-${CACHE_VERSION}`;
const CATALOG_CACHE = `catalog-${CACHE_VERSION}`;
const VIDEOS_CACHE = `videos-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;
const MAX_VIDEOS = 50;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.includes(CACHE_VERSION)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Gerenciamento LRU de vídeos
async function manageVideoCache() {
  const cache = await caches.open(VIDEOS_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_VIDEOS) return;
  // Obter timestamps do localStorage
  let videoTimestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
  const sorted = keys.map(req => ({ url: req.url, ts: videoTimestamps[req.url] || 0 }))
                     .sort((a,b) => a.ts - b.ts);
  const toDelete = sorted.slice(0, keys.length - MAX_VIDEOS);
  for (const item of toDelete) {
    await cache.delete(item.url);
    delete videoTimestamps[item.url];
  }
  localStorage.setItem('videoTimestamps', JSON.stringify(videoTimestamps));
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Vídeos .mp4 – cache-first com LRU
  if (url.pathname.endsWith('.mp4') || url.pathname.includes('/film/')) {
    event.respondWith(
      caches.open(VIDEOS_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) {
          // Atualizar timestamp
          let timestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
          timestamps[event.request.url] = Date.now();
          localStorage.setItem('videoTimestamps', JSON.stringify(timestamps));
          return cached;
        }
        return fetch(event.request).then(async response => {
          if (response && response.status === 200) {
            await cache.put(event.request, response.clone());
            let timestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
            timestamps[event.request.url] = Date.now();
            localStorage.setItem('videoTimestamps', JSON.stringify(timestamps));
            manageVideoCache();
          }
          return response;
        }).catch(() => new Response('Vídeo offline não disponível em cache', { status: 404 }));
      })
    );
    return;
  }
  
  // filmes.js – network-first com timeout e fallback cache
  if (url.pathname.endsWith('/filmes.js')) {
    event.respondWith(
      new Promise(resolve => {
        let timeoutId = setTimeout(() => resolve(caches.match(event.request)), 3000);
        fetch(event.request).then(response => {
          clearTimeout(timeoutId);
          if (response && response.status === 200) {
            caches.open(CATALOG_CACHE).then(cache => cache.put(event.request, response.clone()));
            resolve(response);
          } else {
            resolve(caches.match(event.request));
          }
        }).catch(() => {
          resolve(caches.match(event.request));
        });
      })
    );
    return;
  }
  
  // Imagens (thumbnails) – cache-first
  if (url.pathname.match(/\.(jpg|jpeg|png|webp|svg)$/i) && !url.pathname.includes('icon')) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(cache => 
        cache.match(event.request).then(cached => cached || fetch(event.request).then(response => {
          if (response && response.status === 200) cache.put(event.request, response.clone());
          return response;
        }))
      )
    );
    return;
  }
  
  // Demais assets – stale-while-revalidate
  event.respondWith(
    caches.open(ASSETS_CACHE).then(cache => 
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    )
  );
});