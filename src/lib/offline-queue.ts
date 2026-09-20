"use client";

// Cola de sincronización del PWA de Campo — IndexedDB, no localStorage,
// porque las fotos de evidencia se guardan como Blob y localStorage no
// admite binarios. Con señal, la app intenta guardar DIRECTO contra la
// API (no pasa por acá) — esta cola solo entra en juego cuando el guardado
// directo falla (sin señal, o el POST no llega), que es exactamente el
// comportamiento "guardado en el equipo, se sincroniza al recuperar
// señal" que pide el brochure.

const DB_NAME = "agropulse-campo";
const STORE = "pendientes";

interface CapturaPendiente {
  id: string;
  ubicacionId: string;
  fecha: string;
  valores: Record<string, { meta?: number; causado: number }>;
  observaciones?: string;
  creadoEnDispositivo: string;
  fotos: { nombre: string; blob: Blob }[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function encolarCaptura(captura: CapturaPendiente) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(captura);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPendientes(): Promise<CapturaPendiente[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as CapturaPendiente[]);
    req.onerror = () => reject(req.error);
  });
}

export async function eliminarPendiente(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Intenta vaciar la cola contra el servidor. Se llama al reconectar
 * (evento "online") y al abrir la app — cada captura se envía con su(s)
 * foto(s) como multipart; si una falla, se detiene ahí y se reintenta en
 * la próxima pasada (no se pierde el orden ni se descarta silenciosamente). */
export async function sincronizarPendientes(onProgreso?: (restantes: number) => void) {
  const pendientes = await listarPendientes();
  onProgreso?.(pendientes.length);
  for (const c of pendientes) {
    try {
      const fd = new FormData();
      fd.set("ubicacionId", c.ubicacionId);
      fd.set("fecha", c.fecha);
      fd.set("valores", JSON.stringify(c.valores));
      fd.set("observaciones", c.observaciones ?? "");
      fd.set("creadoEnDispositivo", c.creadoEnDispositivo);
      fd.set("origen", "manual");
      c.fotos.forEach((f, i) => fd.append("fotos", f.blob, f.nombre || `evidencia-${i}.jpg`));

      const res = await fetch("/api/capturas", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      await eliminarPendiente(c.id);
      onProgreso?.((await listarPendientes()).length);
    } catch {
      break; // sin señal todavía / error del servidor — se reintenta después
    }
  }
}
