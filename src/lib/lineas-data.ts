// Lecturas (solo SELECT) que alimentan los cuatro modales. No crea, no
// modifica y no recalcula datos guardados: agrupa por mes lo que ya está en
// `capturas`, `edr_lineas`, `lecturas_insumo` y `alertas`.
import { sql, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertas, capturas, edrLineas, empresas, indicadores, insumos, lecturasInsumo, ubicacionIndicadores, ubicaciones, unidadesNegocio } from "@/lib/db/schema";
import { lineaPorSlug, type LineaSlug, type Destacado } from "@/lib/lineas-config";

export type Ubic = { id: string; nombre: string; empresaId: string; empresaNombre: string };
export type Punto = { causado: number | null; meta: number | null };
/** serie[ubicacionId][clave][mes] */
export type Serie = Record<string, Record<string, Record<string, Punto>>>;

const prevMes = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, "0")}`;
};
export const mesesHasta = (m: string, n: number) => {
  const out = [m];
  while (out.length < n) out.unshift(prevMes(out[0]));
  return out;
};
const nextMes = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
};
export { prevMes, nextMes };

/** Ubicaciones con captura diaria de una línea (la línea "pollo" también
 * contiene a El Dorado, cuyas granjas no capturan en `capturas`). */
export async function ubicacionesDeLinea(slug: LineaSlug): Promise<Ubic[]> {
  const rows = await db
    .select({ id: ubicaciones.id, nombre: ubicaciones.nombre, empresaId: empresas.id, empresaNombre: empresas.nombre })
    .from(ubicaciones)
    .innerJoin(empresas, eq(empresas.id, ubicaciones.empresaId))
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
    .where(eq(unidadesNegocio.slug, slug));
  if (!rows.length) return [];
  const conDatos = await db
    .selectDistinct({ id: capturas.ubicacionId })
    .from(capturas)
    .where(inArray(capturas.ubicacionId, rows.map((r) => r.id)));
  const ids = new Set(conDatos.map((r) => r.id));
  return rows.filter((r) => ids.has(r.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Último día con captura y lista de meses disponibles. */
export async function calendario() {
  const r = await db.execute(sql`select max(fecha)::text as hoy, min(fecha)::text as desde from capturas`);
  const row = (r as unknown as { rows: { hoy: string | null; desde: string | null }[] }).rows[0];
  const hoy = row?.hoy ?? "2026-08-28";
  const desde = row?.desde ?? hoy;
  const meses: string[] = [];
  let m = hoy.slice(0, 7);
  while (m >= desde.slice(0, 7) && meses.length < 60) {
    meses.unshift(m);
    m = prevMes(m);
  }
  return { hoy, meses };
}

/** Promedio diario por mes (causado y meta) de cada indicador, por ubicación. */
export async function serieMensual(ubicacionIds: string[], desde: string, hasta: string): Promise<Serie> {
  if (!ubicacionIds.length) return {};
  const lista = sql.join(ubicacionIds.map((id) => sql`${id}`), sql`, `);
  const r = await db.execute(sql`
    select c.ubicacion_id as u, to_char(c.fecha, 'YYYY-MM') as m, kv.key as k,
           avg((kv.value->>'causado')::numeric)::float8 as causado,
           avg((kv.value->>'meta')::numeric)::float8 as meta
    from capturas c, jsonb_each(c.valores) kv
    where c.ubicacion_id in (${lista}) and c.fecha >= ${desde + "-01"} and c.fecha < ${nextMes(hasta) + "-01"}
    group by 1, 2, 3`);
  const out: Serie = {};
  for (const row of (r as unknown as { rows: { u: string; m: string; k: string; causado: number | null; meta: number | null }[] }).rows) {
    ((out[row.u] ??= {})[row.k] ??= {})[row.m] = { causado: row.causado == null ? null : Number(row.causado), meta: row.meta == null ? null : Number(row.meta) };
  }
  return out;
}

export type IndicadorInfo = { clave: string; etiqueta: string; unidadMedida: string; tipoValor: string; notaTecnica: string | null; requiereMeta: boolean; orden: number };

/** Catálogo de indicadores asignados a cada ubicación, en su orden. */
export async function indicadoresPorUbicacion(ubicacionIds: string[]): Promise<Record<string, IndicadorInfo[]>> {
  if (!ubicacionIds.length) return {};
  const rows = await db
    .select({
      ubicacionId: ubicacionIndicadores.ubicacionId,
      orden: ubicacionIndicadores.orden,
      clave: indicadores.clave,
      etiqueta: indicadores.etiqueta,
      unidadMedida: indicadores.unidadMedida,
      tipoValor: indicadores.tipoValor,
      notaTecnica: indicadores.notaTecnica,
      requiereMeta: indicadores.requiereMeta,
    })
    .from(ubicacionIndicadores)
    .innerJoin(indicadores, eq(indicadores.id, ubicacionIndicadores.indicadorId))
    .where(inArray(ubicacionIndicadores.ubicacionId, ubicacionIds));
  const out: Record<string, IndicadorInfo[]> = {};
  for (const r of rows) (out[r.ubicacionId] ??= []).push(r);
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.orden - b.orden);
  return out;
}

/** Ubicación que corresponde a un indicador destacado. */
export function ubicDe(d: Destacado, ubics: Ubic[]): Ubic | undefined {
  return d.ubicacion ? ubics.find((u) => u.nombre.toLowerCase().includes(d.ubicacion!.toLowerCase())) : ubics[0];
}

export function valor(serie: Serie, ubicId: string | undefined, clave: string, mes: string): Punto {
  return (ubicId && serie[ubicId]?.[clave]?.[mes]) || { causado: null, meta: null };
}

export function pctVar(a: number | null, b: number | null) {
  return a != null && b != null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
}

/** Cumplimiento de meta en % orientado: >100 siempre es "mejor que la meta". */
export function cumplimiento(p: Punto, bueno: "up" | "down") {
  if (p.causado == null || p.meta == null || p.meta === 0) return null;
  return bueno === "up" ? (p.causado / p.meta) * 100 : (p.meta / (p.causado || 1e-9)) * 100;
}

/** Sentido de cada indicador del catálogo, por su nombre. */
export function sentido(clave: string): "up" | "down" {
  return /mortalidad|conversion|descarte|merma|pollo_b|edad_salida/.test(clave) ? "down" : "up";
}

export async function alertasDeLinea(slug: LineaSlug, ubics: Ubic[]) {
  const todas = await db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn));
  const ids = new Set(ubics.map((u) => u.id));
  return todas.filter((a) => (slug === "aba" ? a.tipo === "inventario_critico" : a.entidadRef != null && ids.has(a.entidadRef)));
}

/** Estado de Resultados de las empresas de la línea, por período. */
export async function edrDeLinea(slug: LineaSlug) {
  const rows = await db
    .select({ empresaId: edrLineas.empresaId, empresa: empresas.nombre, periodo: edrLineas.periodo, concepto: edrLineas.concepto, orden: edrLineas.orden, esSubtotal: edrLineas.esSubtotal, meta: edrLineas.meta, causado: edrLineas.causado })
    .from(edrLineas)
    .innerJoin(empresas, eq(empresas.id, edrLineas.empresaId))
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
    .where(eq(unidadesNegocio.slug, slug));
  return rows.map((r) => ({ ...r, meta: Number(r.meta), causado: Number(r.causado) }));
}

/** Estado de Resultados de todas las empresas (para el consolidado). */
export async function edrTodas() {
  const rows = await db
    .select({ empresaId: edrLineas.empresaId, empresa: empresas.nombre, slug: unidadesNegocio.slug, periodo: edrLineas.periodo, concepto: edrLineas.concepto, orden: edrLineas.orden, esSubtotal: edrLineas.esSubtotal, meta: edrLineas.meta, causado: edrLineas.causado })
    .from(edrLineas)
    .innerJoin(empresas, eq(empresas.id, edrLineas.empresaId))
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId));
  return rows.map((r) => ({ ...r, meta: Number(r.meta), causado: Number(r.causado) }));
}

export async function inventarioInsumos() {
  const ins = await db.select().from(insumos);
  const lect = await db.select().from(lecturasInsumo).orderBy(lecturasInsumo.fecha);
  return ins.map((i) => {
    const l = lect.filter((x) => x.insumoId === i.id).map((x) => ({ fecha: String(x.fecha), inventario: Number(x.inventarioActual), consumo: Number(x.consumoDiarioPromedio) }));
    return { ...i, lecturas: l };
  });
}

export function lineaOr404(slug: string) {
  const l = lineaPorSlug(slug);
  if (!l) throw new Error("Línea no encontrada");
  return l;
}

export async function unidadDelUsuario(empresaId: string | null | undefined) {
  if (!empresaId) return null;
  const [r] = await db
    .select({ slug: unidadesNegocio.slug })
    .from(empresas)
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
    .where(eq(empresas.id, empresaId))
    .limit(1);
  return r?.slug ?? null;
}

