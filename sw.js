const CACHE_NAME = 'iptv-room-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/canais.json'
];

// Instalação – armazena os arquivos essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Ativação – limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Estratégia: network first, depois cache (para streams não é tão útil, mas o app base fica off)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Não tentar cachear streams .m3u8 ou URLs externas de vídeo
  if (url.pathname.endsWith('.m3u8') || url.href.includes('amagi.tv') || url.href.includes('.m3u8')) {
    // Para streams, sempre buscar da rede sem cache
    event.respondWith(fetch(event.request));
    return;
  }

  // Para arquivos estáticos do app e canais.json – cache first ou network first
  if (urlsToCache.includes(url.pathname) || url.pathname === '/canais.json') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});