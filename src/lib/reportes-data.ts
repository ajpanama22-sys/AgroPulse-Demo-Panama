// Capa de datos compartida por TODO el módulo de Reportes (Excel y PDF).
// Centraliza los joins correctos — en particular empresa → unidad de
// negocio vía `unidadesNegocio.slug`, no por coincidencia de texto en el
// nombre de la empresa (el código viejo de /api/reportes/* y
// /lib/analisis.ts buscaba "HUEVOS"/"DORADO"/"CERDOS" en el nombre, que
// eran los nombres del cliente real — con los nombres sintéticos de esta
// demo ("Avícola Coclé", "Avícola Chiriquí", "Porcícola Azuero", "Planta
// AgroIstmo") esa coincidencia nunca matcheaba nada, así que la unidad de
// negocio quedaba vacía en cualquier reporte que dependiera de eso).
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  edrLineas,
  empresas,
  unidadesNegocio,
  ubicaciones,
  insumos,
  lecturasInsumo,
  organizacion,
  lotesPollo,
  loteEventosPollo,
  auditoria,
  alertas,
} from "@/lib/db/schema";
import { avesVivas, edadDelLote, conversionActual, ieeActual, pctMortalidad, pctViabilidad, pesoPromedioActualKg, alimentoAcumuladoKg, mortalidadAcumulada, type LotePollo, type EventoLote } from "@/lib/analisis-pollo";

export type UnidadInfo = {
  empresaId: string;
  empresaNombre: string;
  unidadId: string;
  unidadSlug: string;
  unidadNombre: string;
  colorHex: string;
  orden: number;
};

/** Un registro por empresa con su unidad de negocio ya resuelta — la base
 * de la que parte cualquier reporte que necesite agrupar/colorear por
 * unidad (Huevos/Pollo/Cerdo/Planta ABA). */
export async function unidadesPorEmpresa(): Promise<Record<string, UnidadInfo>> {
  const rows = await db
    .select({
      empresaId: empresas.id,
      empresaNombre: empresas.nombre,
      unidadId: unidadesNegocio.id,
      unidadSlug: unidadesNegocio.slug,
      unidadNombre: unidadesNegocio.nombre,
      colorHex: unidadesNegocio.colorHex,
      orden: unidadesNegocio.orden,
    })
    .from(empresas)
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
    .orderBy(unidadesNegocio.orden);
  return Object.fromEntries(rows.map((r) => [r.empresaId, r]));
}

export async function getOrganizacion() {
  const [org] = await db.select().from(organizacion).limit(1);
  return org ?? null;
}

export async function periodosEdrDisponibles(): Promise<string[]> {
  const rows = await db.selectDistinct({ periodo: edrLineas.periodo }).from(edrLineas);
  return rows.map((r) => r.periodo).sort();
}

export async function edrEnRango(desde: string, hasta: string) {
  return db
    .select()
    .from(edrLineas)
    .where(and(gte(edrLineas.periodo, desde), lte(edrLineas.periodo, hasta)));
}

/** Agrega el EDR de un rango de períodos por empresa+concepto (sumando mes
 * a mes) — lo que necesita tanto el Excel (una fila por partida) como el
 * PDF (los KPIs y las gráficas). */
export function agregarEdrPorEmpresa(lineas: Awaited<ReturnType<typeof edrEnRango>>) {
  const porEmpresa = new Map<string, Map<string, { meta: number; causado: number }>>();
  for (const l of lineas) {
    if (!porEmpresa.has(l.empresaId)) porEmpresa.set(l.empresaId, new Map());
    const porConcepto = porEmpresa.get(l.empresaId)!;
    const prev = porConcepto.get(l.concepto) ?? { meta: 0, causado: 0 };
    porConcepto.set(l.concepto, { meta: prev.meta + Number(l.meta), causado: prev.causado + Number(l.causado) });
  }
  return porEmpresa;
}

export const CONCEPTO_INGRESOS = "(+) Ingresos por Ventas (Devengado)";
export const CONCEPTO_EBITDA = "(=) EBITDA";
export const CONCEPTO_UTILIDAD_NETA = "(=) UTILIDAD NETA";

// --- Pollo de Engorde -------------------------------------------------

