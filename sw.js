// sw.js — keeps a copy of the emergency page on the phone after its first visit,
// so it still opens with weak or no mobile data (texts and calls only need signal).
// It always tries the internet first, so contact changes still arrive, and only
// falls back to the saved copy when the internet fails or takes too long.
// Only the emergency page's own files are handled; the dashboard always goes online.

const CACHE = 'emergency-v5'; // change this to throw away every phone's saved copy
const PATHS = ['', 'index.html', 'app.js', 'crypto.js', 'schedule.js', 'style.css', 'logo.svg', 'source-sans-3-regular.woff2', 'source-sans-3-bold.woff2', 'contacts.enc.json'];
const WAIT_MS = 4000; // how long to wait for the internet before using the saved copy

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(
    PATHS.map(p => cache.add(new Request(p || './', { cache: 'no-store' })).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);
  if (event.request.method !== 'GET' || url.origin !== scope.origin ||
      !url.pathname.startsWith(scope.pathname) || !PATHS.includes(path)) return;
  // The page asks for contacts.enc.json?v=<time> to skip GitHub's cache; save it under one name.
  // (The dashboard uses ?t= for its own checks, which this leaves alone.)
  if (url.search && !(path === 'contacts.enc.json' && url.searchParams.has('v'))) return;
  event.respondWith(internetFirst(event, url.search ? scope.href + path : event.request));
});

async function internetFirst(event, savedAs) {
  const cache = await caches.open(CACHE);
  const fromInternet = fetch(event.request).then(res => {
    if (res.ok) return cache.put(savedAs, res.clone()).then(() => res);
    return res;
  });
  event.waitUntil(fromInternet.catch(() => {})); // finish updating the saved copy even if we stop waiting

  const saved = await cache.match(savedAs);
  if (!saved) return fromInternet;

  const tooSlow = new Promise(resolve => setTimeout(resolve, WAIT_MS, null));
  const res = await Promise.race([fromInternet, tooSlow]).catch(() => null);
  if (res && res.status < 500) return res; // a real answer from the site wins, even "not found"
  return markSaved(saved);
}

// Tell the page this is the saved copy, so it can say so.
function markSaved(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Offline-Copy', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
