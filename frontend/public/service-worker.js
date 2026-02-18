// Minimal PWA service worker focused on installation.
// This does not provide offline caching and will effectively
// only work when there is an active internet connection.

/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  // Skip waiting so updated SW activates quicker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of open clients immediately.
  event.waitUntil(self.clients.claim());
});

// No fetch handler – requests go straight to the network.
