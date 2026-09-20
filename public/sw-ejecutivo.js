// AgroPulse Ejecutivo — panel de solo lectura: cache-first del shell para
// que abra al instante, siempre revalidando en segundo plano contra la
// red para no mostrar cifras viejas por más de un abrir/cerrar de la app.
const CACHE = "agropulse-ejecutivo-v1";
const SHELL = ["/ejecutivo", "/manifest-ejecutivo.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/ejecutivo"))),
  );
});
