"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { enviarOEncolar, listarPendientesPollo, sincronizarPendientesPollo } from "@/lib/offline-queue-pollo";
import InstallPwaButton from "@/components/InstallPwaButton";
import { pesoEstandarEnEdad, type Genetica, type EstandarGeneticoPunto } from "@/lib/analisis-pollo";

export type LoteActivoUi = {
  id: string;
  codigo: string;
  genetica: Genetica;
  fechaAlojamiento: string;
  poblacionInicial: number;
  edad: number;
  saldo: number;
  pctMortalidad: number;
  pesoKg: number | null;
  conversion: number | null;
  pesoEstandarKg: number;
  pctCumplimientoLote: number;
  semaforo: { label: string; tone: "success" | "orange" | "danger" };
  esHito: boolean;
  capturasHoy: { mortalidad: boolean; descarte: boolean; alimento: boolean };
};

export type AsignacionGalpon = {
  galponId: string;
  galponNombre: string;
  granjaId: string;
  granjaNombre: string;
  lote: LoteActivoUi | null;
};

export type EventoHistorial = {
  id: string;
  tipo: string;
  fecha: string;
  loteCodigo: string;
  galponNombre: string;
  detalle: string;
};

type Tab = "granjas" | "historial" | "perfil";
type Pantalla =
  | { vista: "home" }
  | { vista: "detalle"; galponId: string }
  | { vista: "apertura"; galponId: string }
  | { vista: "mortalidad"; galponId: string }
  | { vista: "descarte"; galponId: string }
  | { vista: "alimento"; galponId: string }
  | { vista: "pesaje"; galponId: string }
  | { vista: "cierre"; galponId: string };

const CAUSAS = [
  { value: "ascitis", label: "Ascitis" },
  { value: "problema_patas", label: "Problema de patas" },
  { value: "respiratorio", label: "Respiratorio" },
  { value: "picaje", label: "Picaje" },
  { value: "otra", label: "Otra" },
];

