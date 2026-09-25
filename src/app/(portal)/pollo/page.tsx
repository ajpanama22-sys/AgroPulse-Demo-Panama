import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { empresas, ubicaciones, lotesPollo, loteEventosPollo, estandarGenetico, conciliacionesPlanta } from "@/lib/db/schema";
import { Card, PageHeader, Badge, StatTile } from "@/components/ui";
import ProductIcon3D from "@/components/ProductIcon3D";
import GraficoCumplimiento from "@/components/pollo/GraficoCumplimiento";
import GraficoPesoRealVsEstandar from "@/components/pollo/GraficoPesoRealVsEstandar";
import EstandarGeneticoTable from "@/components/pollo/EstandarGeneticoTable";
import ConciliacionPanel from "@/components/pollo/ConciliacionPanel";
import {
  resumirLote,
  construirIndicadoresDashboard,
  serieRealVsEstandar,
  estadoSemaforo,
  type LotePollo,
  type EventoLote,
  type EstandarGeneticoPunto,
} from "@/lib/analisis-pollo";

// Fecha de referencia del demo — mismo "hoy" sintético que usa el seed
// (scripts/seed-el-dorado.mts), para que la edad/día-de-ciclo de cada lote
// no se "envejezca" con el reloj real del servidor.
const HOY_DEMO = new Date("2026-09-18T00:00:00Z");

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "granjas", label: "Granjas" },
  { key: "lotes", label: "Lotes" },
  { key: "estandar", label: "Estándar Genético" },
  { key: "conciliacion", label: "Conciliación" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-PA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

async function cargarDatosElDorado() {
  const [elDorado] = await db.select().from(empresas).where(eq(empresas.nombre, "Agropecuaria El Dorado — División de Grupo JHS"));
  if (!elDorado) return null;

  const todasUbicaciones = await db.select().from(ubicaciones).where(eq(ubicaciones.empresaId, elDorado.id));
  const granjas = todasUbicaciones.filter((u) => u.tipo === "granja").sort((a, b) => a.nombre.localeCompare(b.nombre));
  const galpones = todasUbicaciones.filter((u) => u.tipo === "galpon");
  const galponPorId = Object.fromEntries(galpones.map((g) => [g.id, g]));
  const granjaPorId = Object.fromEntries(granjas.map((g) => [g.id, g]));
  const galponIds = galpones.map((g) => g.id);

  const lotes = galponIds.length ? await db.select().from(lotesPollo).where(inArray(lotesPollo.ubicacionId, galponIds)) : [];
  const lotesActivos = lotes.filter((l) => l.estado === "activo") as unknown as LotePollo[];
  const lotesCerrados = lotes.filter((l) => l.estado === "cerrado") as unknown as LotePollo[];
  const loteIds = lotes.map((l) => l.id);

  const eventos = loteIds.length ? await db.select().from(loteEventosPollo).where(inArray(loteEventosPollo.loteId, loteIds)) : [];
  const eventosPorLote: Record<string, EventoLote[]> = {};
  for (const e of eventos) (eventosPorLote[e.loteId] ??= []).push(e as unknown as EventoLote);

  const tabla = (await db.select().from(estandarGenetico)) as unknown as (EstandarGeneticoPunto & { fuente: string | null })[];

  const conciliacionesRaw = await db.select().from(conciliacionesPlanta);
  const loteById = Object.fromEntries(lotes.map((l) => [l.id, l]));
  const conciliaciones = conciliacionesRaw
    .map((c) => {
      const lote = loteById[c.loteId];
      const galpon = lote ? galponPorId[lote.ubicacionId] : undefined;
      const granja = galpon?.padreId ? granjaPorId[galpon.padreId] : undefined;
      return {
        id: c.id,
        loteCodigo: lote?.codigo ?? "—",
        granjaNombre: granja?.nombre ?? "—",
        fecha: c.fecha,
        avesReportadasGranja: c.avesReportadasGranja,
        kgReportadosGranja: c.kgReportadosGranja,
        avesReportadasPlanta: c.avesReportadasPlanta,
        kgReportadosPlanta: c.kgReportadosPlanta,
        desviacionAvesPct: c.desviacionAvesPct,
        desviacionPesoPct: c.desviacionPesoPct,
        estado: c.estado,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return { elDorado, granjas, galpones, galponPorId, granjaPorId, lotesActivos, lotesCerrados, eventosPorLote, tabla, conciliaciones };
}

export default async function PolloPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? "dashboard") as TabKey;
  const datos = await cargarDatosElDorado();

  return (
    <div>
      <PageHeader
        title="Pollo de Engorde — El Dorado"
        subtitle="Agropecuaria El Dorado · División de Grupo JHS"
        action={
          <div className="shrink-0">
            <ProductIcon3D tipo="pollo" size={56} />
          </div>
        }
      />

      <div className="border-b border-border px-8">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`?tab=${t.key}`}
              className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? "border-b-2 border-orange text-orange" : "text-text-muted hover:text-charcoal"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="px-8 py-6">
        {!datos && (
          <Card>
            <p className="text-sm text-text-muted">
              Todavía no hay datos de El Dorado en la base. Corré <code>npm run seed:el-dorado</code> para sembrar las 13 granjas, los lotes y el estándar genético.
            </p>
          </Card>
        )}

        {datos && tab === "dashboard" && <DashboardTab {...datos} />}
        {datos && tab === "granjas" && <GranjasTab {...datos} />}
        {datos && tab === "lotes" && <LotesTab {...datos} />}
        {datos && tab === "estandar" && <EstandarGeneticoTable filas={datos.tabla} />}
        {datos && tab === "conciliacion" && <ConciliacionPanel conciliaciones={datos.conciliaciones} puedeAprobar />}
      </div>
    </div>
  );
}

type Datos = NonNullable<Awaited<ReturnType<typeof cargarDatosElDorado>>>;

function DashboardTab({ lotesActivos, lotesCerrados, eventosPorLote, tabla, galponPorId, granjaPorId }: Datos) {
  const resumenes = lotesActivos.map((l) => resumirLote(l, eventosPorLote[l.id] ?? [], tabla, HOY_DEMO));
  const indicadores = construirIndicadoresDashboard(resumenes);
  const serie = serieRealVsEstandar([...lotesActivos, ...lotesCerrados], eventosPorLote, tabla);

  const avesVivasTotal = resumenes.reduce((s, r) => s + r.saldo, 0);
  const avesAlojadasTotal = lotesActivos.reduce((s, l) => s + l.poblacionInicial, 0);
  const mortalidadProm = resumenes.length ? resumenes.reduce((s, r) => s + r.pctMortalidad, 0) / resumenes.length : 0;
  const conversionProm = (() => {
    const vals = resumenes.map((r) => r.conversion).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();
  const pctCumplGlobal = indicadores.reduce((s, i) => s + i.pctCumplimiento, 0) / indicadores.length;

  const filasSemaforo = resumenes
    .map((r) => {
      const galpon = galponPorId[r.lote.ubicacionId];
      const granja = galpon?.padreId ? granjaPorId[galpon.padreId] : undefined;
      return { ...r, granjaNombre: granja?.nombre ?? "—", galponNombre: galpon?.nombre ?? "—", semaforo: estadoSemaforo(r.pctCumplimientoLote) };
    })
    .sort((a, b) => a.pctCumplimientoLote - b.pctCumplimientoLote);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Aves Vivas (Inventario)" value={fmt(avesVivasTotal)} hint={`${avesVivasTotal - avesAlojadasTotal >= 0 ? "+" : ""}${fmt(avesVivasTotal - avesAlojadasTotal)} vs. alojadas`} />
        <StatTile label="Mortalidad Acumulada" value={`${mortalidadProm.toFixed(1)}%`} hint="promedio 13 granjas" />
        <StatTile label="Conversión (FCR)" value={conversionProm !== null ? conversionProm.toFixed(2) : "—"} hint="promedio 13 granjas" />
        <StatTile label="% Cumplimiento Global" value={`${Math.round(pctCumplGlobal)}%`} hint={pctCumplGlobal >= 95 ? "Dentro de meta" : "Revisar indicadores en rojo"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-charcoal">% Cumplimiento por indicador</p>
          <p className="text-xs text-text-muted">Ejecutado vs. Proyectado — 8 indicadores productivos</p>
          <GraficoCumplimiento indicadores={indicadores} />
        </Card>
        <Card>
          <p className="text-sm font-semibold text-charcoal">Peso Promedio — Real vs. Estándar</p>
          <p className="text-xs text-text-muted">Gramos por día de ciclo (0-35)</p>
          <GraficoPesoRealVsEstandar serie={serie} />
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-charcoal">Granjas por estado de cumplimiento</p>
          <Badge tone="neutral">Semáforo operativo · {filasSemaforo.length} granjas</Badge>
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
              <th className="py-2 pr-4">Granja</th>
              <th className="py-2 pr-4">Lote</th>
              <th className="py-2 pr-4">Día de ciclo</th>
              <th className="py-2 pr-4">Conversión</th>
              <th className="py-2 pr-4">% Cumpl.</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasSemaforo.map((f) => (
              <tr key={f.lote.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-charcoal">{f.granjaNombre}</td>
                <td className="py-2 pr-4 text-text-muted">{f.lote.codigo}</td>
                <td className="py-2 pr-4 text-text-muted">{f.edad} / 35</td>
                <td className="py-2 pr-4 tabular-nums text-charcoal">{f.conversion !== null ? f.conversion.toFixed(2) : "—"}</td>
                <td className="py-2 pr-4 tabular-nums text-charcoal">{Math.round(f.pctCumplimientoLote)}%</td>
                <td className="py-2">
                  <Badge tone={f.semaforo.tone}>{f.semaforo.label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function GranjasTab({ granjas, galpones, lotesActivos }: Datos) {
  const galponesPorGranja: Record<string, number> = {};
  for (const g of galpones) if (g.padreId) galponesPorGranja[g.padreId] = (galponesPorGranja[g.padreId] ?? 0) + 1;
  const lotesActivosPorGranja: Record<string, number> = {};
  const galponPorId = Object.fromEntries(galpones.map((g) => [g.id, g]));
  for (const l of lotesActivos) {
    const galpon = galponPorId[l.ubicacionId];
    if (galpon?.padreId) lotesActivosPorGranja[galpon.padreId] = (lotesActivosPorGranja[galpon.padreId] ?? 0) + 1;
  }
  const destacada = granjas[0];

  return (
    <div className="flex flex-col gap-6">
      {destacada && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-charcoal">Granja {destacada.nombre}</p>
            <Badge tone="neutral">{granjas.length} granjas registradas</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Galpones" value={fmt(galponesPorGranja[destacada.id] ?? 0)} />
            <StatTile label="Supervisor" value={destacada.supervisorNombre ?? "—"} />
            <StatTile label="Personal Asociado" value={fmt(destacada.personalAsociado)} />
            <StatTile label="Lotes Activos" value={fmt(lotesActivosPorGranja[destacada.id] ?? 0)} />
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-charcoal">Todas las granjas</p>
          <Badge tone="neutral">{granjas.length} precargadas · en edición progresiva</Badge>
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
              <th className="py-2 pr-4">Granja</th>
              <th className="py-2 pr-4">Galpones</th>
              <th className="py-2 pr-4">Supervisor</th>
              <th className="py-2 pr-4">Personal Asociado</th>
              <th className="py-2">Estado de Datos</th>
            </tr>
          </thead>
          <tbody>
            {granjas.map((g) => (
              <tr key={g.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-charcoal">{g.nombre}</td>
                <td className="py-2 pr-4 tabular-nums text-charcoal">{galponesPorGranja[g.id] ?? 0}</td>
                <td className="py-2 pr-4 text-text-muted">{g.supervisorNombre ?? "(pendiente)"}</td>
                <td className="py-2 pr-4 text-text-muted">{g.personalAsociado ?? "(pendiente)"}</td>
                <td className="py-2">
                  <Badge tone={g.estadoDatos === "completo" ? "success" : "orange"}>{g.estadoDatos === "completo" ? "Completo" : "Por completar"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function LotesTab({ lotesActivos, eventosPorLote, tabla, galponPorId, granjaPorId }: Datos) {
  const filas = lotesActivos
    .map((l) => {
      const r = resumirLote(l, eventosPorLote[l.id] ?? [], tabla, HOY_DEMO);
      const galpon = galponPorId[l.ubicacionId];
      const granja = galpon?.padreId ? granjaPorId[galpon.padreId] : undefined;
      return { ...r, granjaNombre: granja?.nombre ?? "—", galponNombre: galpon?.nombre ?? "—", semaforo: estadoSemaforo(r.pctCumplimientoLote) };
    })
    .sort((a, b) => a.granjaNombre.localeCompare(b.granjaNombre));

  return (
    <Card className="overflow-x-auto">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-charcoal">Lotes activos · las {filas.length} granjas</p>
        <Badge tone="neutral">Actualizado con la última captura</Badge>
      </div>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
            <th className="py-2 pr-4">Lote</th>
            <th className="py-2 pr-4">Granja / Galpón</th>
            <th className="py-2 pr-4">Raza</th>
            <th className="py-2 pr-4">Día de ciclo</th>
            <th className="py-2 pr-4">Aves vivas</th>
            <th className="py-2 pr-4">% Cumpl.</th>
            <th className="py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.lote.id} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium text-charcoal">{f.lote.codigo}</td>
              <td className="py-2 pr-4 text-text-muted">{f.granjaNombre} · {f.galponNombre}</td>
              <td className="py-2 pr-4 text-text-muted">{f.lote.genetica.replace("_", " ").toUpperCase()}</td>
              <td className="py-2 pr-4 text-text-muted">{f.edad} / 35</td>
              <td className="py-2 pr-4 tabular-nums text-charcoal">{fmt(f.saldo)}</td>
              <td className="py-2 pr-4 tabular-nums text-charcoal">{Math.round(f.pctCumplimientoLote)}%</td>
              <td className="py-2">
                <Badge tone={f.semaforo.tone}>{f.semaforo.label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
