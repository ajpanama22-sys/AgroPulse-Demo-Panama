// AgroPulse Campo — cachea el shell de la app para que abra sin señal, y
// deja la cola de sincronización (capturas + fotos pendientes) al cliente
// vía IndexedDB (ver src/lib/offline-queue.ts): un service worker no puede
// leer archivos del formulario que el usuario todavía no envió, así que la
// cola vive en la página, no acá — el SW solo garantiza que la PÁGINA
// misma cargue offline.
const CACHE = "agropulse-campo-v1";
const SHELL = ["/campo", "/manifest-campo.json"];

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
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/campo"))),
  );
});