const KG_POR_SACO = 40;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number | null | undefined, dec = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-PA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "success" | "orange" | "danger" | "blue" | "neutral" }) {
  const map = {
    success: "bg-[var(--success-dim)] text-success",
    danger: "bg-[var(--danger-dim)] text-danger",
    orange: "bg-orange-dim text-orange",
    blue: "bg-[var(--blue-dim)] text-blue",
    neutral: "bg-panel-2 text-text-muted",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

function Boton({
  children,
  variant = "primary",
  className = "",
  ...props
}: { children: React.ReactNode; variant?: "primary" | "ghost" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-orange text-white active:bg-[var(--orange-bright)]"
      : variant === "danger"
        ? "bg-[var(--danger-dim)] text-danger active:opacity-80"
        : "bg-panel-2 text-charcoal border border-border active:bg-panel";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

const campoInput = "w-full rounded-xl border border-border bg-[var(--panel-2)] px-4 py-3 text-base text-charcoal placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-charcoal">{label}</span>
      {children}
    </label>
  );
}

// PWA del Galponero — Pollo de Engorde (El Dorado / Grupo JHS). Un operario
// puede tener varios galpones asignados en varias granjas ("Mis Granjas");
// cada galpón muestra su lote activo (o el botón de Apertura si no tiene
// uno) con las capturas de campo que exige el ciclo: Mortalidad, Descarte
// y Consumo ABA todos los días, Pesaje solo en días hito, y Cierre de Lote
// al final. Todo pasa por la misma cola offline (IndexedDB) que ya usa el
// resto del panel de campo, porque el punto ciego más citado del cliente
// es exactamente la señal intermitente en el galpón.
export default function CampoPolloApp({
  usuario,
  asignaciones,
  historial,
  tabla,
}: {
  usuario: { nombre: string; rol: string; email: string };
  asignaciones: AsignacionGalpon[];
  historial: EventoHistorial[];
  tabla: EstandarGeneticoPunto[];
}) {
  const [tab, setTab] = useState<Tab>("granjas");
  const [pantalla, setPantalla] = useState<Pantalla>({ vista: "home" });
  const [pendientesCount, setPendientesCount] = useState(0);
  const [syncEstado, setSyncEstado] = useState<"idle" | "syncing" | "done" | "stopped">("idle");
  const [ultimoGuardado, setUltimoGuardado] = useState<"" | "local" | "servidor">("");

  const refrescarPendientes = useCallback(async () => {
    try {
      setPendientesCount((await listarPendientesPollo()).length);
    } catch {
      /* IndexedDB no disponible (SSR/preview) — se ignora */
    }
  }, []);

  const sincronizar = useCallback(async () => {
    setSyncEstado("syncing");
    try {
      await sincronizarPendientesPollo((restantes) => setPendientesCount(restantes));
      const restantes = (await listarPendientesPollo()).length;
      setSyncEstado(restantes === 0 ? "done" : "stopped");
      setTimeout(() => setSyncEstado("idle"), 3000);
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

  const router = useRouter();
  const asignacion = "galponId" in pantalla ? asignaciones.find((a) => a.galponId === pantalla.galponId) : undefined;

  // Volver del formulario de Apertura (galpón SIN lote todavía) tiene que
  // ir a "Mis Granjas", no a la pantalla de detalle — esa asume que ya
  // existe un lote activo y se rompía en blanco (el bug de "no hay volver").
  function volver() {
    setPantalla(asignacion?.lote ? { vista: "detalle", galponId: asignacion.galponId } : { vista: "home" });
  }

  async function despues(resultado: "servidor" | "local") {
    setUltimoGuardado(resultado);
    await refrescarPendientes();
    setTimeout(() => setUltimoGuardado(""), 2500);
    volver();
    router.refresh();
  }

  const TITULO_PANTALLA: Record<Pantalla["vista"], string> = {
    home: "",
    detalle: asignacion ? `${asignacion.granjaNombre} · ${asignacion.galponNombre}` : "Galpón",
    apertura: "Apertura de Lote",
    mortalidad: "Captura de Mortalidad",
    descarte: "Captura de Descarte",
    alimento: "Captura de Consumo (ABA)",
    pesaje: "Captura de Pesaje",
    cierre: "Cierre de Lote",
  };
  const enHome = pantalla.vista === "home";
  function atras() {
    if (pantalla.vista === "detalle") setPantalla({ vista: "home" });
    else volver();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel px-4 py-3">
        {enHome ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">AgroPulse · Galponero</p>
            <p className="font-display text-lg font-bold text-charcoal">{usuario.nombre}</p>
          </div>
        ) : (
          <button onClick={atras} className="flex min-w-0 items-center gap-2 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-lg font-bold text-charcoal">‹</span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-faint">Volver</span>
              <span className="block truncate text-sm font-bold text-charcoal">{TITULO_PANTALLA[pantalla.vista]}</span>
            </span>
          </button>
        )}
        <button
          onClick={sincronizar}
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${pendientesCount > 0 ? "bg-orange-dim text-orange" : "bg-[var(--success-dim)] text-success"}`}
        >
          {syncEstado === "syncing" ? "Sincronizando…" : pendientesCount > 0 ? `${pendientesCount} por enviar` : "Al día"}
        </button>
      </header>

      {ultimoGuardado && (
        <div className={`px-4 py-2 text-center text-sm font-medium ${ultimoGuardado === "servidor" ? "bg-[var(--success-dim)] text-success" : "bg-orange-dim text-orange"}`}>
          {ultimoGuardado === "servidor" ? "Guardado y enviado ✓" : "Guardado en el equipo · se sincroniza al recuperar señal"}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {pantalla.vista === "home" && tab === "granjas" && <VistaMisGranjas asignaciones={asignaciones} onAbrir={(id) => setPantalla(asignaciones.find((a) => a.galponId === id)?.lote ? { vista: "detalle", galponId: id } : { vista: "apertura", galponId: id })} />}
        {pantalla.vista === "home" && tab === "historial" && <VistaHistorial historial={historial} />}
        {pantalla.vista === "home" && tab === "perfil" && (
          <VistaPerfil usuario={usuario} pendientesCount={pendientesCount} onSincronizar={sincronizar} syncEstado={syncEstado} />
        )}

        {pantalla.vista === "detalle" && asignacion && (
          <VistaDetalleGalpon asignacion={asignacion} onIr={(v) => setPantalla({ vista: v, galponId: asignacion.galponId })} onVolver={() => setPantalla({ vista: "home" })} />
        )}

        {pantalla.vista === "apertura" && (
          <FormApertura galponId={pantalla.galponId} onListo={despues} onCancelar={volver} />
        )}
        {pantalla.vista === "mortalidad" && asignacion?.lote && (
          <FormMortalidad lote={asignacion.lote} onListo={despues} onCancelar={volver} />
        )}
        {pantalla.vista === "descarte" && asignacion?.lote && (
          <FormDescarte lote={asignacion.lote} onListo={despues} onCancelar={volver} />
        )}
        {pantalla.vista === "alimento" && asignacion?.lote && (
          <FormAlimento lote={asignacion.lote} onListo={despues} onCancelar={volver} />
        )}
        {pantalla.vista === "pesaje" && asignacion?.lote && (
          <FormPesaje lote={asignacion.lote} tabla={tabla} onListo={despues} onCancelar={volver} />
        )}
        {pantalla.vista === "cierre" && asignacion?.lote && (
          <FormCierre lote={asignacion.lote} onListo={despues} onCancelar={volver} />
        )}
      </main>

      {pantalla.vista === "home" && (
        <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md border-t border-border bg-panel">
          {([
            ["granjas", "Mis Granjas"],
            ["historial", "Historial"],
            ["perfil", "Perfil"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-3 text-center text-xs font-semibold ${tab === id ? "text-orange" : "text-text-muted"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Mis Granjas
// ---------------------------------------------------------------------

function VistaMisGranjas({ asignaciones, onAbrir }: { asignaciones: AsignacionGalpon[]; onAbrir: (galponId: string) => void }) {
  if (asignaciones.length === 0) {
    return <p className="mt-10 text-center text-sm text-text-muted">No tenés galpones asignados todavía. Pedile a tu supervisor que te asigne uno desde el portal.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-charcoal">Mis Granjas · {asignaciones.length} galpones asignados</p>
      {asignaciones.map((a) => {
        const lote = a.lote;
        const pendientes = lote ? Object.values(lote.capturasHoy).filter((v) => !v).length : 0;
        const capturadas = lote ? 3 - pendientes : 0;
        return (
          <button key={a.galponId} onClick={() => onAbrir(a.galponId)} className="rounded-2xl border border-border bg-panel p-4 text-left shadow-sm active:bg-panel-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{a.granjaNombre}</p>
                <p className="font-display text-base font-bold text-charcoal">{a.galponNombre}</p>
              </div>
              {!lote ? (
                <Chip tone="orange">Abrir lote</Chip>
              ) : lote.edad >= 33 ? (
                <Chip tone="blue">Por cerrar</Chip>
              ) : (
                <Chip tone="success">En curso</Chip>
              )}
            </div>
            {lote ? (
              <>
                <p className="mt-2 text-sm text-text-muted">
                  Lote {lote.codigo} · día {lote.edad} de 35 · {fmt(lote.saldo)} aves vivas
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-text-faint">Capturas de hoy</span>
                  <span className={`text-xs font-semibold ${pendientes === 0 ? "text-success" : "text-orange"}`}>{capturadas} de 3</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Sin lote activo — tocá para alojar un nuevo lote.</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function VistaDetalleGalpon({
  asignacion,
  onIr,
  onVolver,
}: {
  asignacion: AsignacionGalpon;
  onIr: (v: "mortalidad" | "descarte" | "alimento" | "pesaje" | "cierre") => void;
  onVolver: () => void;
}) {
  const lote = asignacion.lote!;
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onVolver} className="text-left text-sm font-medium text-text-muted">← Mis Granjas</button>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{asignacion.granjaNombre}</p>
        <h2 className="font-display text-xl font-bold text-charcoal">{asignacion.galponNombre} · Lote {lote.codigo}</h2>
      </div>

      <div className="rounded-2xl border border-border bg-panel p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-text-faint">Día de ciclo</p><p className="font-bold text-charcoal">{lote.edad} / 35</p></div>
          <div><p className="text-text-faint">Aves vivas</p><p className="font-bold text-charcoal">{fmt(lote.saldo)}</p></div>
          <div><p className="text-text-faint">Mortalidad acum.</p><p className="font-bold text-charcoal">{lote.pctMortalidad.toFixed(1)}%</p></div>
          <div><p className="text-text-faint">Conversión</p><p className="font-bold text-charcoal">{lote.conversion !== null ? lote.conversion.toFixed(2) : "—"}</p></div>
          <div><p className="text-text-faint">Peso actual</p><p className="font-bold text-charcoal">{lote.pesoKg !== null ? `${(lote.pesoKg * 1000).toFixed(0)} g` : "—"}</p></div>
          <div><p className="text-text-faint">Peso estándar</p><p className="font-bold text-charcoal">{(lote.pesoEstandarKg * 1000).toFixed(0)} g</p></div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-panel-2 px-3 py-2">
          <span className="text-xs text-text-muted">% Cumplimiento vs. estándar genético</span>
          <Chip tone={lote.semaforo.tone}>{Math.round(lote.pctCumplimientoLote)}% · {lote.semaforo.label}</Chip>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Boton onClick={() => onIr("mortalidad")} variant={lote.capturasHoy.mortalidad ? "ghost" : "primary"}>
          {lote.capturasHoy.mortalidad ? "Mortalidad registrada hoy ✓" : "Registrar Mortalidad"}
        </Boton>
        <Boton onClick={() => onIr("descarte")} variant={lote.capturasHoy.descarte ? "ghost" : "primary"}>
          {lote.capturasHoy.descarte ? "Descarte registrado hoy ✓" : "Registrar Descarte"}
        </Boton>
        <Boton onClick={() => onIr("alimento")} variant={lote.capturasHoy.alimento ? "ghost" : "primary"}>
          {lote.capturasHoy.alimento ? "Consumo ABA registrado hoy ✓" : "Registrar Consumo ABA"}
        </Boton>
        <Boton onClick={() => onIr("pesaje")} variant={lote.esHito ? "primary" : "ghost"}>
          Registrar Pesaje {lote.esHito ? "(día hito)" : ""}
        </Boton>
        <Boton onClick={() => onIr("cierre")} variant="danger" className="mt-2">
          Cierre de Lote
        </Boton>
      </div>
    </div>
  );
}

function VistaHistorial({ historial }: { historial: EventoHistorial[] }) {
  const ETIQUETA: Record<string, string> = { mortalidad: "Mortalidad", descarte: "Descarte", alimento: "Consumo ABA", pesaje: "Pesaje", saque: "Saque", beneficio: "Beneficio" };
  if (historial.length === 0) return <p className="mt-10 text-center text-sm text-text-muted">Todavía no hay capturas registradas.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-sm font-semibold text-charcoal">Historial de capturas</p>
      {historial.map((h) => (
        <div key={h.id} className="rounded-xl border border-border bg-panel p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-charcoal">{ETIQUETA[h.tipo] ?? h.tipo}</span>
            <span className="text-xs text-text-faint">{h.fecha}</span>
          </div>
          <p className="text-xs text-text-muted">{h.galponNombre} · Lote {h.loteCodigo}</p>
          <p className="mt-1 text-sm text-charcoal">{h.detalle}</p>
        </div>
      ))}
    </div>
  );
}

function VistaPerfil({
  usuario,
  pendientesCount,
  onSincronizar,
  syncEstado,
}: {
  usuario: { nombre: string; rol: string; email: string };
  pendientesCount: number;
  onSincronizar: () => void;
  syncEstado: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-panel p-4">
        <p className="font-display text-lg font-bold text-charcoal">{usuario.nombre}</p>
        <p className="text-sm text-text-muted">{usuario.email}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-text-faint">Rol: {usuario.rol}</p>
      </div>

      <div className="rounded-2xl border border-border bg-panel p-4">
        <p className="text-sm font-semibold text-charcoal">Evidencia y Sincronización</p>
        <p className="mt-1 text-sm text-text-muted">{pendientesCount === 0 ? "Todas las capturas están sincronizadas." : `${pendientesCount} captura(s) guardadas en el equipo, pendientes de enviar.`}</p>
        <Boton className="mt-3" onClick={onSincronizar} disabled={syncEstado === "syncing"}>
          {syncEstado === "syncing" ? "Sincronizando…" : "Sincronizar ahora"}
        </Boton>
      </div>

      <InstallPwaButton label="Instalar app del Galponero" />

      <Boton variant="ghost" onClick={() => signOut()}>Cerrar sesión</Boton>
    </div>
  );
}

// ---------------------------------------------------------------------
// Formularios de captura
// ---------------------------------------------------------------------

function EncabezadoForm({ titulo, subtitulo, onCancelar }: { titulo: string; subtitulo: string; onCancelar: () => void }) {
  return (
    <div className="mb-4">
      <button onClick={onCancelar} className="text-sm font-medium text-text-muted">← Cancelar</button>
      <h2 className="mt-2 font-display text-xl font-bold text-charcoal">{titulo}</h2>
      <p className="text-sm text-text-muted">{subtitulo}</p>
    </div>
  );
}

function FormApertura({ galponId, onListo, onCancelar }: { galponId: string; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [genetica, setGenetica] = useState<Genetica>("cobb_500");
  const [fechaAlojamiento, setFechaAlojamiento] = useState(hoyISO());
  const [poblacionInicial, setPoblacionInicial] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (!codigo || !poblacionInicial) return;
    setEnviando(true);
    const r = await enviarOEncolar({
      etiqueta: `Apertura de Lote — ${codigo}`,
      endpoint: "/api/pollo/lotes",
      campos: { ubicacionId: galponId, codigo, genetica, fechaAlojamiento, poblacionInicial, observaciones },
      fotos: [],
    });
    setEnviando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Apertura de Lote" subtitulo="Se aloja un lote nuevo en este galpón." onCancelar={onCancelar} />
      <Campo label="Código de lote"><input className={campoInput} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="LT-0300" /></Campo>
      <Campo label="Genética">
        <select className={campoInput} value={genetica} onChange={(e) => setGenetica(e.target.value as Genetica)}>
          <option value="cobb_500">Cobb 500</option>
          <option value="ross">Ross 308</option>
          <option value="hubbard">Hubbard 1,2</option>
        </select>
      </Campo>
      <Campo label="Fecha de alojamiento"><input type="date" className={campoInput} value={fechaAlojamiento} onChange={(e) => setFechaAlojamiento(e.target.value)} /></Campo>
      <Campo label="Población inicial (aves)"><input inputMode="numeric" className={campoInput} value={poblacionInicial} onChange={(e) => setPoblacionInicial(e.target.value)} placeholder="5400" /></Campo>
      <Campo label="Observaciones (opcional)"><textarea className={campoInput} rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
      <Boton onClick={guardar} disabled={enviando || !codigo || !poblacionInicial}>{enviando ? "Guardando…" : "Abrir Lote"}</Boton>
    </div>
  );
}

// Un solo día de mortalidad por encima de esta fracción del saldo actual
// es una señal fuerte de fat-finger (un cero de más) más que un evento
// sanitario real — se deja guardar, pero con confirmación explícita.
const UMBRAL_MORTALIDAD_DIARIA_PCT = 5;

function FormMortalidad({ lote, onListo, onCancelar }: { lote: LoteActivoUi; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  const [cantidad, setCantidad] = useState("");
  const [causa, setCausa] = useState(CAUSAS[0].value);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const numCantidad = Number(cantidad || 0);
  const excedeSaldo = numCantidad > lote.saldo; // imposible: no puede morir más de lo que hay vivo — se bloquea, no se pide confirmar
  const pctDelSaldo = lote.saldo > 0 ? (numCantidad / lote.saldo) * 100 : 0;
  const esPicoInusual = !excedeSaldo && numCantidad > 0 && pctDelSaldo >= UMBRAL_MORTALIDAD_DIARIA_PCT;

  function actualizarCantidad(v: string) {
    setCantidad(v);
    setConfirmando(false);
  }

  async function guardar() {
    if (!cantidad || excedeSaldo) return;
    if (esPicoInusual && !confirmando) {
      setConfirmando(true);
      return;
    }
    setEnviando(true);
    const r = await enviarOEncolar({
      etiqueta: `Mortalidad — Lote ${lote.codigo}`,
      endpoint: "/api/pollo/eventos",
      campos: { tipo: "mortalidad", loteId: lote.id, fecha: hoyISO(), edadDias: String(lote.edad), cantidad, causa, creadoEnDispositivo: new Date().toISOString() },
      fotos: [],
    });
    setEnviando(false);
    setConfirmando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Captura de Mortalidad" subtitulo={`Lote ${lote.codigo} · día ${lote.edad} · saldo actual ${fmt(lote.saldo)} aves`} onCancelar={onCancelar} />
      <Campo label="Cantidad de aves muertas hoy"><input inputMode="numeric" className={campoInput} value={cantidad} onChange={(e) => actualizarCantidad(e.target.value)} placeholder="0" /></Campo>
      <Campo label="Causa principal">
        <select className={campoInput} value={causa} onChange={(e) => setCausa(e.target.value)}>
          {CAUSAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Campo>
      {excedeSaldo && (
        <p className="rounded-xl border border-danger bg-[var(--danger-dim)] px-3 py-2 text-sm font-semibold text-danger">
          No puede ser mayor al saldo actual ({fmt(lote.saldo)} aves). Revisá el número.
        </p>
      )}
      {!excedeSaldo && esPicoInusual && (
        <p className="rounded-xl border border-danger bg-[var(--danger-dim)] px-3 py-2 text-sm font-semibold text-danger">
          Es un salto grande para un solo día ({pctDelSaldo.toFixed(1)}% del saldo). Verificá el número antes de confirmar.
        </p>
      )}
      {cantidad && !excedeSaldo && <p className="text-xs text-text-muted">Saldo de aves (auto): {fmt(lote.saldo - numCantidad)}</p>}
      {esPicoInusual && confirmando && !excedeSaldo && <p className="text-xs text-text-muted">Tocá "Confirmar y guardar" de nuevo para guardarlo tal como está.</p>}
      <Boton onClick={guardar} disabled={enviando || !cantidad || excedeSaldo} variant={esPicoInusual ? "danger" : "primary"}>
        {enviando ? "Guardando…" : esPicoInusual ? (confirmando ? "Confirmar y guardar" : "Revisar antes de guardar") : "Guardar Mortalidad"}
      </Boton>
    </div>
  );
}

function FormDescarte({ lote, onListo, onCancelar }: { lote: LoteActivoUi; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const numCantidad = Number(cantidad || 0);
  const excedeSaldo = numCantidad > lote.saldo;

  async function guardar() {
    if (!cantidad || excedeSaldo) return;
    setEnviando(true);
    const r = await enviarOEncolar({
      etiqueta: `Descarte — Lote ${lote.codigo}`,
      endpoint: "/api/pollo/eventos",
      campos: { tipo: "descarte", loteId: lote.id, fecha: hoyISO(), edadDias: String(lote.edad), cantidad, motivo, creadoEnDispositivo: new Date().toISOString() },
      fotos: [],
    });
    setEnviando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Captura de Descarte" subtitulo={`Lote ${lote.codigo} · día ${lote.edad} · saldo actual ${fmt(lote.saldo)} aves`} onCancelar={onCancelar} />
      <Campo label="Cantidad de aves descartadas"><input inputMode="numeric" className={campoInput} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" /></Campo>
      <Campo label="Motivo"><textarea className={campoInput} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Retraso de crecimiento, lesión, etc." /></Campo>
      {excedeSaldo && (
        <p className="rounded-xl border border-danger bg-[var(--danger-dim)] px-3 py-2 text-sm font-semibold text-danger">
          No puede ser mayor al saldo actual ({fmt(lote.saldo)} aves). Revisá el número.
        </p>
      )}
      <Boton onClick={guardar} disabled={enviando || !cantidad || excedeSaldo}>{enviando ? "Guardando…" : "Guardar Descarte"}</Boton>
    </div>
  );
}

function FormAlimento({ lote, onListo, onCancelar }: { lote: LoteActivoUi; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  const [fase, setFase] = useState("Engorde");
  const [sacosDespachados, setSacosDespachados] = useState("");
  const [sacosDevueltos, setSacosDevueltos] = useState("");
  const [enviando, setEnviando] = useState(false);

  const kgConsumidos = Math.max(0, (Number(sacosDespachados || 0) - Number(sacosDevueltos || 0)) * KG_POR_SACO);
  const gramosAveDia = lote.saldo > 0 ? (kgConsumidos * 1000) / lote.saldo : 0;

  async function guardar() {
    if (!sacosDespachados) return;
    setEnviando(true);
    const r = await enviarOEncolar({
      etiqueta: `Consumo ABA — Lote ${lote.codigo}`,
      endpoint: "/api/pollo/eventos",
      campos: {
        tipo: "alimento",
        loteId: lote.id,
        fecha: hoyISO(),
        edadDias: String(lote.edad),
        alimentoConsumidoKg: kgConsumidos.toFixed(2),
        observaciones: `Fase: ${fase} · Sacos despachados: ${sacosDespachados} · devueltos: ${sacosDevueltos || 0}`,
        creadoEnDispositivo: new Date().toISOString(),
      },
      fotos: [],
    });
    setEnviando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Captura de Consumo (ABA)" subtitulo={`Lote ${lote.codigo} · día ${lote.edad} · saco = ${KG_POR_SACO} kg`} onCancelar={onCancelar} />
      <Campo label="Fase de alimentación">
        <select className={campoInput} value={fase} onChange={(e) => setFase(e.target.value)}>
          <option>Pre-inicio</option>
          <option>Inicio</option>
          <option>Engorde</option>
          <option>Finalizador</option>
        </select>
      </Campo>
      <Campo label="Sacos despachados"><input inputMode="numeric" className={campoInput} value={sacosDespachados} onChange={(e) => setSacosDespachados(e.target.value)} placeholder="0" /></Campo>
      <Campo label="Sacos devueltos"><input inputMode="numeric" className={campoInput} value={sacosDevueltos} onChange={(e) => setSacosDevueltos(e.target.value)} placeholder="0" /></Campo>
      {sacosDespachados && (
        <div className="rounded-xl bg-panel-2 px-3 py-2 text-xs text-text-muted">
          Consumido (auto): {kgConsumidos.toFixed(1)} kg · Gr/Ave/Día (auto): {gramosAveDia.toFixed(0)} g
        </div>
      )}
      <Boton onClick={guardar} disabled={enviando || !sacosDespachados}>{enviando ? "Guardando…" : "Guardar Consumo"}</Boton>
    </div>
  );
}

// Rango físico plausible de peso de un pollo de engorde durante todo el
// ciclo (0-35 días): por debajo o por encima de esto, el número no puede
// ser correcto sea cual sea la genética — casi siempre es un error de
// unidades (p.ej. escribir el promedio en la casilla del total, o kg en
// vez de gramos), no un lote real. Ver también UMBRAL_ALERTA_PCT abajo.
const PESO_MIN_PLAUSIBLE_GR = 15;
const PESO_MAX_PLAUSIBLE_GR = 4000;
// Desviación (en cualquier sentido) contra el estándar genético del día a
// partir de la cual NO se deja guardar de un solo toque — obliga a
// confirmar explícitamente que se revisó la báscula y las unidades.
const UMBRAL_ALERTA_PCT = 30;

function FormPesaje({ lote, tabla, onListo, onCancelar }: { lote: LoteActivoUi; tabla: EstandarGeneticoPunto[]; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  // Mismo dato que la columna "Peso prom. (g)" de la hoja de Registro de
  // Granja del cliente: el peso PROMEDIO de un ave, ya calculado por quien
  // pesa — no un total de muestra a dividir acá. Pedir un "total" fue lo
  // que causó el dato erróneo que encontró Amauri (escribió el promedio,
  // el sistema lo tomó como total de 100 aves y salió un "promedio" de
  // 15 g). "Cantidad de aves en la muestra" ahora es solo para trazabilidad
  // — no participa en ninguna cuenta que vea el usuario.
  const [pesoPromedioGr, setPesoPromedioGr] = useState("");
  const [tamanoMuestra, setTamanoMuestra] = useState("10");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const promedioGr = Number(pesoPromedioGr || 0);
  const muestra = Math.max(1, Number(tamanoMuestra || 0));
  const estandarGr = pesoEstandarEnEdad(lote.genetica, lote.edad, tabla);
  const desviacionPct = estandarGr > 0 && promedioGr > 0 ? ((promedioGr - estandarGr) / estandarGr) * 100 : null;
  const fueraDeRangoFisico = promedioGr > 0 && (promedioGr < PESO_MIN_PLAUSIBLE_GR || promedioGr > PESO_MAX_PLAUSIBLE_GR);
  const desviacionSevera = desviacionPct !== null && Math.abs(desviacionPct) >= UMBRAL_ALERTA_PCT;
  const requiereConfirmacion = promedioGr > 0 && (fueraDeRangoFisico || desviacionSevera);

  function actualizarPeso(v: string) {
    setPesoPromedioGr(v);
    setConfirmando(false); // cualquier cambio al valor invalida una confirmación previa
  }

  async function guardar() {
    if (!pesoPromedioGr) return;
    if (requiereConfirmacion && !confirmando) {
      setConfirmando(true);
      return;
    }
    setEnviando(true);
    const totalGr = (promedioGr * muestra).toFixed(1);
    const r = await enviarOEncolar({
      etiqueta: `Pesaje — Lote ${lote.codigo}`,
      endpoint: "/api/pollo/eventos",
      campos: { tipo: "pesaje", loteId: lote.id, fecha: hoyISO(), edadDias: String(lote.edad), pesoMuestraGr: totalGr, tamanoMuestra, creadoEnDispositivo: new Date().toISOString() },
      fotos: [],
    });
    setEnviando(false);
    setConfirmando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Captura de Pesaje" subtitulo={`Lote ${lote.codigo} · día ${lote.edad} · muestra semanal`} onCancelar={onCancelar} />
      <Campo label="Peso promedio del ave (gramos)">
        <input inputMode="numeric" className={campoInput} value={pesoPromedioGr} onChange={(e) => actualizarPeso(e.target.value)} placeholder="0" />
      </Campo>
      <Campo label="Cantidad de aves en la muestra (opcional, solo para registro)">
        <input inputMode="numeric" className={campoInput} value={tamanoMuestra} onChange={(e) => setTamanoMuestra(e.target.value)} />
      </Campo>

      {promedioGr > 0 && (
        <div className={`rounded-xl px-3 py-2 text-sm ${requiereConfirmacion ? "border border-danger bg-[var(--danger-dim)] text-danger" : desviacionPct !== null && desviacionPct < -5 ? "bg-orange-dim text-orange" : "bg-panel-2 text-text-muted"}`}>
          <p>
            Peso promedio: {promedioGr.toFixed(0)} g · Estándar día {lote.edad}: {estandarGr.toFixed(0)} g
            {desviacionPct !== null && (
              <> · Desviación: {desviacionPct >= 0 ? "+" : ""}{desviacionPct.toFixed(1)}%</>
            )}
          </p>
          {fueraDeRangoFisico && (
            <p className="mt-1 font-semibold">
              Ese peso no es posible para un pollo de engorde. Revisá: ¿escribiste el PROMEDIO por ave (no el total ni en kilos)?
            </p>
          )}
          {!fueraDeRangoFisico && desviacionSevera && (
            <p className="mt-1 font-semibold">
              Está muy lejos del estándar de ese día. Verificá la báscula y que el número sea el promedio por ave antes de guardar.
            </p>
          )}
        </div>
      )}

      {requiereConfirmacion && confirmando && (
        <p className="text-xs text-text-muted">Tocá "Confirmar y guardar" de nuevo para guardar este dato tal como está.</p>
      )}

      <Boton onClick={guardar} disabled={enviando || !pesoPromedioGr} variant={requiereConfirmacion ? "danger" : "primary"}>
        {enviando ? "Guardando…" : requiereConfirmacion ? (confirmando ? "Confirmar y guardar" : "Revisar antes de guardar") : "Guardar Pesaje"}
      </Boton>
    </div>
  );
}

function FormCierre({ lote, onListo, onCancelar }: { lote: LoteActivoUi; onListo: (r: "servidor" | "local") => void; onCancelar: () => void }) {
  const [fechaCierre, setFechaCierre] = useState(hoyISO());
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    const r = await enviarOEncolar({
      etiqueta: `Cierre de Lote — ${lote.codigo}`,
      endpoint: `/api/pollo/lotes/${lote.id}/cierre`,
      campos: { fechaCierre },
      fotos: [],
    });
    setEnviando(false);
    onListo(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoForm titulo="Cierre de Lote" subtitulo={`Lote ${lote.codigo} — la edad de sacrificio se calcula automáticamente`} onCancelar={onCancelar} />
      <Campo label="Fecha de salida"><input type="date" className={campoInput} value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} /></Campo>
      <p className="rounded-xl bg-panel-2 px-3 py-2 text-xs text-text-muted">
        La Conciliación con Planta Beneficiadora se registra aparte, desde el portal de Coordinación, una vez que la planta reporte sus cifras.
      </p>
      <Boton variant="danger" onClick={guardar} disabled={enviando}>{enviando ? "Cerrando…" : "Confirmar Cierre de Lote"}</Boton>
    </div>
  );
}
