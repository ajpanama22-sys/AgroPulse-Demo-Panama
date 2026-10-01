import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ubicaciones, empresas, lotesPollo, loteEventosPollo, estandarGenetico, conciliacionesPlanta } from "@/lib/db/schema";
import { resumirLote, construirIndicadoresDashboard, estadoSemaforo, type LotePollo, type EventoLote, type EstandarGeneticoPunto } from "@/lib/analisis-pollo";
import EjecutivoPolloApp from "@/components/EjecutivoPolloApp";
import EjecutivoShell from "@/components/shell/EjecutivoShell";
import { PulseView } from "@/components/lineas/Vistas";
import ConsolidadoView from "@/components/lineas/ConsolidadoView";
import { lineaPorSlug } from "@/lib/lineas-config";
import { datosLinea } from "@/lib/lineas-vistas";
import { datosConsolidado } from "@/lib/lineas-extra";

const HOY_DEMO_POLLO = new Date("2026-09-18T00:00:00Z");

// El Dorado tiene su propia versión del panel ejecutivo (KPIs de Pollo de
// Engorde en vez del EDR multi-línea de Agroindustrias del Istmo) — se
// distingue por la empresa del usuario logueado, no por rol, porque
// "gerencial" existe en ambos demos que conviven en la misma base.
async function cargarPanelElDorado(empresaId: string) {
  const todasUbicaciones = await db.select().from(ubicaciones).where(eq(ubicaciones.empresaId, empresaId));
  const granjas = todasUbicaciones.filter((u) => u.tipo === "granja");
  const galpones = todasUbicaciones.filter((u) => u.tipo === "galpon");
  const granjaPorId = Object.fromEntries(granjas.map((g) => [g.id, g]));
  const galponPorId = Object.fromEntries(galpones.map((g) => [g.id, g]));
  const galponIds = galpones.map((g) => g.id);

  const lotes = galponIds.length ? await db.select().from(lotesPollo).where(inArray(lotesPollo.ubicacionId, galponIds)) : [];
  const lotesActivos = lotes.filter((l) => l.estado === "activo") as unknown as LotePollo[];
  const loteIds = lotesActivos.map((l) => l.id);

  const eventos = loteIds.length ? await db.select().from(loteEventosPollo).where(inArray(loteEventosPollo.loteId, loteIds)) : [];
  const eventosPorLote: Record<string, EventoLote[]> = {};
  for (const e of eventos) (eventosPorLote[e.loteId] ??= []).push(e as unknown as EventoLote);

  const tablaRaw = await db.select().from(estandarGenetico);
  const tabla: EstandarGeneticoPunto[] = tablaRaw.map((f) => ({ genetica: f.genetica, edadDias: f.edadDias, pesoEstandarGr: Number(f.pesoEstandarGr) }));

  const resumenes = lotesActivos.map((l) => resumirLote(l, eventosPorLote[l.id] ?? [], tabla, HOY_DEMO_POLLO));
  const indicadores = construirIndicadoresDashboard(resumenes);

  const avesVivasTotal = resumenes.reduce((s, r) => s + r.saldo, 0);
  const mortalidadProm = resumenes.length ? resumenes.reduce((s, r) => s + r.pctMortalidad, 0) / resumenes.length : 0;
  const conversionVals = resumenes.map((r) => r.conversion).filter((v): v is number => v !== null);
  const conversionProm = conversionVals.length ? conversionVals.reduce((s, v) => s + v, 0) / conversionVals.length : null;
  const pctCumplGlobal = indicadores.length ? indicadores.reduce((s, i) => s + i.pctCumplimiento, 0) / indicadores.length : 0;

  const granjasUi = resumenes
    .map((r) => {
      const galpon = galponPorId[r.lote.ubicacionId];
      const granja = galpon?.padreId ? granjaPorId[galpon.padreId] : undefined;
      return {
        granjaId: granja?.id ?? r.lote.id,
        granjaNombre: granja?.nombre ?? "—",
        loteCodigo: r.lote.codigo,
        edad: r.edad,
        pctCumplimientoLote: r.pctCumplimientoLote,
        semaforo: estadoSemaforo(r.pctCumplimientoLote),
      };
    })
    .sort((a, b) => a.pctCumplimientoLote - b.pctCumplimientoLote);

  const loteById = Object.fromEntries(lotes.map((l) => [l.id, l]));
  const conciliacionesRaw = await db.select().from(conciliacionesPlanta).where(eq(conciliacionesPlanta.estado, "bloqueado"));
  const conciliacionesBloqueadas = conciliacionesRaw.map((c) => {
    const lote = loteById[c.loteId];
    const galpon = lote ? galponPorId[lote.ubicacionId] : undefined;
    const granja = galpon?.padreId ? granjaPorId[galpon.padreId] : undefined;
    return {
      id: c.id,
      loteCodigo: lote?.codigo ?? "—",
      granjaNombre: granja?.nombre ?? "—",
      desviacionAvesPct: c.desviacionAvesPct,
      desviacionPesoPct: c.desviacionPesoPct,
    };
  });

  return { avesVivasTotal, mortalidadProm, conversionProm, pctCumplGlobal, indicadores, granjasUi, conciliacionesBloqueadas };
}

export default async function EjecutivoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();

  if (session?.user.empresaId) {
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, session.user.empresaId));
    if (empresa?.nombre === "Agropecuaria El Dorado — División de Grupo JHS") {
      const panel = await cargarPanelElDorado(empresa.id);
      return (
        <EjecutivoPolloApp
          nombreUsuario={session.user.name ?? "Directivo"}
          rol={session.user.rol}
          avesVivasTotal={panel.avesVivasTotal}
          mortalidadProm={panel.mortalidadProm}
          conversionProm={panel.conversionProm}
          pctCumplGlobal={panel.pctCumplGlobal}
          indicadores={panel.indicadores}
          granjas={panel.granjasUi}
          conciliacionesBloqueadas={panel.conciliacionesBloqueadas}
        />
      );
    }
  }

  // Pulse gerencial de Agroindustrias del Istmo: consolidado + un Pulse por
  // línea, con la misma presentación de los modales del portal.
  const sp = await searchParams;
  const linea = lineaPorSlug(sp.vista ?? "");
  const contenido = linea ? <PulseView slug={linea.slug} d={await datosLinea(linea, sp.mes)} pwa /> : <ConsolidadoView d={await datosConsolidado(sp.periodo)} pwa />;
  return (
    <EjecutivoShell nombre={session?.user.name ?? "Gerencia"} actual={linea?.slug ?? "consolidado"}>
      {contenido}
    </EjecutivoShell>
  );
}
