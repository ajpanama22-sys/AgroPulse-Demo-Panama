// Datos de las vistas Finanzas de la línea, Inventario de insumos (Planta
// ABA) y Consolidado. Solo lectura: Estado de Resultados, lecturas de
// inventario y capturas tal como están guardados.
import { LINEAS, mesCorto, type LineaSlug } from "@/lib/lineas-config";
import { calendario, cumplimiento, edrDeLinea, edrTodas, inventarioInsumos, mesesHasta, pctVar, prevMes, serieMensual, ubicacionesDeLinea, ubicDe, valor } from "@/lib/lineas-data";
import { db } from "@/lib/db/client";
import { alertas as tablaAlertas } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const CONCEPTOS = {
  ingresos: "(+) Ingresos por Ventas (Devengado)",
  costos: "(-) Costos de Venta / Operación",
  bruta: "(=) Utilidad Bruta",
  gastos: "(-) Gastos Operativos",
  ebitda: "(=) EBITDA",
  neta: "(=) UTILIDAD NETA",
};

type EdrRow = Awaited<ReturnType<typeof edrDeLinea>>[number];

function porPeriodo(rows: { periodo: string; concepto: string; meta: number; causado: number }[]) {
  const m: Record<string, Record<string, { meta: number; causado: number }>> = {};
  for (const r of rows) {
    const c = ((m[r.periodo] ??= {})[r.concepto] ??= { meta: 0, causado: 0 });
    c.meta += r.meta;
    c.causado += r.causado;
  }
  return m;
}

export async function datosFinanzas(slug: LineaSlug, periodoPedido?: string) {
  const rows: EdrRow[] = await edrDeLinea(slug);
  const periodos = [...new Set(rows.map((r) => r.periodo))].sort();
  const periodo = periodoPedido && periodos.includes(periodoPedido) ? periodoPedido : periodos.at(-1) ?? "";
  const meses = mesesHasta(periodo, 12).filter((p) => periodos.includes(p));
  const m = porPeriodo(rows);
  const v = (p: string, c: string) => m[p]?.[c] ?? { meta: null as number | null, causado: null as number | null };
  const kpi = (titulo: string, c: string) => ({
    titulo,
    valor: v(periodo, c).causado,
    meta: v(periodo, c).meta,
    delta: pctVar(v(periodo, c).causado, v(prevMes(periodo), c).causado),
    spark: meses.map((p) => v(p, c).causado),
  });
  const lineas = rows
    .filter((r) => r.periodo === periodo)
    .sort((a, b) => a.orden - b.orden)
    .map((r) => ({ concepto: r.concepto, subtotal: r.esSubtotal, meta: r.meta, causado: r.causado }));
  return {
    periodo,
    periodos,
    empresa: rows[0]?.empresa ?? "",
    kpis: [kpi("Ingresos por ventas", CONCEPTOS.ingresos), kpi("Utilidad bruta", CONCEPTOS.bruta), kpi("EBITDA", CONCEPTOS.ebitda), kpi("Utilidad neta", CONCEPTOS.neta)],
    margenEbitda: v(periodo, CONCEPTOS.ingresos).causado ? (v(periodo, CONCEPTOS.ebitda).causado ?? 0) / (v(periodo, CONCEPTOS.ingresos).causado ?? 1) * 100 : null,
    tendencia: { labels: meses.map(mesCorto), ingresos: meses.map((p) => v(p, CONCEPTOS.ingresos).causado), metaIngresos: meses.map((p) => v(p, CONCEPTOS.ingresos).meta), ebitda: meses.map((p) => v(p, CONCEPTOS.ebitda).causado), metaEbitda: meses.map((p) => v(p, CONCEPTOS.ebitda).meta) },
    subtotales: [
      ["Ingresos", CONCEPTOS.ingresos],
      ["Costos", CONCEPTOS.costos],
      ["Utilidad bruta", CONCEPTOS.bruta],
      ["Gastos operativos", CONCEPTOS.gastos],
      ["EBITDA", CONCEPTOS.ebitda],
      ["Utilidad neta", CONCEPTOS.neta],
    ].map(([label, c]) => ({ label, value: v(periodo, c).causado, meta: v(periodo, c).meta })),
    lineas,
  };
}
export type DatosFinanzas = Awaited<ReturnType<typeof datosFinanzas>>;

const FORMULAS: [string, string][] = [
  ["pollo_pre_iniciador", "Pollo pre iniciador"],
  ["pollo_iniciador", "Pollo iniciador"],
  ["pollo_engorde", "Pollo engorde"],
  ["ponedoras_produccion", "Ponedoras producción"],
  ["ponedoras_cria", "Ponedoras cría"],
  ["cerdo_tm", "Cerdo"],
  ["reproductoras_tm", "Reproductoras"],
  ["cria_reproductoras_tm", "Cría reproductoras"],
  ["becerro_lactante_externos", "Becerro lactante (externos)"],
];

