// Siembra data SINTÉTICA (cliente ficticio "Agroindustrias del Istmo",
// Panamá) a Neon — demo pública, no expone datos de ningún cliente real.
// Corre con: npm run seed:db
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

type Indicador = { clave: string; etiqueta: string; unidadMedida: string; tipoValor: "numero" | "porcentaje" | "moneda" | "peso_kg" | "peso_gr"; requiereMeta?: boolean; notaTecnica?: string };

const num = (s: string) => Number(String(s).replace(/[^\d.-]/g, "")) || 0;

async function main() {
  console.log("Limpiando tablas...");
  await db.delete(schema.capturaEvidencias);
  await db.delete(schema.capturas);
  await db.delete(schema.ubicacionIndicadores);
  await db.delete(schema.edrLineas);
  await db.delete(schema.lecturasInsumo);
  await db.delete(schema.alertas);
  await db.delete(schema.usuarios);
  await db.delete(schema.indicadores);
  await db.delete(schema.ubicaciones);
  await db.delete(schema.insumos);
  await db.delete(schema.empresas);
  await db.delete(schema.unidadesNegocio);
  await db.delete(schema.organizacion);

  console.log("Organización (matrícula del cliente en el sistema)...");
  await db.insert(schema.organizacion).values({
    nombre: "Agroindustrias del Istmo",
    direccion: "Sede David · Vía Interamericana, Edificio Istmo Corporate, Piso 3, David, Chiriquí, Panamá",
    logoUrl: null,
  });

  console.log("Unidades de negocio...");
  const unidades = {
    huevos: { id: randomUUID(), slug: "huevos", nombre: "Huevos", colorHex: "#ef7d1e", icono: "egg", orden: 1 },
    pollo: { id: randomUUID(), slug: "pollo", nombre: "Pollo", colorHex: "#1d5a96", icono: "bird", orden: 2 },
    cerdo: { id: randomUUID(), slug: "cerdo", nombre: "Cerdo", colorHex: "#8a3b5c", icono: "pig", orden: 3 },
    aba: { id: randomUUID(), slug: "aba", nombre: "Planta ABA", colorHex: "#4f6b5c", icono: "factory", orden: 4 },
  };
  await db.insert(schema.unidadesNegocio).values(Object.values(unidades));

  console.log("Empresas...");
  const empresas = {
    huevos: { id: randomUUID(), unidadNegocioId: unidades.huevos.id, nombre: "Avícola Coclé" },
    pollo: { id: randomUUID(), unidadNegocioId: unidades.pollo.id, nombre: "Avícola Chiriquí" },
    cerdo: { id: randomUUID(), unidadNegocioId: unidades.cerdo.id, nombre: "Porcícola Azuero" },
    aba: { id: randomUUID(), unidadNegocioId: unidades.aba.id, nombre: "Planta AgroIstmo" },
  };
  await db.insert(schema.empresas).values(Object.values(empresas));

  console.log("Ubicaciones...");
  async function qr(token: string) {
    return QRCode.toDataURL(token, { margin: 1, width: 320 });
  }
  const ubic = {
    cojedes: { id: randomUUID(), empresaId: empresas.huevos.id, nombre: "Coclé", tipo: "granja" as const, subUnidad: null, qrToken: "AGP-HUEVOS-COCLE" },
    polloEngorde: { id: randomUUID(), empresaId: empresas.pollo.id, nombre: "Chiriquí — Engorde", tipo: "galpon" as const, subUnidad: "POLLO", qrToken: "AGP-POLLO-ENGORDE" },
    incubadora: { id: randomUUID(), empresaId: empresas.pollo.id, nombre: "Chiriquí — Incubadora", tipo: "galpon" as const, subUnidad: "INCUBADORA", qrToken: "AGP-POLLO-INCUBADORA" },
    reproductoras: { id: randomUUID(), empresaId: empresas.pollo.id, nombre: "Chiriquí — Reproductoras", tipo: "galpon" as const, subUnidad: "REPRODUCTORAS", qrToken: "AGP-POLLO-REPRODUCTORAS" },
    guarico: { id: randomUUID(), empresaId: empresas.cerdo.id, nombre: "Azuero", tipo: "granja" as const, subUnidad: null, qrToken: "AGP-CERDO-AZUERO" },
    tachira: { id: randomUUID(), empresaId: empresas.cerdo.id, nombre: "Veraguas", tipo: "granja" as const, subUnidad: null, qrToken: "AGP-CERDO-VERAGUAS" },
    plantaAba: { id: randomUUID(), empresaId: empresas.aba.id, nombre: "Planta La Chorrera", tipo: "planta" as const, subUnidad: null, qrToken: "AGP-ABA-PLANTA" },
  };
  await db.insert(schema.ubicaciones).values(Object.values(ubic));

  console.log("Catálogo de indicadores...");
  const indicadoresHuevos: Indicador[] = [
    { clave: "produccion_cajas", etiqueta: "Producción (Cajas)", unidadMedida: "cajas", tipoValor: "numero", notaTecnica: "Cajas de 360 huevos producidas en el día — base para calcular % de producción e ingresos por venta." },
    { clave: "pct_produccion", etiqueta: "% Producción", unidadMedida: "%", tipoValor: "porcentaje", notaTecnica: "Huevos producidos / aves en postura del día. Cae por estrés calórico, enfermedad respiratoria o final de ciclo de postura." },
    { clave: "pct_mortalidad", etiqueta: "% Mortalidad", unidadMedida: "%", tipoValor: "porcentaje", notaTecnica: "Sobre 0.40-0.50% diario es alerta temprana de problema sanitario — reportar de inmediato." },
    { clave: "grs_ave", etiqueta: "Grs / Ave", unidadMedida: "g", tipoValor: "peso_gr", notaTecnica: "Consumo de alimento por ave/día — una caída sostenida anticipa baja de postura antes de verse en % Producción." },
    { clave: "inv_final_aves", etiqueta: "Inv. Final (Aves)", unidadMedida: "aves", tipoValor: "numero", notaTecnica: "Población viva al cierre del día — insumo para la mortalidad acumulada del lote." },
    { clave: "inv_final_cajas", etiqueta: "Inv. Final Cajas", unidadMedida: "cajas", tipoValor: "numero", requiereMeta: false, notaTecnica: "Cajas en stock sin despachar al cierre del día." },
  ];
  const indicadoresPolloEngorde: Indicador[] = [
    { clave: "aves_iniciales", etiqueta: "Aves Iniciales", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "aves_alojadas", etiqueta: "Aves Alojadas", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "aves_beneficio", etiqueta: "Aves a Beneficio", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "kg_beneficiados", etiqueta: "Kg Beneficiados", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "pct_pollo_a", etiqueta: "% Pollo A", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "pct_pollo_b", etiqueta: "% Pollo B", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "iee", etiqueta: "I.E.E.", unidadMedida: "pts", tipoValor: "numero", notaTecnica: "Índice de Eficiencia Europeo — combina viabilidad, peso, edad y conversión en un solo puntaje." },
    { clave: "mortalidad", etiqueta: "Mortalidad", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "edad_promedio", etiqueta: "Edad Promedio", unidadMedida: "días", tipoValor: "numero" },
    { clave: "peso_promedio", etiqueta: "Peso Promedio", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "conversion", etiqueta: "Conversión", unidadMedida: "kg/kg", tipoValor: "numero", notaTecnica: "Kg de alimento consumido por kg de peso vivo ganado — cuanto más bajo, más eficiente el lote." },
    { clave: "inventario_final_aves", etiqueta: "Inventario Final de Aves", unidadMedida: "aves", tipoValor: "numero" },
  ];
  const indicadoresIncubadora: Indicador[] = [
    { clave: "huevos_incubados", etiqueta: "N° de Huevos Incubados", unidadMedida: "huevos", tipoValor: "numero" },
    { clave: "nacimientos", etiqueta: "N° de Nacimientos", unidadMedida: "pollitos", tipoValor: "numero" },
    { clave: "descarte_nacimientos", etiqueta: "Descarte de los Nacimientos", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "pct_nacimiento", etiqueta: "% de Nacimiento", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "peso_promedio_nacimiento", etiqueta: "Peso Promedio al Nacimiento", unidadMedida: "g", tipoValor: "peso_gr" },
    { clave: "pbb_despacho", etiqueta: "N° PBB para Despacho", unidadMedida: "pollitos", tipoValor: "numero" },
  ];
  const indicadoresReproductoras: Indicador[] = [
    { clave: "aves_galpon_hembras_cria", etiqueta: "Aves en Galpón (Hembras) Cría", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "aves_galpon_machos_cria", etiqueta: "Aves en Galpón (Machos) Cría", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "aves_galpon_hembras", etiqueta: "Aves en Galpón (Hembras)", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "aves_galpon_machos", etiqueta: "Aves en Galpón (Machos)", unidadMedida: "aves", tipoValor: "numero" },
    { clave: "produccion_huevos_totales", etiqueta: "Producción Huevos Totales", unidadMedida: "huevos", tipoValor: "numero" },
    { clave: "produccion_huevos_incubables", etiqueta: "Producción Huevos Incubables", unidadMedida: "huevos", tipoValor: "numero" },
  ];
  const indicadoresCerdoGuarico: Indicador[] = [
    { clave: "hembras_produccion", etiqueta: "Hembras en Producción", unidadMedida: "cerdas", tipoValor: "numero" },
    { clave: "hembras_reemplazo", etiqueta: "Hembras Reemplazo", unidadMedida: "cerdas", tipoValor: "numero" },
    { clave: "machos", etiqueta: "Machos", unidadMedida: "cerdos", tipoValor: "numero" },
    { clave: "lechones_lactantes", etiqueta: "Lechones Lactantes", unidadMedida: "lechones", tipoValor: "numero" },
    { clave: "lechones_bateria", etiqueta: "Lechones en Batería", unidadMedida: "lechones", tipoValor: "numero" },
    { clave: "lechones_engorde", etiqueta: "Lechones Engorde", unidadMedida: "lechones", tipoValor: "numero" },
    { clave: "mortalidad_pie_cria", etiqueta: "Mortalidad Pie de Cría", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "mortalidad_lactancia", etiqueta: "Mortalidad Lactancia", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "mortalidad_bateria", etiqueta: "Mortalidad Batería", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "mortalidad_engorde", etiqueta: "Mortalidad Engorde", unidadMedida: "%", tipoValor: "porcentaje" },
    { clave: "nro_partos", etiqueta: "N° de Partos", unidadMedida: "partos", tipoValor: "numero" },
    { clave: "promedio_nacidos_vivos", etiqueta: "Promedio Nacidos Vivos", unidadMedida: "lechones", tipoValor: "numero" },
    { clave: "produccion_lechones_dtt", etiqueta: "Producción de Lechones (Dtt)", unidadMedida: "lechones", tipoValor: "numero" },
    { clave: "peso_destete", etiqueta: "Peso Destete", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "peso_bateria", etiqueta: "Peso Batería", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "conversion_desarrollo", etiqueta: "Conversión Desarrollo", unidadMedida: "kg/kg", tipoValor: "numero" },
    { clave: "peso_engorde", etiqueta: "Peso Engorde", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "conversion_engorde", etiqueta: "Conversión Engorde", unidadMedida: "kg/kg", tipoValor: "numero" },
    { clave: "cerdos_beneficio", etiqueta: "Cerdos a Beneficio", unidadMedida: "cerdos", tipoValor: "numero" },
    { clave: "edad_salida_engorde", etiqueta: "Edad Salida Engorde", unidadMedida: "semanas", tipoValor: "numero" },
    { clave: "produccion_kg_carne_pie", etiqueta: "Producción (Kg Carne en Pie)", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "produccion_kg_carne_canal", etiqueta: "Producción (Kg Carne en Canal)", unidadMedida: "kg", tipoValor: "peso_kg" },
    { clave: "rendimiento_canal", etiqueta: "Rendimiento en Canal", unidadMedida: "%", tipoValor: "porcentaje" },
  ];
  // Táchira: granja más joven — set reducido de indicadores (aún sin ciclo de beneficio).
  const clavesTachira = ["hembras_produccion", "machos", "lechones_lactantes", "mortalidad_lactancia", "mortalidad_bateria", "nro_partos", "promedio_nacidos_vivos", "produccion_lechones_dtt", "peso_destete"];
  const indicadoresCerdoTachiraExtra: Indicador[] = [
    { clave: "inventario_hembras", etiqueta: "Inventario de Hembras", unidadMedida: "cerdas", tipoValor: "numero" },
    { clave: "hembras_gestacion", etiqueta: "Hembras en Gestación", unidadMedida: "cerdas", tipoValor: "numero" },
    { clave: "lechones_levante", etiqueta: "Lechones en Levante", unidadMedida: "lechones", tipoValor: "numero" },
  ];
  const indicadoresAba: Indicador[] = [
    { clave: "pollo_pre_iniciador", etiqueta: "Pollo Pre Iniciador", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "pollo_iniciador", etiqueta: "Pollo Iniciador", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "pollo_engorde", etiqueta: "Pollo Engorde", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "ponedoras_produccion", etiqueta: "Ponedoras Producción", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "ponedoras_cria", etiqueta: "Ponedoras Cría", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "cerdo_tm", etiqueta: "Cerdo", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "reproductoras_tm", etiqueta: "Reproductoras", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "cria_reproductoras_tm", etiqueta: "Cría Reproductoras", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "becerro_lactante_externos", etiqueta: "Becerro Lactante (Externos)", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "produccion_consumo_interno", etiqueta: "Producción Consumo Interno", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "produccion_maquila_terceros", etiqueta: "Producción Maquila de ABA a Terceros", unidadMedida: "Tm", tipoValor: "peso_kg" },
    { clave: "produccion_total", etiqueta: "Producción Total", unidadMedida: "Tm", tipoValor: "peso_kg" },
  ];

  const allIndicadorDefs: Array<{ unidadNegocioId: string; list: Indicador[] }> = [
    { unidadNegocioId: unidades.huevos.id, list: indicadoresHuevos },
    { unidadNegocioId: unidades.pollo.id, list: indicadoresPolloEngorde },
    { unidadNegocioId: unidades.pollo.id, list: indicadoresIncubadora },
    { unidadNegocioId: unidades.pollo.id, list: indicadoresReproductoras },
    { unidadNegocioId: unidades.cerdo.id, list: indicadoresCerdoGuarico },
    { unidadNegocioId: unidades.cerdo.id, list: indicadoresCerdoTachiraExtra },
    { unidadNegocioId: unidades.aba.id, list: indicadoresAba },
  ];
  const indicadorId: Record<string, string> = {};
  const rows: (typeof schema.indicadores.$inferInsert)[] = [];
  let seenKeys = new Set<string>();
  for (const group of allIndicadorDefs) {
    group.list.forEach((ind, i) => {
      const dedupeKey = `${group.unidadNegocioId}:${ind.clave}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      const id = randomUUID();
      indicadorId[ind.clave] = id;
      rows.push({
        id,
        unidadNegocioId: group.unidadNegocioId,
        clave: ind.clave,
        etiqueta: ind.etiqueta,
        unidadMedida: ind.unidadMedida,
        tipoValor: ind.tipoValor,
        orden: i,
        requiereMeta: ind.requiereMeta ?? true,
        notaTecnica: ind.notaTecnica ?? null,
      });
    });
  }
  await db.insert(schema.indicadores).values(rows);

  console.log("Asignando indicadores por ubicación...");
  async function link(ubicacionId: string, claves: string[]) {
    await db.insert(schema.ubicacionIndicadores).values(
      claves.map((clave, orden) => ({ ubicacionId, indicadorId: indicadorId[clave], orden })),
    );
  }
  await link(ubic.cojedes.id, indicadoresHuevos.map((i) => i.clave));
  await link(ubic.polloEngorde.id, indicadoresPolloEngorde.map((i) => i.clave));
  await link(ubic.incubadora.id, indicadoresIncubadora.map((i) => i.clave));
  await link(ubic.reproductoras.id, indicadoresReproductoras.map((i) => i.clave));
  await link(ubic.guarico.id, indicadoresCerdoGuarico.map((i) => i.clave));
  await link(ubic.tachira.id, clavesTachira.concat(indicadoresCerdoTachiraExtra.map((i) => i.clave)));
  await link(ubic.plantaAba.id, indicadoresAba.map((i) => i.clave));

  console.log("Capturas del día (28/08/2026, datos sintéticos — cliente ficticio)...");
  const fecha = "2026-08-28";
  const capturaRows: (typeof schema.capturas.$inferInsert)[] = [
    {
      ubicacionId: ubic.cojedes.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        produccion_cajas: { meta: 3104, causado: 2617 }, pct_produccion: { meta: 73.4, causado: 68.4 },
        pct_mortalidad: { meta: 0.4, causado: 0.9 }, grs_ave: { meta: 108, causado: 99 },
        inv_final_aves: { meta: 180328, causado: 147420 }, inv_final_cajas: { causado: 37 },
      },
    },
    {
      ubicacionId: ubic.polloEngorde.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        aves_iniciales: { meta: 534621, causado: 499291 }, aves_alojadas: { meta: 389832, causado: 370620 },
        aves_beneficio: { meta: 355495, causado: 351632 }, kg_beneficiados: { meta: 442207, causado: 530706 },
        pct_pollo_a: { meta: 84, causado: 90 }, pct_pollo_b: { meta: 4, causado: 7 },
        iee: { meta: 285, causado: 335 }, mortalidad: { meta: 5.2, causado: 7.8 },
        edad_promedio: { meta: 42, causado: 37 }, peso_promedio: { meta: 1.9, causado: 2.29 },
        conversion: { meta: 1.49, causado: 2.04 }, inventario_final_aves: { meta: 495775, causado: 428548 },
      },
    },
    {
      ubicacionId: ubic.incubadora.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        huevos_incubados: { meta: 802861, causado: 857976 }, nacimientos: { meta: 703685, causado: 636942 },
        descarte_nacimientos: { meta: 1.3, causado: 1.0 }, pct_nacimiento: { meta: 65.9, causado: 69.63 },
        peso_promedio_nacimiento: { meta: 47.7, causado: 48.6 }, pbb_despacho: { meta: 625015, causado: 589465 },
      },
    },
    {
      ubicacionId: ubic.reproductoras.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        aves_galpon_hembras_cria: { meta: 27370, causado: 25744 }, aves_galpon_machos_cria: { meta: 3944, causado: 3645 },
        aves_galpon_hembras: { meta: 50874, causado: 50249 }, aves_galpon_machos: { meta: 5826, causado: 6228 },
        produccion_huevos_totales: { meta: 926858, causado: 879757 }, produccion_huevos_incubables: { meta: 694761, causado: 906412 },
      },
    },
    {
      ubicacionId: ubic.guarico.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        hembras_produccion: { meta: 556, causado: 600 }, hembras_reemplazo: { meta: 66, causado: 50 },
        machos: { meta: 24, causado: 22 }, lechones_lactantes: { meta: 1005, causado: 906 },
        lechones_bateria: { meta: 1351, causado: 1255 }, lechones_engorde: { meta: 3276, causado: 3432 },
        mortalidad_pie_cria: { meta: 0.9, causado: 0.95 }, mortalidad_lactancia: { meta: 7.9, causado: 6.8 },
        mortalidad_bateria: { meta: 1, causado: 1.7 }, mortalidad_engorde: { meta: 2, causado: 0.64 },
        nro_partos: { meta: 128, causado: 108 }, promedio_nacidos_vivos: { meta: 13, causado: 13 },
        produccion_lechones_dtt: { meta: 1065, causado: 1041 }, peso_destete: { meta: 5.8, causado: 7.1 },
        peso_bateria: { meta: 27, causado: 25.7 }, conversion_desarrollo: { meta: 2.2, causado: 2.27 },
        peso_engorde: { meta: 98, causado: 118 }, conversion_engorde: { meta: 3.3, causado: 2.61 },
        cerdos_beneficio: { meta: 1070, causado: 802 }, edad_salida_engorde: { meta: 22, causado: 25 },
        produccion_kg_carne_pie: { meta: 101001, causado: 93850 }, produccion_kg_carne_canal: { meta: 98917, causado: 90438 },
        rendimiento_canal: { meta: 85, causado: 88.7 },
      },
    },
    {
      ubicacionId: ubic.tachira.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        inventario_hembras: { meta: 35, causado: 39 }, hembras_gestacion: { meta: 24, causado: 13 },
        machos: { meta: 2, causado: 2 }, lechones_lactantes: { meta: 0, causado: 9 },
        lechones_levante: { meta: 130, causado: 140 }, mortalidad_lactancia: { meta: 11, causado: 10 },
        mortalidad_bateria: { meta: 1, causado: 0 }, nro_partos: { meta: 1, causado: 0 },
        promedio_nacidos_vivos: { meta: 16, causado: 0 }, produccion_lechones_dtt: { meta: 26, causado: 25 },
        peso_destete: { meta: 6.2, causado: 5 },
      },
    },
    {
      ubicacionId: ubic.plantaAba.id, fecha, origen: "manual", creadoEnDispositivo: new Date(),
      valores: {
        pollo_pre_iniciador: { meta: 92, causado: 91 }, pollo_iniciador: { meta: 89, causado: 101 },
        pollo_engorde: { meta: 208, causado: 207 }, ponedoras_produccion: { meta: 107, causado: 106 },
        ponedoras_cria: { meta: 51, causado: 45 }, cerdo_tm: { meta: 101, causado: 100 },
        reproductoras_tm: { meta: 50, causado: 44 }, cria_reproductoras_tm: { meta: 48, causado: 44 },
        becerro_lactante_externos: { meta: 9, causado: 10 }, produccion_consumo_interno: { meta: 742, causado: 710 },
        produccion_maquila_terceros: { meta: 95, causado: 97 }, produccion_total: { meta: 873, causado: 832 },
      },
    },
  ];
  await db.insert(schema.capturas).values(capturaRows);

  // Serie de 7 días de Producción de Huevos (Cojedes) para el gráfico del
  // panel — la del día real (28/08) más 6 días previos con variación
  // realista alrededor del mismo nivel de producción.
  console.log("Serie histórica de 7 días (Huevos)...");
  const serieCajas = [388, 402, 380, 418, 409, 397]; // 6 días previos; el 7mo es el real (2900/10≈290, escalado a nivel diario de granja pequeña de demo se deja igual al real de Cojedes ya insertado)
  const historicoRows: (typeof schema.capturas.$inferInsert)[] = serieCajas.map((cajas, i) => {
    const d = new Date("2026-08-28T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return {
      ubicacionId: ubic.cojedes.id,
      fecha: d.toISOString().slice(0, 10),
      origen: "manual" as const,
      creadoEnDispositivo: d,
      valores: { produccion_cajas: { meta: 390, causado: cajas }, pct_produccion: { causado: 76 + (i % 3) }, pct_mortalidad: { causado: 0.3 + i * 0.05 } },
    };
  });
  await db.insert(schema.capturas).values(historicoRows);

  console.log("Insumos ABA — Maíz/Soya/Aceite (alcance de inventario crítico, datos sintéticos)...");
  const insumoDefs = [
    { nombre: "Maíz", unidadMedida: "Tm", minimoDias: 7, inventarioActual: "72", consumoDiarioPromedio: "18" }, // 4.0 días
    { nombre: "Soya", unidadMedida: "Tm", minimoDias: 7, inventarioActual: "24", consumoDiarioPromedio: "8" }, // 3.0 días
    { nombre: "Aceite", unidadMedida: "Tm", minimoDias: 7, inventarioActual: "1.6", consumoDiarioPromedio: "0.8" }, // 2.0 días
  ];
  for (const ins of insumoDefs) {
    const id = randomUUID();
    await db.insert(schema.insumos).values({ id, nombre: ins.nombre, unidadMedida: ins.unidadMedida, minimoDias: ins.minimoDias });
    await db.insert(schema.lecturasInsumo).values({ insumoId: id, fecha, inventarioActual: ins.inventarioActual, consumoDiarioPromedio: ins.consumoDiarioPromedio });
  }

  console.log("Estado de Resultados — EDR consolidado (datos sintéticos, 3 unidades)...");
  type EdrLinea = { concepto: string; meta: number; causado: number; esSubtotal?: boolean };
  const edrHuevos: EdrLinea[] = [
    { concepto: "(+) Ingresos por Ventas (Devengado)", meta: 100336, causado: 76532 },
    { concepto: "Canal estratégico - 1", meta: 27664, causado: 31860 },
    { concepto: "Canal estratégico - 2", meta: 8908, causado: 11083 },
    { concepto: "Canal Privado - PT", meta: 54427, causado: 49860 },
    { concepto: "(-) Costos de Venta / Operación", meta: 58162, causado: 70497 },
    { concepto: "Alimento Balanceado", meta: 32602, causado: 32647 },
    { concepto: "Fletes", meta: 9216, causado: 10453 },
    { concepto: "Pollona / Pollitos BB / Lechones y Pie de Cría", meta: 10042, causado: 11060 },
    { concepto: "Sanidad y Medicinas", meta: 5250, causado: 5458 },
    { concepto: "Beneficio / Empaques", meta: 5228, causado: 5198 },
    { concepto: "Mano de Obra Directa / Productor", meta: 4723, causado: 5148 },
    { concepto: "(=) Utilidad Bruta", meta: 26073, causado: 24034, esSubtotal: true },
    { concepto: "(-) Gastos Operativos", meta: 10928, causado: 10654 },
    { concepto: "Mantenimiento y Otros", meta: 5534, causado: 5076 },
    { concepto: "Gastos Administrativos", meta: 4942, causado: 4612 },
    { concepto: "(=) EBITDA", meta: 13360, causado: 12814, esSubtotal: true },
    { concepto: "(-) Comisiones Bancarias", meta: 1052, causado: 1070 },
    { concepto: "(-) Impuestos", meta: 875, causado: 918 },
    { concepto: "(=) UTILIDAD NETA", meta: 12814, causado: 8826, esSubtotal: true },
  ];
  const edrPollo: EdrLinea[] = [
    { concepto: "(+) Ingresos por Ventas (Devengado)", meta: 107483, causado: 104411 },
    { concepto: "(-) Costos de Venta / Operación", meta: 61192, causado: 63997 },
    { concepto: "(=) Utilidad Bruta", meta: 30995, causado: 30691, esSubtotal: true },
    { concepto: "(-) Gastos Operativos", meta: 19552, causado: 20215 },
    { concepto: "Mantenimiento y Otros", meta: 11248, causado: 8715 },
    { concepto: "Gastos Administrativos", meta: 9514, causado: 9521 },
    { concepto: "(=) EBITDA", meta: 10570, causado: 15351, esSubtotal: true },
    { concepto: "(-) Comisiones Bancarias", meta: 2172, causado: 1833 },
    { concepto: "(-) Impuestos", meta: 1931, causado: 1779 },
    { concepto: "(=) UTILIDAD NETA", meta: 5590, causado: 11958, esSubtotal: true },
  ];
  const edrCerdo: EdrLinea[] = [
    { concepto: "(+) Ingresos por Ventas (Devengado)", meta: 99610, causado: 75814 },
    { concepto: "(-) Costos de Venta / Operación", meta: 52538, causado: 58106 },
    { concepto: "Mano de Obra Directa / Productor", meta: 459, causado: 563 },
    { concepto: "(=) Utilidad Bruta", meta: 28624, causado: 27545, esSubtotal: true },
    { concepto: "(-) Gastos Operativos", meta: 9313, causado: 10637 },
    { concepto: "Mantenimiento y Otros", meta: 5054, causado: 4995 },
    { concepto: "Gastos Administrativos", meta: 5580, causado: 5498 },
    { concepto: "(=) EBITDA", meta: 20224, causado: 14415, esSubtotal: true },
    { concepto: "(-) Comisiones Bancarias", meta: 951, causado: 798 },
    { concepto: "(-) Impuestos", meta: 980, causado: 846 },
    { concepto: "(=) UTILIDAD NETA", meta: 17916, causado: 14921, esSubtotal: true },
  ];
  const periodo = "2026-07";
  const edrRows: (typeof schema.edrLineas.$inferInsert)[] = [];
  for (const [empresaId, lineas] of [
    [empresas.huevos.id, edrHuevos],
    [empresas.pollo.id, edrPollo],
    [empresas.cerdo.id, edrCerdo],
  ] as const) {
    lineas.forEach((l, i) => {
      edrRows.push({ empresaId, periodo, concepto: l.concepto, orden: i, esSubtotal: l.esSubtotal ?? false, meta: String(l.meta), causado: String(l.causado) });
    });
  }
  await db.insert(schema.edrLineas).values(edrRows);

  console.log("Alertas WOW (inventario crítico + mortalidad fuera de meta)...");
  await db.insert(schema.alertas).values([
    { tipo: "inventario_critico", severidad: "alta", titulo: "Alcance de inventario — Maíz", detalle: "4 días restantes (por debajo del mínimo de 7 días)", entidadRef: "Maíz" },
    { tipo: "inventario_critico", severidad: "alta", titulo: "Alcance de inventario — Soya", detalle: "3 días restantes (por debajo del mínimo de 7 días)", entidadRef: "Soya" },
    { tipo: "inventario_critico", severidad: "alta", titulo: "Alcance de inventario — Aceite", detalle: "2 días restantes — el más crítico de los 3 insumos (mínimo 7 días)", entidadRef: "Aceite" },
    { tipo: "mortalidad_alta", severidad: "media", titulo: "Mortalidad sobre meta — Pollo Engorde", detalle: "7.8% causado vs. 5.2% meta (+50%) en Chiriquí — Engorde", entidadRef: ubic.polloEngorde.id },
    { tipo: "mortalidad_alta", severidad: "media", titulo: "Mortalidad sobre meta — Batería Cerdo", detalle: "1.70% causado vs. 1% meta en Azuero", entidadRef: ubic.guarico.id },
  ]);

  console.log("Usuarios...");
  const passHash = await bcrypt.hash("agropulse2026", 10);
  await db.insert(schema.usuarios).values([
    { nombre: "Gerencia Istmo", email: "gerencia@istmo-demo.com", passwordHash: passHash, rol: "gerencial", empresaId: null, ubicacionId: null },
    { nombre: "Admin AgroPulse", email: "admin@istmo-demo.com", passwordHash: passHash, rol: "admin", empresaId: null, ubicacionId: null },
    { nombre: "Operador Coclé", email: "campo.huevos@istmo-demo.com", passwordHash: passHash, rol: "campo", empresaId: empresas.huevos.id, ubicacionId: ubic.cojedes.id },
    { nombre: "Operador Chiriquí", email: "campo.pollo@istmo-demo.com", passwordHash: passHash, rol: "campo", empresaId: empresas.pollo.id, ubicacionId: ubic.polloEngorde.id },
    { nombre: "Operador Azuero", email: "campo.cerdo@istmo-demo.com", passwordHash: passHash, rol: "campo", empresaId: empresas.cerdo.id, ubicacionId: ubic.guarico.id },
  ]);

  console.log("Listo. Usuarios demo (todos con clave agropulse2026):");
  console.log("  gerencia@istmo-demo.com  (ve todo, consolidado)");
  console.log("  admin@istmo-demo.com");
  console.log("  campo.huevos@istmo-demo.com / campo.pollo@istmo-demo.com / campo.cerdo@istmo-demo.com");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
