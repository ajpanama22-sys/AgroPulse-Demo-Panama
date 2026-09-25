"use client";

// Cola de sincronización — PWA del Galponero (Pollo de Engorde, El Dorado).
// Mismo patrón que src/lib/offline-queue.ts (IndexedDB, no localStorage,
// porque las fotos de evidencia van como Blob) pero genérica en el
// endpoint: cada pantalla de captura (Apertura, Mortalidad, Descarte,
// Consumo ABA, Pesaje, Cierre) arma su propio FormData y lo encola igual,
// en vez de necesitar una cola por formulario.

const DB_NAME = "agropulse-campo-pollo";
const STORE = "pendientes";

export type AccionPendiente = {
  id: string;
  etiqueta: string; // para mostrar en "Evidencia y Sincronización" (p.ej. "Mortalidad — Lote LT-0231")
  endpoint: string;
  campos: Record<string, string>;
  fotos: { nombre: string; blob: Blob }[];
  creadoEn: string;
};

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

export async function encolarAccion(accion: AccionPendiente) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(accion);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPendientesPollo(): Promise<AccionPendiente[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as AccionPendiente[]).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)));
    req.onerror = () => reject(req.error);
  });
}

async function eliminarPendientePollo(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Intenta enviar un formulario; si falla (sin señal / error del
 * servidor) lo encola para reintentar más tarde. Devuelve "servidor" o
 * "local" según dónde haya quedado guardado — el mismo contrato visual
 * que ya usa el resto del panel ("Guardado en el equipo · se sincroniza
 * al recuperar señal"). */
export async function enviarOEncolar(args: { etiqueta: string; endpoint: string; campos: Record<string, string>; fotos: File[] }): Promise<"servidor" | "local"> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(args.campos)) fd.set(k, v);
  args.fotos.forEach((f) => fd.append("fotos", f, f.name));

  try {
    if (!navigator.onLine) throw new Error("offline");
    const res = await fetch(args.endpoint, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return "servidor";
  } catch {
    await encolarAccion({
      id: crypto.randomUUID(),
      etiqueta: args.etiqueta,
      endpoint: args.endpoint,
      campos: args.campos,
      fotos: await Promise.all(args.fotos.map(async (f) => ({ nombre: f.name, blob: f }))),
      creadoEn: new Date().toISOString(),
    });
    return "local";
  }
}

export async function sincronizarPendientesPollo(onProgreso?: (restantes: number) => void) {
  const pendientes = await listarPendientesPollo();
  onProgreso?.(pendientes.length);
  for (const p of pendientes) {
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(p.campos)) fd.set(k, v);
      p.fotos.forEach((f) => fd.append("fotos", f.blob, f.nombre));
      const res = await fetch(p.endpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      await eliminarPendientePollo(p.id);
      onProgreso?.((await listarPendientesPollo()).length);
    } catch {
      break; // sin señal todavía — se reintenta en la próxima pasada
    }
  }
}
