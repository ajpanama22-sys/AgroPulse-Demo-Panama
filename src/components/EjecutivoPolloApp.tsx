import Link from "next/link";
import { unidadColor } from "@/lib/theme";
import ProductIcon3D from "@/components/ProductIcon3D";
import InstallPwaButton from "@/components/InstallPwaButton";
import SignOutButton from "@/components/SignOutButton";
import type { IndicadorComparado } from "@/lib/analisis-pollo";

export type GranjaResumenUi = {
  granjaId: string;
  granjaNombre: string;
  loteCodigo: string;
  edad: number;
  pctCumplimientoLote: number;
  semaforo: { label: string; tone: "success" | "orange" | "danger" };
};

export type ConciliacionBloqueadaUi = {
  id: string;
  loteCodigo: string;
  granjaNombre: string;
  desviacionAvesPct: string;
  desviacionPesoPct: string;
};

function fmt(n: number | null | undefined, dec = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-PA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const TONE_BG: Record<string, string> = {
  success: "bg-[var(--success-dim)] text-success",
  orange: "bg-orange-dim text-orange",
  danger: "bg-[var(--danger-dim)] text-danger",
};

// PWA de los Directivos — Pollo de Engorde (El Dorado / Grupo JHS). Versión
// condensada, pensada para revisar el estado de las 13 granjas desde el
// celular: los mismos 4 KPIs núcleo que el Dashboard Ejecutivo de
// escritorio, la lista de granjas en semáforo rojo/naranja primero (lo que
// Gerencia realmente necesita ver sin entrar a cada una), y las alertas de
// Conciliación bloqueada — el resto del detalle vive en el portal completo
// (enlace abajo), que es donde Coordinación hace el trabajo fino.
export default function EjecutivoPolloApp({
  nombreUsuario,
  rol,
  avesVivasTotal,
  mortalidadProm,
  conversionProm,
  pctCumplGlobal,
  indicadores,
  granjas,
  conciliacionesBloqueadas,
}: {
  nombreUsuario: string;
  rol: string;
  avesVivasTotal: number;
  mortalidadProm: number;
  conversionProm: number | null;
  pctCumplGlobal: number;
  indicadores: IndicadorComparado[];
  granjas: GranjaResumenUi[];
  conciliacionesBloqueadas: ConciliacionBloqueadaUi[];
}) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-10">
      <header className="bg-charcoal px-5 pb-5 pt-6 text-white">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Agro<span className="text-orange">Pulse</span>
          </h1>
          <InstallPwaButton label="Instalar" />
        </div>
        <p className="mt-1 text-xs text-white/60">Panel Ejecutivo · Agropecuaria El Dorado — Pollo de Engorde</p>
      </header>

      {conciliacionesBloqueadas.length > 0 && (
        <div className="flex flex-col gap-2 px-5 pt-4">
          {conciliacionesBloqueadas.map((c) => (
            <div key={c.id} className="rounded-xl border border-[var(--warning-border,#f4c98b)] bg-[var(--warning-bg,#fdf0e0)] px-4 py-2.5 text-xs">
              <p className="font-bold text-orange-deep">Conciliación bloqueada — Lote {c.loteCodigo}, {c.granjaNombre}</p>
              <p className="mt-0.5 text-charcoal">Desviación {c.desviacionAvesPct}% aves · {c.desviacionPesoPct}% peso — requiere aprobación de Coordinación Central</p>
            </div>
          ))}
        </div>
      )}

      <main className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <ExecTile accent={unidadColor.pollo} label="Aves Vivas" value={fmt(avesVivasTotal)} />
          <ExecTile accent="#c23b3b" label="Mortalidad Acum." value={`${mortalidadProm.toFixed(1)}%`} />
          <ExecTile accent="#1d5a96" label="Conversión (FCR)" value={conversionProm !== null ? conversionProm.toFixed(2) : "—"} />
          <ExecTile accent="#2f7d4f" label="% Cumplimiento" value={`${Math.round(pctCumplGlobal)}%`} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Indicadores vs. Proyectado</p>
          <div className="flex flex-col gap-2">
            {indicadores.map((i) => (
              <div key={i.clave} className="flex items-center justify-between">
                <span className="text-sm text-text-muted">{i.etiqueta}</span>
                <span className={`text-sm font-bold ${i.pctCumplimiento >= 95 ? "text-success" : i.pctCumplimiento >= 90 ? "text-orange" : "text-danger"}`}>
                  {Math.round(i.pctCumplimiento)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Granjas por estado de cumplimiento</p>
          <div className="flex flex-col gap-2">
            {granjas.slice(0, 8).map((g) => (
              <div key={g.granjaId} className="flex items-center justify-between rounded-xl bg-panel-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-charcoal">{g.granjaNombre}</p>
                  <p className="text-xs text-text-faint">Lote {g.loteCodigo} · día {g.edad}/35</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_BG[g.semaforo.tone]}`}>
                  {Math.round(g.pctCumplimientoLote)}%
                </span>
              </div>
            ))}
            {granjas.length === 0 && <p className="text-sm text-text-muted">Sin lotes activos.</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {/* Gerencia queda encerrada en este panel móvil a nivel de
             middleware (nunca navega al portal de escritorio completo) —
             ese link solo tiene sentido, y solo funciona, para Coordinación. */}
          {rol !== "gerencial" ? (
            <Link href="/pollo" className="text-xs font-semibold text-orange">
              Ver portal completo →
            </Link>
          ) : (
            <span />
          )}
          <SignOutButton className="text-xs text-text-faint" />
        </div>
        <p className="mt-1 text-[10px] text-text-faint">Conectado como {nombreUsuario}</p>
      </main>
    </div>
  );
}

function ExecTile({ accent, label, value }: { accent: string; label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-panel p-3">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-center gap-2">
        <ProductIcon3D tipo="pollo" size={44} />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-faint">{label}</p>
          <p className="truncate font-display text-lg font-bold text-charcoal">{value}</p>
        </div>
      </div>
    </div>
  );
}
