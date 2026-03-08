// Lightweight service worker registration for Vite PWA setup.
// This keeps the app online-only: no caching logic is added.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
  )
);

export function register() {
  if (import.meta.env.MODE !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  const publicUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  if (publicUrl.origin !== window.location.origin) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;

    if (isLocalhost) {
      // On localhost, just check that the service worker exists.
      checkValidServiceWorker(swUrl);
    } else {
      registerValidSW(swUrl);
    }
  });
}

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .catch(() => {
      // No-op: failures just mean no PWA capabilities.
    });
}

function checkValidServiceWorker(swUrl: string) {
  fetch(swUrl)
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      // If fetch fails, just skip SW on localhost.
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}
