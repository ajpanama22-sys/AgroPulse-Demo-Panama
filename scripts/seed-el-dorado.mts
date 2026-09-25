// Siembra el módulo "Pollo de Engorde — Agropecuaria El Dorado (Grupo JHS)"
// que SOAINT propuso en el Mapa de Solución MVP1 + Mapa de Arquitectura.
// Es un módulo NUEVO y aditivo: no toca ni borra los datos sembrados por
// scripts/seed-db.mts (Agroindustrias del Istmo / Avícola Chiriquí) — usa
// la misma unidad de negocio "pollo" pero una EMPRESA distinta ("Agropecuaria
// El Dorado"), así ambos demos conviven en la misma base.
//
// Corre con: npm run seed:el-dorado
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { pesoEstandarEnEdad, CURVA_COBB_ROSS, CURVA_HUBBARD_ESTIMADA, type Genetica } from "../src/lib/analisis-pollo";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const HOY_DEMO = new Date("2026-09-18T00:00:00Z");
const isoHace = (dias: number) => {
  const d = new Date(HOY_DEMO);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};
const qr = async (token: string) => token; // los qrToken son strings simples, no hace falta generar la imagen acá (se genera on-demand en /admin)

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.round(rand(min, max));
}

type GranjaSeed = {
  nombre: string;
  supervisorNombre: string | null;
  personalAsociado: number | null;
  estadoDatos: "completo" | "por_completar";
  galpones: number;
};

const GRANJAS: GranjaSeed[] = [
  { nombre: "Nuevo Amanecer", supervisorNombre: "M. Peña", personalAsociado: 6, estadoDatos: "completo", galpones: 4 },
  { nombre: "Los Álamos", supervisorNombre: "R. Gómez", personalAsociado: 5, estadoDatos: "completo", galpones: 3 },
  { nombre: "El Roble", supervisorNombre: null, personalAsociado: null, estadoDatos: "por_completar", galpones: 5 },
  { nombre: "Santa Inés", supervisorNombre: null, personalAsociado: null, estadoDatos: "por_completar", galpones: 2 },
  { nombre: "La Esperanza", supervisorNombre: "J. Duarte", personalAsociado: 4, estadoDatos: "completo", galpones: 3 },
  { nombre: "Buenavista", supervisorNombre: "L. Herrera", personalAsociado: 5, estadoDatos: "completo", galpones: 3 },
  { nombre: "Las Mercedes", supervisorNombre: "C. Rivas", personalAsociado: 4, estadoDatos: "completo", galpones: 2 },
  { nombre: "El Paraíso", supervisorNombre: "A. Solís", personalAsociado: 3, estadoDatos: "completo", galpones: 2 },
  { nombre: "San Isidro", supervisorNombre: "P. Nuñez", personalAsociado: 4, estadoDatos: "completo", galpones: 3 },
  { nombre: "La Victoria", supervisorNombre: null, personalAsociado: null, estadoDatos: "por_completar", galpones: 2 },
  { nombre: "Monte Verde", supervisorNombre: "F. Castillo", personalAsociado: 3, estadoDatos: "completo", galpones: 2 },
  { nombre: "El Progreso", supervisorNombre: "D. Ábrego", personalAsociado: 4, estadoDatos: "completo", galpones: 3 },
  { nombre: "Las Flores", supervisorNombre: "S. Quintero", personalAsociado: 3, estadoDatos: "completo", galpones: 2 },
];

// Lotes tal como aparecen en las capturas de pantalla del Mapa de Solución
// (Seguimiento de Lotes / Dashboard) — se usan exactos donde el documento
// los muestra; el resto de las granjas recibe un lote activo generado con
// parámetros plausibles.
const LOTES_FIJOS: Record<string, { codigo: string; galponIdx: number; genetica: Genetica; diaCiclo: number; poblacionInicial: number; desviacion: number }> = {
  "Nuevo Amanecer": { codigo: "LT-0231", galponIdx: 1, genetica: "hubbard", diaCiclo: 18, poblacionInicial: 5661, desviacion: 1.02 },
  "Los Álamos": { codigo: "LT-0198", galponIdx: 0, genetica: "ross", diaCiclo: 35, poblacionInicial: 5250, desviacion: 0.86 },
  "La Esperanza": { codigo: "LT-0252", galponIdx: 0, genetica: "hubbard", diaCiclo: 7, poblacionInicial: 5370, desviacion: 1.0 },
  "El Roble": { codigo: "LT-0244", galponIdx: 2, genetica: "cobb_500", diaCiclo: 1, poblacionInicial: 5400, desviacion: 1.0 },
  "Santa Inés": { codigo: "LT-0219", galponIdx: 1, genetica: "ross", diaCiclo: 24, poblacionInicial: 5300, desviacion: 0.93 },
  "Buenavista": { codigo: "LT-0207", galponIdx: 0, genetica: "hubbard", diaCiclo: 29, poblacionInicial: 5150, desviacion: 0.91 },
};

