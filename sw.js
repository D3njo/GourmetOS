const CACHE_CORE = 'gourmetos-core-v20';
const CACHE_DATA = 'gourmetos-data-v20';

const CORE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/config.js',
  './js/app.js',
  './js/app-state.js',
  './js/app-bridge.js',
  './js/ui/dom.js',
  './js/ui/helpers.js',
  './js/ui/navigation.js',
  './js/ui/today-view.js',
  './js/ui/week-view.js',
  './js/ui/preferences-view.js',
  './js/ui/shopping-view.js',
  './js/ui/app-status.js',
  './js/ui/cook-mode.js',
  './js/weather-buckets.js',
  './js/storage.js',
  './js/weather.js',
  './js/recipes.js',
  './js/recipe-meta.js',
  './js/editorial-recipe.js',
  './js/recommendation-engine.js',
  './js/week-composition.js',
  './js/ingredient-normalize.js',
  './js/recipe-api.js',
  './js/recipe-idb.js',
  './js/recipe-bootstrap.js',
  './js/recipe-loader.js',
  './js/pool-sync.js',
  './js/menu-refresh.js',
  './js/recipe-complexity.js',
  './js/spoonacular-api.js',
  './js/recipe-store.js',
  './js/recipe-editor.js',
  './js/exclusions.js',
  './js/measure-parse.js',
  './js/diet-preferences.js',
  './js/plan-engine.js',
  './js/portions.js',
  './js/math.js',
  './js/meal-plan.js',
  './js/shopping-list.js',
  './js/i18n.js',
  './js/units.js',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

const DATA_URLS = [
  './data/recipe-catalog.json',
  './data/recipe-index.json',
  './data/recipes-bundled.json'
];

async function cacheUrls(cache, urls) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
      await cache.put(url, response);
    })
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.warn('[SW] cache partial failure:', failed.length, 'of', urls.length);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const core = await caches.open(CACHE_CORE);
      await cacheUrls(core, CORE_URLS);
      const data = await caches.open(CACHE_DATA);
      await cacheUrls(data, DATA_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_CORE && k !== CACHE_DATA)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isDataAsset(url) {
  return DATA_URLS.some((p) => url.pathname.endsWith(p.replace('./', '')));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    const cacheName = isDataAsset(url) ? CACHE_DATA : CACHE_CORE;
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          if (cached) return cached;
          throw new Error('offline');
        }
      })
    );
    return;
  }

  if (
    url.hostname === 'api.open-meteo.com' ||
    url.hostname === 'www.themealdb.com' ||
    url.hostname === 'api.spoonacular.com'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_DATA).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
  }
});