export async function lotesPolloConUbicacion() {
  const rows = await db
    .select({
      lote: lotesPollo,
      ubicacionNombre: ubicaciones.nombre,
      empresaId: empresas.id,
      empresaNombre: empresas.nombre,
    })
    .from(lotesPollo)
    .innerJoin(ubicaciones, eq(ubicaciones.id, lotesPollo.ubicacionId))
    .innerJoin(empresas, eq(empresas.id, ubicaciones.empresaId))
    .orderBy(desc(lotesPollo.fechaAlojamiento));
  return rows;
}

export async function eventosDeLote(loteId: string): Promise<EventoLote[]> {
  const rows = await db.select().from(loteEventosPollo).where(eq(loteEventosPollo.loteId, loteId)).orderBy(loteEventosPollo.fecha);
  return rows as unknown as EventoLote[];
}

const ETIQUETA_CAUSA: Record<string, string> = {
  ascitis: "Ascitis",
  problema_patas: "Problema de patas",
  respiratorio: "Respiratorio",
  picaje: "Picaje",
  descarte: "Descarte",
  otra: "Otra",
};

/** Cantidad de aves muertas agrupada por causa — lo que alimenta la dona
 * 3D "Mortalidad por causa" del reporte de Pollo (no existía ningún
 * desglose por causa en ningún reporte hasta ahora, solo el total). */
export function mortalidadPorCausa(eventos: EventoLote[]): { causa: string; etiqueta: string; cantidad: number }[] {
  const acc = new Map<string, number>();
  for (const e of eventos) {
    if (e.tipo !== "mortalidad") continue;
    const causa = (e as unknown as { mortalidadCausa: string | null }).mortalidadCausa ?? "otra";
    acc.set(causa, (acc.get(causa) ?? 0) + (e.mortalidadCantidad ?? 0));
  }
  return Array.from(acc.entries())
    .map(([causa, cantidad]) => ({ causa, etiqueta: ETIQUETA_CAUSA[causa] ?? causa, cantidad }))
    .filter((r) => r.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);
}

/** Todos los indicadores calculados de un lote, en un solo objeto — el
 * mismo cálculo que usan /pollo y /ejecutivo, reutilizado acá para que el
 * reporte nunca pueda mostrar un número distinto al que ve el usuario en
 * pantalla. */
export function resumenLote(lote: LotePollo, eventos: EventoLote[], hoy: Date) {
  return {
    edadDias: edadDelLote(lote, hoy),
    avesVivas: avesVivas(lote, eventos),
    pctViabilidad: pctViabilidad(lote, eventos),
    pctMortalidad: pctMortalidad(lote, eventos),
    mortalidadAcumulada: mortalidadAcumulada(eventos),
    pesoPromedioKg: pesoPromedioActualKg(eventos),
    alimentoAcumuladoKg: alimentoAcumuladoKg(eventos),
    conversion: conversionActual(lote, eventos),
    iee: ieeActual(lote, eventos, hoy),
  };
}

// --- Inventario de insumos ---------------------------------------------

export async function inventarioConAlcance() {
  const [todosInsumos, todasLecturas] = await Promise.all([db.select().from(insumos), db.select().from(lecturasInsumo)]);
  return todosInsumos.map((i) => {
    // La lectura más reciente de este insumo (puede haber varias fechas
    // cargadas) — el código anterior tomaba la primera que encontraba en
    // el arreglo, sin ordenar, así que en teoría podía mostrar una lectura
    // vieja si el insumo tenía más de una fila.
    const lecturasDelInsumo = todasLecturas.filter((l) => l.insumoId === i.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const lect = lecturasDelInsumo[0];
    const inventarioActual = Number(lect?.inventarioActual ?? 0);
    const consumoDiarioPromedio = Number(lect?.consumoDiarioPromedio ?? 0) || 1;
    const alcanceDias = +(inventarioActual / consumoDiarioPromedio).toFixed(1);
    return {
      insumo: i.nombre,
      unidadMedida: i.unidadMedida,
      fecha: lect?.fecha ?? null,
      inventarioActual,
      consumoDiarioPromedio,
      alcanceDias,
      minimoDias: i.minimoDias,
      critico: alcanceDias < i.minimoDias,
    };
  });
}

// --- Auditoría -----------------------------------------------------------

export async function auditoriaReciente(limit = 500) {
  return db.select().from(auditoria).orderBy(desc(auditoria.creadoEn)).limit(limit);
}

// --- Alertas ---------------------------------------------------------

export async function alertasActivas() {
  return db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn));
}

export function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtFechaLarga(d = new Date()) {
  return d.toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" });
}
