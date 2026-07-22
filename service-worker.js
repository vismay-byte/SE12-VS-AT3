/*
  VFR NAVLOG Trainer — service worker (Stage 0)
  Stage 0 scope: cache the static app shell only, so the home screen installs and
  reopens offline. Data files (Stage 2-4), calculator modules, and a smarter
  cache-versioning/update strategy are added as those stages introduce new assets.
*/

const CACHE_NAME = "vfr-navlog-shell-v23";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/planning.css",
  "./css/calculators.css",
  "./css/features.css",
  "./js/shell.js",
  "./js/shared-utils.js",
  "./js/auth.js",
  "./js/supabase-client.js",
  "./js/nav-page.js",
  "./js/route-planner-bundle.js",
  "./js/navlog-bundle.js",
  "./js/gonogo.js",
  "./js/checklists.js",
  "./js/logbook.js",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./data/aerodromes.json",
  "./data/waypoints.json",
  "./data/aircraft.json"
];

// Note: js/navlog-bundle.js's PDF export lazily injects jsPDF from a CDN
// at runtime, on click, and js/gonogo.js fetches live Open-Meteo weather
// on click — same rule as supabase-js, not precached, so PDF export and
// the weather fetch need connectivity even though the rest of this
// shell loads offline (js/gonogo.js's Go/No-Go check still works
// offline with manually-typed conditions).

// Note: js/supabase-client.js imports supabase-js from esm.sh at runtime.
// That cross-origin import is NOT precached (same rule as Open-Meteo later)
// — auth, and therefore js/logbook.js's whole feature, requires
// connectivity even though the shell itself still loads offline. Stage 14
// added an offline queue for "Save to logbook" specifically because of
// this — see js/navlog-bundle.js's saveFlightToLogbook()/flushPendingFlightSaves().

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for app shell files, falling back to network for anything else
// (e.g. future Open-Meteo / Supabase calls, which should not be cached this way).
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    return; // let network/data requests pass through untouched
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
