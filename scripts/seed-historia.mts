// Genera 5 años de historia sintética (cliente ficticio "Agroindustrias
// del Istmo", Panamá) variando alrededor de la data base ya sembrada por
// seed-db.mts, para las 7 ubicaciones y las 3 empresas del EDR —
// necesario para que el módulo comparador (día/semana/mes/trimestre/
// semestre/año) tenga historia real que comparar. Es aditivo: no borra
// nada, usa upsert sobre las mismas claves únicas del esquema
// (ubicacion+fecha, empresa+periodo+concepto, insumo+fecha), así que
// correrlo de nuevo no duplica.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const FECHA_REAL = "2026-08-28";
const DIAS_HISTORIA = 1825; // 5 años

function rango(base: number, pct: number) {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type Baseline = Record<string, { meta?: number; causado: number; pct: number; min?: number; max?: number; tendenciaAnual?: number }>;

// pct = variación relativa día a día · tendenciaAnual = crecimiento/caída
// acumulado a lo largo de los 2 años (para que la serie cuente una
// historia, no solo ruido).
const baselineHuevos: Baseline = {
  produccion_cajas: { meta: 3000, causado: 3096, pct: 0.06, tendenciaAnual: 0.08 },
  pct_produccion: { causado: 76.3, pct: 0.05, min: 55, max: 92 },
  pct_mortalidad: { causado: 0.8, pct: 0.35, min: 0.1, max: 2.2 },
  grs_ave: { causado: 109, pct: 0.03, min: 95, max: 112 },
  inv_final_aves: { causado: 141244, pct: 0.02, tendenciaAnual: 0.03 },
};
const baselinePolloEngorde: Baseline = {
  aves_iniciales: { causado: 526265, pct: 0.04 },
  aves_alojadas: { causado: 444446, pct: 0.04 },
  aves_beneficio: { causado: 313171, pct: 0.05 },
  kg_beneficiados: { causado: 522743, pct: 0.05, tendenciaAnual: 0.1 },
  pct_pollo_a: { causado: 87, pct: 0.03, min: 85, max: 98 },
  pct_pollo_b: { causado: 6, pct: 0.2, min: 2, max: 15 },
  iee: { causado: 319, pct: 0.06, min: 250, max: 340 },
  mortalidad: { causado: 8.7, pct: 0.25, min: 3, max: 12 },
  edad_promedio: { causado: 34, pct: 0.02 },
  peso_promedio: { causado: 2.52, pct: 0.03 },
  conversion: { causado: 1.90, pct: 0.06, min: 1.5, max: 2.1 },
  inventario_final_aves: { causado: 463542, pct: 0.04 },
};
const baselineIncubadora: Baseline = {
  huevos_incubados: { causado: 877978, pct: 0.05 },
  nacimientos: { causado: 730471, pct: 0.06 },
  descarte_nacimientos: { causado: 1.2, pct: 0.3, min: 0.3, max: 2.5 },
  pct_nacimiento: { causado: 76.45, pct: 0.04, min: 65, max: 85 },
  peso_promedio_nacimiento: { causado: 48.9, pct: 0.03 },
  pbb_despacho: { causado: 619036, pct: 0.06 },
};
const baselineReproductoras: Baseline = {
  aves_galpon_hembras_cria: { causado: 23145, pct: 0.03 },
  aves_galpon_machos_cria: { causado: 3940, pct: 0.05 },
  aves_galpon_hembras: { causado: 52123, pct: 0.03 },
  aves_galpon_machos: { causado: 6138, pct: 0.04 },
  produccion_huevos_totales: { causado: 797385, pct: 0.05, tendenciaAnual: 0.06 },
  produccion_huevos_incubables: { causado: 821937, pct: 0.05, tendenciaAnual: 0.06 },
};
const baselineGuarico: Baseline = {
  hembras_produccion: { causado: 541, pct: 0.02 },
  hembras_reemplazo: { causado: 46, pct: 0.2 },
  machos: { causado: 22, pct: 0.05 },
  lechones_lactantes: { causado: 851, pct: 0.06 },
  lechones_bateria: { causado: 1514, pct: 0.05 },
  lechones_engorde: { causado: 3503, pct: 0.05 },
  mortalidad_pie_cria: { causado: 0.94, pct: 0.3, min: 0.3, max: 2.5 },
  mortalidad_lactancia: { causado: 8.8, pct: 0.2, min: 4, max: 12 },
  mortalidad_bateria: { causado: 1.7, pct: 0.3, min: 0.3, max: 3 },
  mortalidad_engorde: { causado: 0.63, pct: 0.4, min: 0.2, max: 2.5 },
  nro_partos: { causado: 104, pct: 0.08 },
  promedio_nacidos_vivos: { causado: 11, pct: 0.1, min: 9, max: 16 },
  produccion_lechones_dtt: { causado: 1046, pct: 0.06 },
  peso_destete: { causado: 7.2, pct: 0.04 },
  peso_bateria: { causado: 21.9, pct: 0.04 },
  conversion_desarrollo: { causado: 2.24, pct: 0.05 },
  peso_engorde: { causado: 102, pct: 0.04 },
  conversion_engorde: { causado: 3.03, pct: 0.06, min: 2.3, max: 3.2 },
  cerdos_beneficio: { causado: 762, pct: 0.08 },
  edad_salida_engorde: { causado: 24, pct: 0.03 },
  produccion_kg_carne_pie: { causado: 100341, pct: 0.06 },
  produccion_kg_carne_canal: { causado: 81215, pct: 0.06 },
  rendimiento_canal: { causado: 77.0, pct: 0.02, min: 76, max: 84 },
};
const baselineTachira: Baseline = {
  inventario_hembras: { causado: 33, pct: 0.15, tendenciaAnual: 0.4 },
  hembras_gestacion: { causado: 13, pct: 0.3, tendenciaAnual: 0.5 },
  machos: { causado: 2, pct: 0.2 },
  lechones_lactantes: { causado: 11, pct: 0.5, min: 0 },
  lechones_levante: { causado: 147, pct: 0.15, tendenciaAnual: 0.6 },
  mortalidad_lactancia: { causado: 10, pct: 0.3, min: 3, max: 15 },
  mortalidad_bateria: { causado: 0.5, pct: 0.6, min: 0, max: 3 },
  nro_partos: { causado: 1, pct: 0.8, min: 0, tendenciaAnual: 3 },
  promedio_nacidos_vivos: { causado: 11, pct: 0.3, min: 0, max: 16 },
  produccion_lechones_dtt: { causado: 27, pct: 0.2, tendenciaAnual: 0.5 },
  peso_destete: { causado: 4.8, pct: 0.08 },
};
const baselineAba: Baseline = {
  pollo_pre_iniciador: { causado: 100, pct: 0.06 },
  pollo_iniciador: { causado: 99, pct: 0.06 },
  pollo_engorde: { causado: 175, pct: 0.06 },
  ponedoras_produccion: { causado: 94, pct: 0.06 },
  ponedoras_cria: { causado: 48, pct: 0.06 },
  cerdo_tm: { causado: 109, pct: 0.06 },
  reproductoras_tm: { causado: 44, pct: 0.06 },
  cria_reproductoras_tm: { causado: 48, pct: 0.08 },
  becerro_lactante_externos: { causado: 9, pct: 0.1 },
  produccion_consumo_interno: { causado: 777, pct: 0.05, tendenciaAnual: 0.08 },
  produccion_maquila_terceros: { causado: 99, pct: 0.1 },
  produccion_total: { causado: 764, pct: 0.05, tendenciaAnual: 0.08 },
};

function generarValor(b: Baseline[string], progreso: number): number {
  const conTendencia = b.causado * (1 + (b.tendenciaAnual ?? 0) * progreso);
  const v = rango(conTendencia, b.pct);
  return Math.round(clamp(v, b.min ?? 0, b.max ?? Number.POSITIVE_INFINITY) * 100) / 100;
}

function generarCapturaValores(baseline: Baseline, progreso: number) {
  const valores: Record<string, { meta?: number; causado: number }> = {};
  for (const [clave, b] of Object.entries(baseline)) {
    valores[clave] = { meta: b.meta, causado: generarValor(b, progreso) };
  }
  return valores;
}

async function main() {
  console.log("Leyendo referencias existentes...");
  const ubic = await db.select().from(schema.ubicaciones);
  const emp = await db.select().from(schema.empresas);
  const porNombre = (frag: string) => ubic.find((u) => u.nombre.toLowerCase().includes(frag));
  const cojedes = porNombre("cocl")!;
  const engorde = porNombre("engorde")!;
  const incubadora = porNombre("incubadora")!;
  const reproductoras = porNombre("reproductoras")!;
  const guarico = porNombre("azuero")!;
  const tachira = porNombre("veraguas")!;
  const plantaAba = porNombre("chorrera")!;

  const mapa: { ubicacionId: string; baseline: Baseline }[] = [
    { ubicacionId: cojedes.id, baseline: baselineHuevos },
    { ubicacionId: engorde.id, baseline: baselinePolloEngorde },
    { ubicacionId: incubadora.id, baseline: baselineIncubadora },
    { ubicacionId: reproductoras.id, baseline: baselineReproductoras },
    { ubicacionId: guarico.id, baseline: baselineGuarico },
    { ubicacionId: tachira.id, baseline: baselineTachira },
    { ubicacionId: plantaAba.id, baseline: baselineAba },
  ];

  console.log(`Generando ${DIAS_HISTORIA} días (5 años) de capturas para ${mapa.length} ubicaciones...`);
  const filas: (typeof schema.capturas.$inferInsert)[] = [];
  for (let d = DIAS_HISTORIA; d >= 1; d--) {
    const fecha = new Date(FECHA_REAL + "T00:00:00Z");
    fecha.setUTCDate(fecha.getUTCDate() - d);
    const fechaStr = fecha.toISOString().slice(0, 10);
    const progreso = 1 - d / DIAS_HISTORIA; // 0 -> hace 2 años, 1 -> hoy
    for (const { ubicacionId, baseline } of mapa) {
      filas.push({
        ubicacionId,
        fecha: fechaStr,
        origen: "manual",
        creadoEnDispositivo: fecha,
        sincronizadoEn: fecha,
        valores: generarCapturaValores(baseline, progreso),
      });
    }
  }

  console.log("Limpiando filas corruptas de una corrida anterior (si las hay)...");
  await sql`delete from capturas where valores::text like '%queryData%'`;

  let insertadas = 0;
  for (const lote of chunk(filas, 400)) {
    await db.insert(schema.capturas).values(lote).onConflictDoNothing();
    insertadas += lote.length;
    process.stdout.write(`\r  capturas: ${insertadas}/${filas.length}`);
  }
  console.log();

  console.log("Generando 60 meses (5 años) de EDR por empresa...");
  const empHuevos = emp.find((e) => e.nombre.toLowerCase().includes("cocl"))!;
  const empPollo = emp.find((e) => e.nombre.toLowerCase().includes("chiriqu"))!;
  const empCerdo = emp.find((e) => e.nombre.toLowerCase().includes("azuero"))!;

  const edrBaseline: Record<string, { ingresos: number; costos: number; gastosOp: number; comisiones: number; impuestos: number; tendencia: number }> = {
    [empHuevos.id]: { ingresos: 94500, costos: 71000, gastosOp: 9200, comisiones: 1100, impuestos: 1050, tendencia: 0.15 },
    [empPollo.id]: { ingresos: 118000, costos: 79500, gastosOp: 16500, comisiones: 2150, impuestos: 1900, tendencia: 0.2 },
    [empCerdo.id]: { ingresos: 78500, costos: 54000, gastosOp: 11000, comisiones: 850, impuestos: 950, tendencia: 0.12 },
  };

  const conceptosOrden = ["(+) Ingresos por Ventas (Devengado)", "(-) Costos de Venta / Operación", "(=) Utilidad Bruta", "(-) Gastos Operativos", "(=) EBITDA", "(-) Comisiones Bancarias", "(-) Impuestos", "(=) UTILIDAD NETA"];
  const edrRows: (typeof schema.edrLineas.$inferInsert)[] = [];
  for (let m = 59; m >= 1; m--) {
    const fecha = new Date("2026-07-01T00:00:00Z");
    fecha.setUTCMonth(fecha.getUTCMonth() - m);
    const periodo = fecha.toISOString().slice(0, 7);
    const progreso = 1 - m / 59;
    for (const [empresaId, b] of Object.entries(edrBaseline)) {
      const ingresos = rango(b.ingresos * (1 + b.tendencia * progreso), 0.07);
      const costos = rango(b.costos * (1 + b.tendencia * 0.9 * progreso), 0.06);
      const utilidadBruta = ingresos - costos;
      const gastosOp = rango(b.gastosOp * (1 + b.tendencia * 0.5 * progreso), 0.08);
      const ebitda = utilidadBruta - gastosOp;
      const comisiones = rango(b.comisiones, 0.1);
      const impuestos = rango(b.impuestos, 0.1);
      const utilidadNeta = ebitda - comisiones - impuestos;
      const valores: Record<string, number> = {
        "(+) Ingresos por Ventas (Devengado)": ingresos,
        "(-) Costos de Venta / Operación": costos,
        "(=) Utilidad Bruta": utilidadBruta,
        "(-) Gastos Operativos": gastosOp,
        "(=) EBITDA": ebitda,
        "(-) Comisiones Bancarias": comisiones,
        "(-) Impuestos": impuestos,
        "(=) UTILIDAD NETA": utilidadNeta,
      };
      conceptosOrden.forEach((concepto, orden) => {
        edrRows.push({
          empresaId,
          periodo,
          concepto,
          orden,
          esSubtotal: concepto.startsWith("(="),
          meta: String(Math.round(valores[concepto] * 1.05)),
          causado: String(Math.round(valores[concepto])),
        });
      });
    }
  }
  for (const lote of chunk(edrRows, 300)) {
    await db.insert(schema.edrLineas).values(lote).onConflictDoNothing();
  }
  console.log(`  edrLineas: ${edrRows.length}`);

  console.log("Generando 5 años de lecturas de inventario (Maíz/Soya/Aceite)...");
  const insumosAll = await db.select().from(schema.insumos);
  const lecturaRows: (typeof schema.lecturasInsumo.$inferInsert)[] = [];
  for (const insumo of insumosAll) {
    const consumo = insumo.nombre === "Maíz" ? 18 : insumo.nombre === "Soya" ? 8 : 0.8;
    for (let d = DIAS_HISTORIA; d >= 1; d--) {
      const fecha = new Date(FECHA_REAL + "T00:00:00Z");
      fecha.setUTCDate(fecha.getUTCDate() - d);
      const fechaStr = fecha.toISOString().slice(0, 10);
      // Ciclo de reabastecimiento tipo diente de sierra cada ~12 días,
      // con la caída crítica real conservada en el día de hoy.
      const cicloDia = (DIAS_HISTORIA - d) % 12;
      const inventario = Math.max(0.5, consumo * (12 - cicloDia) * (0.85 + Math.random() * 0.3));
      lecturaRows.push({ insumoId: insumo.id, fecha: fechaStr, inventarioActual: inventario.toFixed(2), consumoDiarioPromedio: consumo.toFixed(2) });
    }
  }
  for (const lote of chunk(lecturaRows, 400)) {
    await db.insert(schema.lecturasInsumo).values(lote).onConflictDoNothing();
  }
  console.log(`  lecturasInsumo: ${lecturaRows.length}`);

  console.log("Listo — 5 años de historia sintética cargados en Neon.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
