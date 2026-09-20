import { db } from "@/lib/db/client";
import { edrLineas, empresas } from "@/lib/db/schema";

// Agregación de EDR mensual (24 meses reales/sintéticos ya cargados en
// Neon) a granularidades más gruesas — no requiere tocar el esquema: cada
// fila de edrLineas ya está atada a un "periodo" YYYY-MM, así que
// trimestre/semestre/año son solo una función de bucketing sobre lo mismo.
export type Granularidad = "mes" | "trimestre" | "semestre" | "año";

export function bucketDe(periodoYYYYMM: string, gran: Granularidad): string {
  const [y, m] = periodoYYYYMM.split("-").map(Number);
  if (gran === "mes") return periodoYYYYMM;
  if (gran === "trimestre") return `${y}-T${Math.ceil(m / 3)}`;
  if (gran === "semestre") return `${y}-S${m <= 6 ? 1 : 2}`;
  return String(y);
}

export function etiquetaBucket(bucket: string, gran: Granularidad): string {
  if (gran === "mes") {
    const [y, m] = bucket.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-VE", { month: "short", year: "numeric" });
  }
  return bucket;
}

/** Bucket "anterior" en la misma granularidad — para comparar contra el
 * período previo inmediato (mes anterior, trimestre anterior, etc.). */
export function bucketAnterior(bucket: string, gran: Granularidad): string {
  if (gran === "mes") {
    const [y, m] = bucket.split("-").map(Number);
    const d = new Date(y, m - 1 - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (gran === "trimestre") {
    const [y, t] = bucket.split("-T").map(Number);
    return t === 1 ? `${y - 1}-T4` : `${y}-T${t - 1}`;
  }
  if (gran === "semestre") {
    const [y, s] = bucket.split("-S").map(Number);
    return s === 1 ? `${y - 1}-S2` : `${y}-S1`;
  }
  return String(Number(bucket) - 1);
}

/** Mismo bucket, un año antes — para comparación interanual (año vs año). */
export function bucketInteranual(bucket: string, gran: Granularidad): string {
  if (gran === "mes") {
    const [y, m] = bucket.split("-");
    return `${Number(y) - 1}-${m}`;
  }
  if (gran === "trimestre") {
    const [y, t] = bucket.split("-T");
    return `${Number(y) - 1}-T${t}`;
  }
  if (gran === "semestre") {
    const [y, s] = bucket.split("-S");
    return `${Number(y) - 1}-S${s}`;
  }
  return String(Number(bucket) - 1);
}

export function variacion(actual: number, previo: number): { abs: number; pct: number | null } {
  return { abs: actual - previo, pct: previo !== 0 ? (actual - previo) / Math.abs(previo) : null };
}

export const CONCEPTOS_CLAVE = ["(+) Ingresos por Ventas (Devengado)", "(=) EBITDA", "(=) UTILIDAD NETA"];

export async function agregarPorBucket(gran: Granularidad) {
  const [edr, empresasAll] = await Promise.all([db.select().from(edrLineas), db.select().from(empresas)]);
  const unidadPorEmpresa: Record<string, string> = {};
  for (const e of empresasAll) {
    if (e.nombre.includes("HUEVOS")) unidadPorEmpresa[e.id] = "huevos";
    else if (e.nombre.includes("DORADO")) unidadPorEmpresa[e.id] = "pollo";
    else if (e.nombre.includes("CERDOS")) unidadPorEmpresa[e.id] = "cerdo";
  }
  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre.split(" - ")[0]]));

  const agg = new Map<string, Map<string, Map<string, number>>>();
  for (const l of edr) {
    const bucket = bucketDe(l.periodo, gran);
    if (!agg.has(bucket)) agg.set(bucket, new Map());
    const porEmpresa = agg.get(bucket)!;
    if (!porEmpresa.has(l.empresaId)) porEmpresa.set(l.empresaId, new Map());
    const porConcepto = porEmpresa.get(l.empresaId)!;
    porConcepto.set(l.concepto, (porConcepto.get(l.concepto) ?? 0) + Number(l.causado));
  }
  return { agg, unidadPorEmpresa, empresaNombre, bucketsDisponibles: Array.from(agg.keys()).sort() };
}

/** Suma todos los meses cuyo periodo cae dentro de [desde, hasta]
 * (inclusive, formato YYYY-MM — la comparación de strings alcanza porque
 * el formato ordena lexicográficamente igual que cronológicamente). Es lo
 * que permite un rango arbitrario ("15/03 a 20/06", en la práctica mes a
 * mes ya que el EDR es mensual) en vez de solo los buckets fijos. */
export function sumarRango(mensual: Map<string, Map<string, Map<string, number>>>, desde: string, hasta: string) {
  const resultado = new Map<string, Map<string, number>>();
  for (const [mes, porEmpresa] of mensual) {
    if (mes < desde || mes > hasta) continue;
    for (const [empresaId, porConcepto] of porEmpresa) {
      if (!resultado.has(empresaId)) resultado.set(empresaId, new Map());
      const destino = resultado.get(empresaId)!;
      for (const [concepto, valor] of porConcepto) destino.set(concepto, (destino.get(concepto) ?? 0) + valor);
    }
  }
  return resultado;
}

export function totalConceptoRango(resultado: Map<string, Map<string, number>>, concepto: string): number | null {
  let total = 0;
  let found = false;
  for (const porConcepto of resultado.values()) {
    const v = porConcepto.get(concepto);
    if (v !== undefined) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}

export function totalConcepto(agg: Map<string, Map<string, Map<string, number>>>, bucket: string, concepto: string) {
  const porEmpresa = agg.get(bucket);
  if (!porEmpresa) return null;
  let total = 0;
  let found = false;
  for (const porConcepto of porEmpresa.values()) {
    const v = porConcepto.get(concepto);
    if (v !== undefined) {
      total += v;
      found = true;
    }
  }
  return found ? total : null;
}