const GENETICAS: Genetica[] = ["cobb_500", "ross", "hubbard"];
const CAUSAS_MORT = ["ascitis", "problema_patas", "respiratorio", "picaje", "otra"] as const;

async function main() {
  console.log("=== Seed El Dorado — Pollo de Engorde (MVP1 + arquitectura completa) ===");

  console.log("Empresa / unidad de negocio...");
  let unidadPollo = (await db.select().from(schema.unidadesNegocio).where(eq(schema.unidadesNegocio.slug, "pollo")))[0];
  if (!unidadPollo) {
    unidadPollo = { id: randomUUID(), slug: "pollo", nombre: "Pollo", colorHex: "#1d5a96", icono: "bird", orden: 2 };
    await db.insert(schema.unidadesNegocio).values(unidadPollo);
  }

  // Empresa dedicada — si ya existe (reruns del script), se reusa en vez de duplicar.
  let elDorado = (await db.select().from(schema.empresas).where(eq(schema.empresas.nombre, "Agropecuaria El Dorado — División de Grupo JHS")))[0];
  if (!elDorado) {
    elDorado = { id: randomUUID(), unidadNegocioId: unidadPollo.id, nombre: "Agropecuaria El Dorado — División de Grupo JHS" };
    await db.insert(schema.empresas).values(elDorado);
  } else {
    // Rerun limpio: borra en cascada todo lo de El Dorado antes de re-sembrar.
    console.log("  (ya existía — limpiando datos previos de El Dorado)");
    const granjasPrevias = await db.select().from(schema.ubicaciones).where(eq(schema.ubicaciones.empresaId, elDorado.id));
    const idsPrevios = granjasPrevias.map((g) => g.id);
    if (idsPrevios.length) {
      const lotesPrevios = await db.select().from(schema.lotesPollo);
      const lotesDeElDorado = lotesPrevios.filter((l) => idsPrevios.includes(l.ubicacionId));
      for (const l of lotesDeElDorado) {
        await db.delete(schema.conciliacionesPlanta).where(eq(schema.conciliacionesPlanta.loteId, l.id));
        await db.delete(schema.loteEventosPollo).where(eq(schema.loteEventosPollo.loteId, l.id));
      }
      await db.delete(schema.lotesPollo).where(eq(schema.lotesPollo.ubicacionId, idsPrevios[0])); // placeholder, se completa abajo
      for (const id of idsPrevios) await db.delete(schema.lotesPollo).where(eq(schema.lotesPollo.ubicacionId, id));
      await db.delete(schema.asignacionesCampo);
      for (const id of idsPrevios) await db.delete(schema.ubicaciones).where(eq(schema.ubicaciones.id, id));
    }
  }

  console.log("Estándar Genético (Cobb 500 / Ross 308 / Hubbard 1,2)...");
  await db.delete(schema.estandarGenetico);
  const filasEstandar: (typeof schema.estandarGenetico.$inferInsert)[] = [];
  for (const punto of CURVA_COBB_ROSS) {
    filasEstandar.push({ genetica: "cobb_500", edadDias: punto.edadDias, pesoEstandarGr: String(punto.pesoEstandarGr), fuente: "Registro de Granja — El Dorado (transcrito de tabla en papel, Cobb/Ross)" });
    filasEstandar.push({ genetica: "ross", edadDias: punto.edadDias, pesoEstandarGr: String(punto.pesoEstandarGr), fuente: "Registro de Granja — El Dorado (transcrito de tabla en papel, Cobb/Ross)" });
  }
  for (const punto of CURVA_HUBBARD_ESTIMADA) {
    filasEstandar.push({ genetica: "hubbard", edadDias: punto.edadDias, pesoEstandarGr: String(punto.pesoEstandarGr), fuente: "ESTIMADO — derivado de curvas públicas Aviagen/Cobb 2022, pendiente de verificar con el proveedor de genética Hubbard de El Dorado" });
  }
  await db.insert(schema.estandarGenetico).values(filasEstandar);

  console.log("13 granjas + galpones...");
  const granjaRows: (typeof schema.ubicaciones.$inferInsert & { id: string })[] = [];
  const galponesPorGranja: Record<string, (typeof schema.ubicaciones.$inferInsert & { id: string })[]> = {};
  let qrSeq = 1;
  for (const g of GRANJAS) {
    const id = randomUUID();
    const slug = g.nombre.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    const row = {
      id,
      empresaId: elDorado.id,
      padreId: null,
      nombre: g.nombre,
      tipo: "granja" as const,
      subUnidad: null,
      qrToken: `ELD-GRANJA-${slug}-${qrSeq++}`,
      activa: true,
      supervisorNombre: g.supervisorNombre,
      personalAsociado: g.personalAsociado,
      estadoDatos: g.estadoDatos,
    };
    granjaRows.push(row);
    const galpones = [];
    for (let i = 1; i <= g.galpones; i++) {
      galpones.push({
        id: randomUUID(),
        empresaId: elDorado.id,
        padreId: id,
        nombre: `Galpón ${i}`,
        tipo: "galpon" as const,
        subUnidad: null,
        qrToken: `ELD-GALPON-${slug}-${i}`,
        activa: true,
        supervisorNombre: null,
        personalAsociado: null,
        estadoDatos: null,
      });
    }
    galponesPorGranja[g.nombre] = galpones;
  }
  await db.insert(schema.ubicaciones).values(granjaRows);
  await db.insert(schema.ubicaciones).values(Object.values(galponesPorGranja).flat());

  console.log("Lotes activos (uno por granja) + eventos de campo...");
  const lotesInsert: (typeof schema.lotesPollo.$inferInsert & { id: string })[] = [];
  const eventosInsert: (typeof schema.loteEventosPollo.$inferInsert)[] = [];
  let loteSeq = 260;

  for (const g of GRANJAS) {
    const fijo = LOTES_FIJOS[g.nombre];
    const genetica: Genetica = fijo?.genetica ?? GENETICAS[randInt(0, 2)];
    const diaCiclo = fijo?.diaCiclo ?? randInt(3, 35);
    const poblacionInicial = fijo?.poblacionInicial ?? randInt(4800, 5800);
    const desviacion = fijo?.desviacion ?? rand(0.94, 1.03);
    const galpon = galponesPorGranja[g.nombre][fijo?.galponIdx ?? 0];
    const codigo = fijo?.codigo ?? `LT-0${loteSeq++}`;
    const fechaAlojamiento = isoHace(diaCiclo);
    const pesoInicialGr = pesoEstandarEnEdad(genetica, 0);
    const loteId = randomUUID();

    lotesInsert.push({
      id: loteId,
      ubicacionId: galpon.id,
      codigo,
      genetica,
      fechaAlojamiento,
      poblacionInicial,
      pesoInicialGr: String(pesoInicialGr),
      estado: "activo",
      fechaCierre: null,
      avesBeneficio: null,
      kgBeneficiados: null,
      pctPolloA: null,
      pctPolloB: null,
      pctMerma: null,
      conversion: null,
      iee: null,
    });

    let saldo = poblacionInicial;
    for (let d = 1; d <= diaCiclo; d++) {
      const fecha = isoHace(diaCiclo - d);
      // Mortalidad diaria — ritmo bajo, con un pico en la primera semana
      // (típico del arranque de pollitos BB).
      const baseMort = d <= 7 ? rand(0.0006, 0.0016) : rand(0.0002, 0.0007);
      const muertas = Math.max(0, Math.round(saldo * baseMort * (desviacion < 0.95 ? 1.6 : 1)));
      saldo -= muertas;
      eventosInsert.push({
        loteId, fecha, tipo: "mortalidad", edadDias: d,
        mortalidadCantidad: muertas, mortalidadCausa: CAUSAS_MORT[randInt(0, CAUSAS_MORT.length - 1)],
        descarteCantidad: null, descarteMotivo: null,
        pesoMuestraGr: null, tamanoMuestra: null, alimentoConsumidoKg: null,
        avesMovidas: null, kgMovidos: null, clasificacion: null, observaciones: null,
        creadoEnDispositivo: new Date(fecha + "T07:30:00Z"),
      });

      // Descarte — esporádico, cada ~6 días.
      if (d % 6 === 0) {
        const descartadas = randInt(1, 4);
        saldo -= descartadas;
        eventosInsert.push({
          loteId, fecha, tipo: "descarte", edadDias: d,
          mortalidadCantidad: null, mortalidadCausa: null,
          descarteCantidad: descartadas, descarteMotivo: "Ave con retraso de crecimiento marcado / lesión",
          pesoMuestraGr: null, tamanoMuestra: null, alimentoConsumidoKg: null,
          avesMovidas: null, kgMovidos: null, clasificacion: null, observaciones: null,
          creadoEnDispositivo: new Date(fecha + "T07:35:00Z"),
        });
      }

      // Consumo de alimento — gramos/ave/día aproximados a partir de la
      // pendiente de la curva estándar de esa genética (kg totales = saldo
      // × gr/ave/día ÷ 1000), con la desviación del lote aplicada también
      // al consumo (un lote por debajo de meta también come algo menos).
      const pesoHoy = pesoEstandarEnEdad(genetica, d);
      const pesoAyer = pesoEstandarEnEdad(genetica, Math.max(0, d - 1));
      const gananciaEstandarGr = Math.max(2, pesoHoy - pesoAyer);
      const gramosAveDia = gananciaEstandarGr * 1.55 * desviacion; // FCR ~1.5-1.7 típico del ciclo
      const consumoKg = (saldo * gramosAveDia) / 1000;
      eventosInsert.push({
        loteId, fecha, tipo: "alimento", edadDias: d,
        mortalidadCantidad: null, mortalidadCausa: null, descarteCantidad: null, descarteMotivo: null,
        pesoMuestraGr: null, tamanoMuestra: null,
        alimentoConsumidoKg: consumoKg.toFixed(2),
        avesMovidas: null, kgMovidos: null, clasificacion: null, observaciones: null,
        creadoEnDispositivo: new Date(fecha + "T16:00:00Z"),
      });

      // Pesaje muestral — solo en días hito (0-10 diario, luego 14/21/28/33/35).
      const esHito = d <= 10 || [14, 21, 28, 33, 35].includes(d);
      if (esHito) {
        const tamanoMuestra = 100;
        const pesoRealPromGr = pesoHoy * desviacion;
        eventosInsert.push({
          loteId, fecha, tipo: "pesaje", edadDias: d,
          mortalidadCantidad: null, mortalidadCausa: null, descarteCantidad: null, descarteMotivo: null,
          pesoMuestraGr: (pesoRealPromGr * tamanoMuestra).toFixed(1),
          tamanoMuestra,
          alimentoConsumidoKg: null, avesMovidas: null, kgMovidos: null, clasificacion: null,
          observaciones: null,
          creadoEnDispositivo: new Date(fecha + "T11:00:00Z"),
        });
      }
    }
  }

  await db.insert(schema.lotesPollo).values(lotesInsert);
  // Insertar eventos en tandas (Neon HTTP tiene límite práctico de payload).
  for (let i = 0; i < eventosInsert.length; i += 300) {
    await db.insert(schema.loteEventosPollo).values(eventosInsert.slice(i, i + 300));
  }
  console.log(`  ${lotesInsert.length} lotes activos, ${eventosInsert.length} eventos de campo.`);

  console.log("Dos lotes cerrados + Conciliación con Planta (uno aprobado, uno bloqueado)...");
  const galponCerrado1 = galponesPorGranja["Las Mercedes"][0];
  const galponCerrado2 = galponesPorGranja["El Paraíso"][0];
  const cerrado1Id = randomUUID();
  const cerrado2Id = randomUUID();
  const cerrado1Poblacion = 5200;
  const cerrado2Poblacion = 5100;
  await db.insert(schema.lotesPollo).values([
    {
      id: cerrado1Id, ubicacionId: galponCerrado1.id, codigo: "LT-0220", genetica: "cobb_500",
      fechaAlojamiento: isoHace(37), poblacionInicial: cerrado1Poblacion, pesoInicialGr: String(pesoEstandarEnEdad("cobb_500", 0)),
      estado: "cerrado", fechaCierre: isoHace(2),
      avesBeneficio: 4980, kgBeneficiados: "10897", pctPolloA: "89", pctPolloB: "8", pctMerma: "3",
      conversion: "1.62", iee: "378",
    },
    {
      id: cerrado2Id, ubicacionId: galponCerrado2.id, codigo: "LT-0219b", genetica: "ross",
      fechaAlojamiento: isoHace(39), poblacionInicial: cerrado2Poblacion, pesoInicialGr: String(pesoEstandarEnEdad("ross", 0)),
      estado: "cerrado", fechaCierre: isoHace(4),
      avesBeneficio: 4762, kgBeneficiados: "10112", pctPolloA: "82", pctPolloB: "11", pctMerma: "7",
      conversion: "1.79", iee: "331",
    },
  ]);

  const conc1 = { avesGranja: 4980, kgGranja: 10897, avesPlanta: 4970, kgPlanta: 10951 }; // desviación pequeña -> aprobado
  const conc2 = { avesGranja: 4762, kgGranja: 10112, avesPlanta: 4720, kgPlanta: 9760 }; // desviación grande -> bloqueado
  function desviacion(a: number, b: number) {
    return a === 0 ? 0 : (Math.abs(b - a) / a) * 100;
  }
  await db.insert(schema.conciliacionesPlanta).values([
    {
      loteId: cerrado1Id, fecha: isoHace(2),
      avesReportadasGranja: conc1.avesGranja, kgReportadosGranja: String(conc1.kgGranja),
      avesReportadasPlanta: conc1.avesPlanta, kgReportadosPlanta: String(conc1.kgPlanta),
      umbralTolerancia: "0.02",
      desviacionAvesPct: desviacion(conc1.avesGranja, conc1.avesPlanta).toFixed(2),
      desviacionPesoPct: desviacion(conc1.kgGranja, conc1.kgPlanta).toFixed(2),
      estado: "aprobado", aprobadoEn: new Date(isoHace(2) + "T15:00:00Z"),
    },
    {
      loteId: cerrado2Id, fecha: isoHace(4),
      avesReportadasGranja: conc2.avesGranja, kgReportadosGranja: String(conc2.kgGranja),
      avesReportadasPlanta: conc2.avesPlanta, kgReportadosPlanta: String(conc2.kgPlanta),
      umbralTolerancia: "0.02",
      desviacionAvesPct: desviacion(conc2.avesGranja, conc2.avesPlanta).toFixed(2),
      desviacionPesoPct: desviacion(conc2.kgGranja, conc2.kgPlanta).toFixed(2),
      estado: "bloqueado",
    },
  ]);

  console.log("Usuarios (Operario, Supervisor, Coordinación Central, Gerencia)...");
  const passHash = await bcrypt.hash("Demo2026!", 10);
  const operarioId = randomUUID();
  const usuarios = [
    { id: operarioId, nombre: "J. Ramírez", email: "operario.eldorado@grupojhs-demo.com", passwordHash: passHash, rol: "campo" as const, empresaId: elDorado.id, ubicacionId: galponesPorGranja["Nuevo Amanecer"][1].id },
    { id: randomUUID(), nombre: "M. Peña", email: "supervisor.eldorado@grupojhs-demo.com", passwordHash: passHash, rol: "supervisor" as const, empresaId: elDorado.id, ubicacionId: granjaRows.find((g) => g.nombre === "Nuevo Amanecer")!.id },
    { id: randomUUID(), nombre: "J. Ariza", email: "coordinacion.eldorado@grupojhs-demo.com", passwordHash: passHash, rol: "coordinacion" as const, empresaId: elDorado.id, ubicacionId: null },
    { id: randomUUID(), nombre: "José Ariza", email: "gerencia.eldorado@grupojhs-demo.com", passwordHash: passHash, rol: "gerencial" as const, empresaId: elDorado.id, ubicacionId: null },
  ];
  await db.insert(schema.usuarios).values(usuarios);

  // El operario de campo del demo tiene 3 galpones asignados en 3 granjas
  // distintas (tal como muestra la pantalla "Mis Granjas" del Mapa de
  // Solución): Nuevo Amanecer G2, Los Álamos G1, El Roble G3.
  await db.insert(schema.asignacionesCampo).values([
    { usuarioId: operarioId, ubicacionId: galponesPorGranja["Nuevo Amanecer"][1].id },
    { usuarioId: operarioId, ubicacionId: galponesPorGranja["Los Álamos"][0].id },
    { usuarioId: operarioId, ubicacionId: galponesPorGranja["El Roble"][2].id },
  ]);

  console.log("\n=== Listo ===");
  console.log("13 granjas, ~38 galpones, 13 lotes activos + 2 cerrados, estándar genético (3 razas), 2 conciliaciones.");
  console.log("Usuarios (password para todos: Demo2026!):");
  for (const u of usuarios) console.log(`  ${u.rol.padEnd(12)} ${u.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
