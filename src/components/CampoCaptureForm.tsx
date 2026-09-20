"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { encolarCaptura, listarPendientes, sincronizarPendientes } from "@/lib/offline-queue";
import InstallPwaButton from "@/components/InstallPwaButton";

type Indicador = { clave: string; etiqueta: string; unidadMedida: string; tipoValor: string; notaTecnica: string | null; orden: number };
type Ubicacion = { id: string; nombre: string; subUnidad: string | null; qrToken: string; unidadNombre: string };
type Reciente = { id: string; fecha: string; ubicacion: string; sincronizadoEn: Date };
type HistorialItem = { id: string; fecha: string; sincronizadoEn: Date; observaciones: string | null };

type SyncEstado = "idle" | "syncing" | "done" | "stopped";
type Tab = "inicio" | "captura" | "historial" | "perfil";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CampoCaptureForm({
  usuario,
  ubicaciones,
  ubicacionActualId,
  indicadores,
  recientes,
  historial,
}: {
  usuario: { nombre: string; rol: string; email: string };
  ubicaciones: Ubicacion[];
  ubicacionActualId: string;
  indicadores: Indicador[];
  recientes: Reciente[];
  historial: HistorialItem[];
}) {
  const [tab, setTab] = useState<Tab>("captura");
  const [ubicacionId, setUbicacionId] = useState(ubicacionActualId);
  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId) ?? ubicaciones[0];
  const [valores, setValores] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ultimoEstado, setUltimoEstado] = useState<"" | "local" | "servidor">("");
  const [pendientesCount, setPendientesCount] = useState(0);
  const [syncEstado, setSyncEstado] = useState<SyncEstado>("idle");
  const [scanAbierto, setScanAbierto] = useState(false);

  const refrescarPendientes = useCallback(async () => {
    setPendientesCount((await listarPendientes()).length);
  }, []);

  const sincronizar = useCallback(async () => {
    setSyncEstado("syncing");
    try {
      await sincronizarPendientes((restantes) => setPendientesCount(restantes));
      const restantes = (await listarPendientes()).length;
      setSyncEstado(restantes === 0 ? "done" : "stopped");
      setTimeout(() => setSyncEstado("idle"), 3500);
    } catch {
      setSyncEstado("stopped");
    }
  }, []);

  useEffect(() => {
    refrescarPendientes();
    const onOnline = () => sincronizar();
    window.addEventListener("online", onOnline);
    sincronizar();
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarRegistro() {
    setGuardando(true);
    const causados: Record<string, { causado: number }> = {};
    for (const ind of indicadores) {
      const raw = valores[ind.clave];
      if (raw !== undefined && raw !== "") causados[ind.clave] = { causado: Number(raw) };
    }
    const payload = {
      ubicacionId: ubicacion.id,
      fecha: hoyISO(),
      valores: causados,
      observaciones,
      creadoEnDispositivo: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) throw new Error("offline");
      const fd = new FormData();
      fd.set("ubicacionId", payload.ubicacionId);
      fd.set("fecha", payload.fecha);
      fd.set("valores", JSON.stringify(payload.valores));
      fd.set("observaciones", payload.observaciones);
      fd.set("creadoEnDispositivo", payload.creadoEnDispositivo);
      fd.set("origen", "manual");
      fotos.forEach((f) => fd.append("fotos", f, f.name));
      const res = await fetch("/api/capturas", { method: "POST", body: fd });
      if (!res.ok) throw new Error("fallo servidor");
      setUltimoEstado("servidor");
    } catch {
      await encolarCaptura({
        id: crypto.randomUUID(),
        ...payload,
        fotos: await Promise.all(fotos.map(async (f) => ({ nombre: f.name, blob: f }))),
      });
      setUltimoEstado("local");
      refrescarPendientes();
    }
    setGuardando(false);
    setValores({});
    setFotos([]);
    setObservaciones("");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg pb-24">
      <header className="bg-charcoal px-5 pb-5 pt-6 text-white">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Agro<span className="text-orange">Pulse</span>
          </h1>
          <InstallPwaButton label="Instalar" />
        </div>
        <button
          onClick={() => setScanAbierto(true)}
          className="mt-4 flex w-full items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-left text-sm"
        >
          <QrIcon />
          <span>
            {ubicacion?.unidadNombre} · {ubicacion?.nombre}
            {ubicacion?.subUnidad ? ` · ${ubicacion.subUnidad}` : ""}
          </span>
        </button>
      </header>

      {syncEstado !== "idle" && (
        <div
          className={`px-5 py-2 text-center text-xs font-semibold ${
            syncEstado === "syncing" ? "bg-[var(--blue-dim)] text-blue" : syncEstado === "done" ? "bg-[var(--success-dim)] text-success" : "bg-[var(--danger-dim)] text-danger"
          }`}
        >
          {syncEstado === "syncing" && "Iniciando sincronización…"}
          {syncEstado === "done" && "Sincronización terminada"}
          {syncEstado === "stopped" && "Sincronización detenida — se reintentará automáticamente al recuperar señal"}
        </div>
      )}

      <main className="flex-1 px-5 pt-5">
        {tab === "inicio" && (
          <InicioTab
            usuario={usuario}
            ubicacion={ubicacion}
            pendientesCount={pendientesCount}
            syncEstado={syncEstado}
            onSincronizar={sincronizar}
            onIrACaptura={() => setTab("captura")}
            ultimaCaptura={historial[0]}
          />
        )}

        {tab === "historial" && <HistorialTab historial={historial} />}

        {tab === "perfil" && <PerfilTab usuario={usuario} ubicacion={ubicacion} />}

        {tab === "captura" && (
        <>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Captura del día — {new Date().toLocaleDateString("es-PA")}
          </p>
          {pendientesCount > 0 && (
            <button onClick={sincronizar} disabled={syncEstado === "syncing"} className="rounded-full bg-orange-dim px-3 py-1 text-xs font-bold text-orange">
              {syncEstado === "syncing" ? "Sincronizando…" : `Sincronizar (${pendientesCount})`}
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {indicadores.map((ind) => (
            <label key={ind.clave} className={ind.etiqueta.length > 18 ? "col-span-2" : ""}>
              <span className="text-xs text-text-muted">{ind.etiqueta}</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-panel-2 px-4 py-3">
                <input
                  inputMode="decimal"
                  value={valores[ind.clave] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [ind.clave]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-transparent text-lg font-bold text-charcoal outline-none"
                />
                <span className="shrink-0 text-xs text-text-faint">{ind.unidadMedida}</span>
              </div>
              {ind.notaTecnica && <p className="mt-1 text-[11px] leading-snug text-text-faint">{ind.notaTecnica}</p>}
            </label>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-xs text-text-muted">Observaciones (opcional)</span>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-border bg-panel-2 px-4 py-3 text-sm text-charcoal outline-none"
          />
        </label>

        <div className="mt-4">
          <span className="text-xs text-text-muted">Evidencia fotográfica</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            <label className="relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border-strong text-text-faint">
              <CameraIcon />
              <span className="text-[10px]">Foto</span>
              {/* Input real superpuesto (no `ref.click()`) — es el patrón que
                  funciona de forma confiable en Android/iOS: un <label> que
                  envuelve el <input type=file> dispara la cámara nativa sin
                  depender de JS, que en algunos navegadores móviles bloquea
                  el click() programático sobre un input oculto. */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => {
                  setFotos((f) => [...f, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <button
          onClick={guardarRegistro}
          disabled={guardando}
          className="mt-5 w-full rounded-xl bg-orange py-4 text-center text-base font-bold text-white shadow-sm disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar registro"}
        </button>
        {ultimoEstado && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
            <span className={`h-2 w-2 rounded-full ${ultimoEstado === "servidor" ? "bg-success" : "bg-orange"}`} />
            {ultimoEstado === "servidor" ? "Sincronizado" : "Guardado en el equipo · se sincroniza al recuperar señal"}
          </p>
        )}

        <section className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-text-faint">Registros recientes</p>
          <div className="mt-2 flex flex-col gap-2">
            {recientes.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{r.ubicacion}</p>
                  <p className="text-xs text-text-faint">{r.fecha}</p>
                </div>
                <span className="text-xs font-semibold text-success">Sincronizado</span>
              </div>
            ))}
          </div>
        </section>
        </>
        )}
      </main>

      {scanAbierto && (
        <ScannerQr
          ubicaciones={ubicaciones}
          onCerrar={() => setScanAbierto(false)}
          onSeleccionar={(id) => {
            setUbicacionId(id);
            setScanAbierto(false);
          }}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-around border-t border-border bg-panel py-2.5">
        {([
          { label: "Inicio", tab: "inicio" },
          { label: "Captura", tab: "captura" },
          { label: "Historial", tab: "historial" },
          { label: "Perfil", tab: "perfil" },
        ] as { label: string; tab: Tab }[]).map((item) => (
          <button
            key={item.label}
            onClick={() => setTab(item.tab)}
            className={`flex flex-col items-center gap-1 text-[10px] ${tab === item.tab ? "text-orange" : "text-text-faint"}`}
          >
            <span className={`h-4 w-4 rounded-full border-2 ${tab === item.tab ? "border-orange bg-orange-dim" : "border-text-faint"}`} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function InicioTab({
  usuario,
  ubicacion,
  pendientesCount,
  syncEstado,
  onSincronizar,
  onIrACaptura,
  ultimaCaptura,
}: {
  usuario: { nombre: string; rol: string };
  ubicacion?: Ubicacion;
  pendientesCount: number;
  syncEstado: SyncEstado;
  onSincronizar: () => void;
  onIrACaptura: () => void;
  ultimaCaptura?: HistorialItem;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-text-muted">Hola,</p>
        <p className="font-display text-xl font-bold text-charcoal">{usuario.nombre}</p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Tu ubicación</p>
        <p className="mt-1 text-sm font-semibold text-charcoal">
          {ubicacion?.unidadNombre} · {ubicacion?.nombre}
          {ubicacion?.subUnidad ? ` · ${ubicacion.subUnidad}` : ""}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Último registro sincronizado</p>
        <p className="mt-1 text-sm text-charcoal">{ultimaCaptura ? ultimaCaptura.fecha : "Todavía no hay registros"}</p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Pendientes por sincronizar</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-2xl font-bold text-charcoal">{pendientesCount}</p>
          {pendientesCount > 0 && (
            <button onClick={onSincronizar} disabled={syncEstado === "syncing"} className="rounded-full bg-orange-dim px-3 py-1.5 text-xs font-bold text-orange">
              {syncEstado === "syncing" ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          )}
        </div>
      </div>
      <button onClick={onIrACaptura} className="rounded-xl bg-orange py-4 text-center text-base font-bold text-white shadow-sm">
        Ir a captura del día
      </button>
    </div>
  );
}

function HistorialTab({ historial }: { historial: HistorialItem[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-text-faint">Historial de capturas</p>
      <div className="mt-2 flex flex-col gap-2">
        {historial.length === 0 && <p className="mt-4 text-sm text-text-muted">Todavía no hay registros para esta ubicación.</p>}
        {historial.map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-panel px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-charcoal">{h.fecha}</p>
              <span className="text-xs font-semibold text-success">Sincronizado</span>
            </div>
            <p className="mt-0.5 text-[11px] text-text-faint">{new Date(h.sincronizadoEn).toLocaleString("es-PA")}</p>
            {h.observaciones && <p className="mt-1 text-xs text-text-muted">{h.observaciones}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PerfilTab({ usuario, ubicacion }: { usuario: { nombre: string; rol: string; email: string }; ubicacion?: Ubicacion }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal text-xl font-bold text-white">{usuario.nombre.charAt(0).toUpperCase()}</div>
        <p className="font-display text-lg font-bold text-charcoal">{usuario.nombre}</p>
        <p className="text-xs text-text-muted">{usuario.email}</p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Rol</p>
        <p className="mt-1 text-sm font-semibold capitalize text-charcoal">{usuario.rol}</p>
      </div>
      <div className="rounded-xl border border-border bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Ubicación asignada</p>
        <p className="mt-1 text-sm font-semibold text-charcoal">
          {ubicacion?.unidadNombre} · {ubicacion?.nombre}
        </p>
      </div>
      <button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-xl border border-danger/30 bg-[var(--danger-dim)] py-3 text-center text-sm font-bold text-danger">
        Cerrar sesión
      </button>
    </div>
  );
}

function ScannerQr({ ubicaciones, onCerrar, onSeleccionar }: { ubicaciones: Ubicacion[]; onCerrar: () => void; onSeleccionar: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soportado, setSoportado] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf: number;
    let activo = true;

    async function iniciar() {
      // BarcodeDetector no está disponible en todos los navegadores (ej.
      // iOS Safari) — si falta, se cae directo a la lista manual en vez
      // de mostrar una cámara que nunca va a detectar nada.
      if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        setSoportado(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        // @ts-expect-error ver nota arriba
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const loop = async () => {
          if (!activo || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const token = codes[0]?.rawValue as string | undefined;
            const match = token && ubicaciones.find((u) => u.qrToken === token);
            if (match) {
              onSeleccionar(match.id);
              return;
            }
          } catch {
            /* frame no decodificable — se reintenta en el próximo */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setSoportado(false);
      }
    }
    iniciar();
    return () => {
      activo = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ubicaciones, onSeleccionar]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-charcoal/95 p-5">
      <div className="flex items-center justify-between text-white">
        <p className="font-semibold">Escanear ubicación</p>
        <button onClick={onCerrar} className="text-2xl leading-none">
          ×
        </button>
      </div>
      {soportado ? (
        <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-4 top-0 bottom-0">
            <div className="absolute inset-0 rounded-xl border-2 border-orange/70" />
            <div className="scan-line absolute inset-x-0 h-0.5 bg-orange shadow-[0_0_8px_2px_rgba(239,125,30,0.7)]" />
          </div>
          <style jsx>{`
            @keyframes scan-move {
              0% { top: 4%; }
              50% { top: 94%; }
              100% { top: 4%; }
            }
            .scan-line {
              animation: scan-move 2.2s ease-in-out infinite;
            }
          `}</style>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/70">Este dispositivo no soporta lectura de QR en el navegador — elegí la ubicación manualmente:</p>
      )}
      <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
        {ubicaciones.map((u) => (
          <button key={u.id} onClick={() => onSeleccionar(u.id)} className="rounded-xl bg-white/10 px-4 py-3 text-left text-sm text-white">
            {u.unidadNombre} · {u.nombre}
            {u.subUnidad ? ` · ${u.subUnidad}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v7M14 20h4" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