export async function datosInventario(mesPedido?: string) {
  const { hoy, meses: disponibles } = await calendario();
  const mes = mesPedido && disponibles.includes(mesPedido) ? mesPedido : hoy.slice(0, 7);
  const ins = await inventarioInsumos();
  const insumos = ins.map((i) => {
    const hasta = i.lecturas.filter((x) => x.fecha <= `${mes}-31`);
    const ult = hasta.at(-1);
    const ultimos = hasta.slice(-90);
    return {
      nombre: i.nombre,
      unidad: i.unidadMedida,
      minimo: i.minimoDias,
      fecha: ult?.fecha ?? null,
      inventario: ult?.inventario ?? null,
      consumo: ult?.consumo ?? null,
      alcance: ult && ult.consumo ? ult.inventario / ult.consumo : null,
      serie: ultimos.map((x) => x.inventario),
      fechas: ultimos.map((x) => x.fecha),
    };
  });
  const ubics = await ubicacionesDeLinea("aba");
  const serie = await serieMensual(ubics.map((u) => u.id), mes, mes);
  const u = ubics[0]?.id;
  const formulas = FORMULAS.map(([k, label]) => ({ label, value: valor(serie, u, k, mes).causado, meta: valor(serie, u, k, mes).meta }));
  const tablas = await db.select().from(tablaAlertas).where(eq(tablaAlertas.resuelta, false)).orderBy(desc(tablaAlertas.creadaEn));
  const alertas = tablas.filter((a) => a.tipo === "inventario_critico").map((a) => ({ nivel: (a.severidad === "alta" ? "alta" : "media") as "alta" | "media", tipo: "Inventario", titulo: a.titulo, detalle: a.detalle }));
  return { mes, disponibles, insumos, formulas, alertas };
}
export type DatosInventario = Awaited<ReturnType<typeof datosInventario>>;

/** Consolidado: una tarjeta por línea + EDR de todas las empresas. */
export async function datosConsolidado(periodoPedido?: string) {
  const { hoy } = await calendario();
  const mes = hoy.slice(0, 7);
  const tarjetas = [];
  for (const l of LINEAS) {
    const ubics = await ubicacionesDeLinea(l.slug);
    const d = l.kpis[0];
    const u = ubicDe(d, ubics);
    const serie = await serieMensual(u ? [u.id] : [], mes, mes);
    const p = valor(serie, u?.id, d.clave, mes);
    tarjetas.push({ slug: l.slug, titulo: d.titulo, valor: p.causado, meta: p.meta, dec: d.dec, unidad: d.unidad, cumpl: cumplimiento(p, d.bueno) });
  }
  const rows = await edrTodas();
  const periodos = [...new Set(rows.map((r) => r.periodo))].sort();
  const periodo = periodoPedido && periodos.includes(periodoPedido) ? periodoPedido : periodos.at(-1) ?? "";
  const del = rows.filter((r) => r.periodo === periodo);
  const empresas = [...new Map(del.map((r) => [r.empresaId, { id: r.empresaId, nombre: r.empresa, slug: r.slug as LineaSlug }])).values()].sort(
    (a, b) => LINEAS.findIndex((l) => l.slug === a.slug) - LINEAS.findIndex((l) => l.slug === b.slug),
  );
  const conceptos = [...new Map(del.sort((a, b) => a.orden - b.orden).map((r) => [r.concepto, { concepto: r.concepto, subtotal: r.esSubtotal, orden: r.orden }])).values()].sort((a, b) => a.orden - b.orden);
  const tabla = conceptos.map((c) => ({
    ...c,
    valores: empresas.map((e) => del.find((r) => r.empresaId === e.id && r.concepto === c.concepto)?.causado ?? null),
    total: del.filter((r) => r.concepto === c.concepto).reduce((s, r) => s + r.causado, 0),
  }));
  const ebitda = empresas.map((e) => {
    const r = del.find((x) => x.empresaId === e.id && x.concepto === CONCEPTOS.ebitda);
    return { slug: e.slug, label: e.nombre, value: r?.causado ?? null, meta: r?.meta ?? null };
  });
  const ingresos = empresas.map((e) => ({ slug: e.slug, label: e.nombre, value: del.find((x) => x.empresaId === e.id && x.concepto === CONCEPTOS.ingresos)?.causado ?? null }));
  const totEbitda = ebitda.reduce((s, x) => s + (x.value ?? 0), 0);
  const totMeta = ebitda.reduce((s, x) => s + (x.meta ?? 0), 0);
  const totIng = ingresos.reduce((s, x) => s + (x.value ?? 0), 0);
  const al = await db.select().from(tablaAlertas).where(eq(tablaAlertas.resuelta, false)).orderBy(desc(tablaAlertas.creadaEn));
  const alertas = al.map((a) => ({ nivel: (a.severidad === "alta" ? "alta" : "media") as "alta" | "media", tipo: a.tipo === "inventario_critico" ? "Planta ABA · Inventario" : "Sanidad", titulo: a.titulo, detalle: a.detalle }));
  return { mes, periodo, periodos, tarjetas, empresas, tabla, ebitda, ingresos, totEbitda, totMeta, totIng, alertas };
}
export type DatosConsolidado = Awaited<ReturnType<typeof datosConsolidado>>;
