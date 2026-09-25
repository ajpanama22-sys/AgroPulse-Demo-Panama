// Cálculos del módulo Pollo de Engorde — El Dorado (Grupo JHS), MVP 1 +
// alcance de arquitectura completo (evidencia fotográfica + conciliación
// con planta beneficiadora). Todo se deriva de eventos reales de lote
// (mortalidad, descarte, alimento, pesaje, saque, beneficio) y de la tabla
// de Estándar Genético por raza/edad — nunca de un número tipeado a mano —
// para que cada indicador del dashboard se pueda auditar evento por evento,
// tal como piden las historias de usuario de Gerencia y Coordinación.
//
// Fuentes de las fórmulas:
//  - Conversión, Gr/Ave/Día, Kg producidos: nota al pie de
//    "Registro_Granja_Pollo_Engorde.xlsx" (hoja Plantilla).
//  - I.E.E. (Índice de Eficiencia Europeo): fórmula estándar de la
//    industria avícola, la misma referenciada en "Motor de cálculo BI"
//    de la Estimación MVP1 (fila F2-11).
//  - Estándar genético Cobb 500 / Ross 308: transcrito por el cliente en
//    el Excel de Registro de Granja (edades 0,7,14,21,28,33,35 días) —
//    se usa tal cual, ambas razas comparten esa curva en la operación de
//    El Dorado.
//  - Estándar genético Hubbard 1,2: NO viene en los documentos del
//    cliente. Se estima a partir de las curvas públicas oficiales de
//    Aviagen (Ross 308, "Broiler Performance Objectives 2022") y Cobb
//    ("Cobb500 Broiler Performance & Nutrition Supplement 2022),
//    aplicando el descuento de peso que reportan los comparativos de
//    industria entre líneas Hubbard Classic/Flex y Ross/Cobb a la misma
//    edad (Hubbard llega algo más liviana). MARCADO COMO ESTIMADO — pedir
//    a El Dorado la tabla oficial de su proveedor de genética Hubbard
//    antes de pasar esto a producción.

export type Genetica = "cobb_500" | "hubbard" | "ross";

export type EstandarGeneticoPunto = {
  genetica: Genetica;
  edadDias: number;
  pesoEstandarGr: number;
};

export type EventoLote = {
  id?: string;
  tipo: "mortalidad" | "descarte" | "pesaje" | "alimento" | "saque" | "beneficio";
  fecha: string;
  edadDias: number | null;
  mortalidadCantidad: number | null;
  descarteCantidad: number | null;
  descarteMotivo: string | null;
  pesoMuestraGr: string | number | null; // PESO TOTAL de la muestra, en gramos (no el promedio)
  tamanoMuestra: number | null; // cantidad de aves en la muestra de pesaje
  alimentoConsumidoKg: string | number | null;
  avesMovidas: number | null;
  kgMovidos: string | number | null;
  clasificacion: string | null;
  observaciones: string | null;
};

export type LotePollo = {
  id: string;
  ubicacionId: string;
  codigo: string;
  genetica: Genetica;
  fechaAlojamiento: string;
  poblacionInicial: number;
  pesoInicialGr: string | number | null;
  estado: "activo" | "cerrado";
  fechaCierre: string | null;
  avesBeneficio: number | null;
  kgBeneficiados: string | number | null;
  pctPolloA: string | number | null;
  pctPolloB: string | number | null;
  pctMerma: string | number | null;
  conversion: string | number | null;
  iee: string | number | null;
};

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

// ---------------------------------------------------------------------
// Estándar genético — curva de peso objetivo por raza/edad
// ---------------------------------------------------------------------

/** Curva "oficial de la operación" transcrita por el cliente — Cobb 500 y
 * Ross 308 comparten esta misma curva en El Dorado (confirmado por el
 * cliente: "cobb/ross se mueven igual"). */
export const CURVA_COBB_ROSS: { edadDias: number; pesoEstandarGr: number }[] = [
  { edadDias: 0, pesoEstandarGr: 42 },
  { edadDias: 7, pesoEstandarGr: 186 },
  { edadDias: 14, pesoEstandarGr: 502 },
  { edadDias: 21, pesoEstandarGr: 993 },
  { edadDias: 28, pesoEstandarGr: 1560 },
  { edadDias: 33, pesoEstandarGr: 1989 },
  { edadDias: 35, pesoEstandarGr: 2164 },
];

/** ESTIMADA — Hubbard 1,2. Ver nota de fuentes arriba. Aplica un castigo
 * creciente sobre la curva Cobb/Ross del cliente (0% al día 0, ~8% al
 * día 35), consistente con los comparativos públicos Hubbard vs.
 * Ross/Cobb a la misma edad. Reemplazar en cuanto El Dorado confirme la
 * tabla real de su proveedor de genética. */
export const CURVA_HUBBARD_ESTIMADA: { edadDias: number; pesoEstandarGr: number }[] = [
  { edadDias: 0, pesoEstandarGr: 42 },
  { edadDias: 7, pesoEstandarGr: 180 },
  { edadDias: 14, pesoEstandarGr: 477 },
  { edadDias: 21, pesoEstandarGr: 933 },
  { edadDias: 28, pesoEstandarGr: 1451 },
  { edadDias: 33, pesoEstandarGr: 1840 },
  { edadDias: 35, pesoEstandarGr: 1991 },
];

export function curvaBase(genetica: Genetica) {
  return genetica === "hubbard" ? CURVA_HUBBARD_ESTIMADA : CURVA_COBB_ROSS;
}

/** Interpola linealmente el peso estándar en una edad exacta a partir de
 * los puntos de la tabla `estandar_genetico` (o de la curva base, si no
 * se pasa `tabla`). Fuera de rango, se clampa al extremo más cercano. */
export function pesoEstandarEnEdad(genetica: Genetica, edadDias: number, tabla?: EstandarGeneticoPunto[]): number {
  const puntos = (tabla?.filter((p) => p.genetica === genetica).map((p) => ({ edadDias: p.edadDias, pesoEstandarGr: p.pesoEstandarGr })) ?? curvaBase(genetica))
    .slice()
    .sort((a, b) => a.edadDias - b.edadDias);
  if (puntos.length === 0) return 0;
  if (edadDias <= puntos[0].edadDias) return puntos[0].pesoEstandarGr;
  if (edadDias >= puntos.at(-1)!.edadDias) return puntos.at(-1)!.pesoEstandarGr;
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    if (edadDias >= a.edadDias && edadDias <= b.edadDias) {
      const frac = (edadDias - a.edadDias) / (b.edadDias - a.edadDias);
      return a.pesoEstandarGr + (b.pesoEstandarGr - a.pesoEstandarGr) * frac;
    }
  }
  return puntos.at(-1)!.pesoEstandarGr;
}

// ---------------------------------------------------------------------
// Edad / inventario
// ---------------------------------------------------------------------

export function edadDelLote(lote: LotePollo, hoy = new Date()): number {
  const ref = lote.fechaCierre ? new Date(lote.fechaCierre + "T00:00:00Z") : hoy;
  const inicio = new Date(lote.fechaAlojamiento + "T00:00:00Z");
  return Math.max(0, Math.round((ref.getTime() - inicio.getTime()) / 86_400_000));
}

export function mortalidadAcumulada(eventos: EventoLote[]): number {
  return eventos.filter((e) => e.tipo === "mortalidad").reduce((s, e) => s + (e.mortalidadCantidad ?? 0), 0);
}

/** Descarte — separado de mortalidad (RF de la Estimación MVP1: "Saldo de
 * aves" resta AMBOS, pero se reportan como acumulados independientes). */
export function descarteAcumulado(eventos: EventoLote[]): number {
  return eventos.filter((e) => e.tipo === "descarte").reduce((s, e) => s + (e.descarteCantidad ?? 0), 0);
}

/** Saldo de aves = alojadas − mortalidad acumulada − descarte acumulado.
 * Es el número que las pantallas de Mortalidad/Consumo muestran como
 * "Saldo de aves (auto)" y el que alimenta Gr/Ave/Día y Kg producidos. */
export function saldoAves(lote: LotePollo, eventos: EventoLote[]): number {
  return Math.max(0, lote.poblacionInicial - mortalidadAcumulada(eventos) - descarteAcumulado(eventos));
}

/** Alias — mantiene el nombre usado por el resto del panel (Aves Vivas /
 * Inventario). Es el mismo saldo de aves. */
export const avesVivas = saldoAves;

export function pctViabilidad(lote: LotePollo, eventos: EventoLote[]): number {
  if (lote.poblacionInicial === 0) return 0;
  return (avesVivas(lote, eventos) / lote.poblacionInicial) * 100;
}

/** % Mortalidad acumulada — SOLO mortalidad (no incluye descarte), tal
 * como lo reporta la hoja "Registro de Granja" en la columna "% Acum". */
export function pctMortalidad(lote: LotePollo, eventos: EventoLote[]): number {
  if (lote.poblacionInicial === 0) return 0;
  return (mortalidadAcumulada(eventos) / lote.poblacionInicial) * 100;
}

export function pctDescarte(lote: LotePollo, eventos: EventoLote[]): number {
  if (lote.poblacionInicial === 0) return 0;
  return (descarteAcumulado(eventos) / lote.poblacionInicial) * 100;
}

// ---------------------------------------------------------------------
// Peso / conversión / IEE / GDP
// ---------------------------------------------------------------------

/** Último pesaje muestral registrado, en KG (promedio de la muestra:
 * peso total de la muestra ÷ cantidad de aves pesadas) — no un promedio
 * histórico de todos los pesajes, porque lo que importa para
 * conversión/IEE/GDP es el peso VIGENTE del lote. */
export function pesoPromedioActualKg(eventos: EventoLote[]): number | null {
  const pesajes = eventos
    .filter((e) => e.tipo === "pesaje" && e.pesoMuestraGr != null && (e.tamanoMuestra ?? 0) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = pesajes.at(-1);
  if (!ultimo) return null;
  const totalGr = num(ultimo.pesoMuestraGr);
  const muestra = ultimo.tamanoMuestra ?? 1;
  return totalGr / muestra / 1000;
}

export function alimentoAcumuladoKg(eventos: EventoLote[]): number {
  return eventos.filter((e) => e.tipo === "alimento").reduce((s, e) => s + num(e.alimentoConsumidoKg), 0);
}

/** Kg producidos acumulados = saldo de aves × peso promedio actual (kg).
 * Fórmula tal cual la nota del Excel de Registro de Granja. */
export function kgProducidos(lote: LotePollo, eventos: EventoLote[]): number | null {
  const pesoKg = pesoPromedioActualKg(eventos);
  if (pesoKg === null) return null;
  return saldoAves(lote, eventos) * pesoKg;
}

/** Conversión alimenticia (FCR) = alimento acumulado (kg) ÷ kg
 * producidos. Null si todavía no hay pesaje o alimento suficiente para
 * calcularla (mejor mostrar "—" que un número inventado). */
export function conversionActual(lote: LotePollo, eventos: EventoLote[]): number | null {
  const producidos = kgProducidos(lote, eventos);
  const alimento = alimentoAcumuladoKg(eventos);
  if (!producidos || alimento === 0) return null;
  return alimento / producidos;
}

/** Gramos de alimento consumido por ave, en el día más reciente con
 * evento de alimento — "Gr/Ave/Día (auto)" de la pantalla de Consumo. */
export function gramosAveDiaHoy(lote: LotePollo, eventos: EventoLote[]): number | null {
  const alimentos = eventos.filter((e) => e.tipo === "alimento").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = alimentos.at(-1);
  if (!ultimo) return null;
  const saldo = saldoAves(lote, eventos);
  if (saldo === 0) return null;
  return (num(ultimo.alimentoConsumidoKg) * 1000) / saldo;
}

/** I.E.E. (Índice de Eficiencia Europeo) = (Viabilidad% × Peso vivo
 * prom. kg × 100) / (Edad días × Conversión) — fórmula estándar de la
 * industria avícola, la misma que referencia el motor de cálculo BI de
 * la estimación (fila F2-11). */
export function ieeActual(lote: LotePollo, eventos: EventoLote[], hoy?: Date): number | null {
  const pesoKg = pesoPromedioActualKg(eventos);
  const conversion = conversionActual(lote, eventos);
  const edad = edadDelLote(lote, hoy);
  if (!pesoKg || !conversion || edad === 0) return null;
  const viabilidad = pctViabilidad(lote, eventos);
  return (viabilidad * pesoKg * 100) / (edad * conversion);
}

/** G.D.P. — Ganancia Diaria de Peso, en gramos/día: (peso actual − peso
 * inicial al alojamiento) ÷ edad en días. Es uno de los 4 "KPIs núcleo"
 * del panel (junto a IEE, FCR y Mortalidad). */
export function gdpActual(lote: LotePollo, eventos: EventoLote[], hoy?: Date): number | null {
  const pesoActualKg = pesoPromedioActualKg(eventos);
  const edad = edadDelLote(lote, hoy);
  if (pesoActualKg === null || edad === 0) return null;
  const pesoInicialGr = lote.pesoInicialGr !== null ? num(lote.pesoInicialGr) : pesoEstandarEnEdad(lote.genetica, 0);
  return (pesoActualKg * 1000 - pesoInicialGr) / edad;
}

/** Edad de sacrificio de UN lote cerrado (días entre alojamiento y
 * cierre) — Premisas MVP1 #3: "Cierre de lote... deriva la Edad de
 * Sacrificio". */
export function edadSacrificio(lote: LotePollo): number | null {
  if (lote.estado !== "cerrado" || !lote.fechaCierre) return null;
  return edadDelLote(lote);
}

/** Edad promedio de sacrificio de un conjunto de lotes cerrados — KPI
 * núcleo del motor de cálculo BI (junto a IEE/FCR/GDP/Mortalidad). */
export function edadPromedioSacrificio(lotes: LotePollo[]): number | null {
  const edades = lotes.map(edadSacrificio).filter((e): e is number => e !== null);
  if (edades.length === 0) return null;
  return edades.reduce((s, e) => s + e, 0) / edades.length;
}

export function clasificacionBeneficio(lote: LotePollo): { label: string; value: number; color: string }[] {
  return [
    { label: "Pollo A", value: num(lote.pctPolloA), color: "#ef7d1e" },
    { label: "Pollo B", value: num(lote.pctPolloB), color: "#ffbf80" },
    { label: "Merma", value: num(lote.pctMerma), color: "#c23b3b" },
  ].filter((s) => s.value > 0);
}

// ---------------------------------------------------------------------
// Proyectado vs. Ejecutado — los 8 indicadores del Dashboard Ejecutivo
// ---------------------------------------------------------------------

export type IndicadorComparado = {
  clave: string;
  etiqueta: string;
  proyectado: number;
  ejecutado: number;
  diferencia: number;
  pctCumplimiento: number;
  unidad: string;
};

/** Compara Proyectado vs. Ejecutado y calcula %Cumplimiento. Para los
 * indicadores donde "menos es mejor" (Mortalidad, Conversión) el
 * cumplimiento sube cuando el ejecutado queda POR DEBAJO del proyectado;
 * para el resto (Inventario, IEE, Edad Sacrif., Peso, GDP), cuando el
 * ejecutado se ACERCA o SUPERA el proyectado. El resultado se clampa a
 * [0, 120]% para que un solo lote atípico no rompa el promedio de la
 * barra en el dashboard. */
export function compararIndicador(
  clave: string,
  etiqueta: string,
  proyectado: number,
  ejecutado: number,
  unidad: string,
  menorEsMejor = false
): IndicadorComparado {
  const diferencia = ejecutado - proyectado;
  let pct: number;
  if (proyectado === 0) {
    pct = ejecutado === 0 ? 100 : 0;
  } else if (menorEsMejor) {
    pct = 100 - (diferencia / proyectado) * 100;
  } else {
    pct = (ejecutado / proyectado) * 100;
  }
  pct = Math.max(0, Math.min(120, pct));
  return { clave, etiqueta, proyectado, ejecutado, diferencia, pctCumplimiento: pct, unidad };
}

export type ResumenLote = {
  lote: LotePollo;
  edad: number;
  saldo: number;
  pctMortalidad: number;
  pesoKg: number | null;
  conversion: number | null;
  iee: number | null;
  gdp: number | null;
  pesoEstandarKg: number;
  pctCumplimientoLote: number; // % cumplimiento del lote sobre su meta de peso a esa edad
};

/** Resumen por lote activo — insumo tanto de "Seguimiento de Lotes" como
 * del semáforo de "Granjas por estado de cumplimiento" del dashboard. */
export function resumirLote(lote: LotePollo, eventos: EventoLote[], tabla?: EstandarGeneticoPunto[], hoy?: Date): ResumenLote {
  const edad = edadDelLote(lote, hoy);
  const saldo = saldoAves(lote, eventos);
  const pesoKg = pesoPromedioActualKg(eventos);
  const pesoEstandarGr = pesoEstandarEnEdad(lote.genetica, edad, tabla);
  const pctCumplimientoLote = pesoEstandarGr > 0 && pesoKg !== null ? Math.max(0, Math.min(120, ((pesoKg * 1000) / pesoEstandarGr) * 100)) : 0;
  return {
    lote,
    edad,
    saldo,
    pctMortalidad: pctMortalidad(lote, eventos),
    pesoKg,
    conversion: conversionActual(lote, eventos),
    iee: ieeActual(lote, eventos, hoy),
    gdp: gdpActual(lote, eventos, hoy),
    pesoEstandarKg: pesoEstandarGr / 1000,
    pctCumplimientoLote,
  };
}

export function estadoSemaforo(pctCumplimiento: number): { label: string; tone: "success" | "orange" | "danger" } {
  if (pctCumplimiento >= 95) return { label: "En meta", tone: "success" };
  if (pctCumplimiento >= 90) return { label: "Vigilar", tone: "orange" };
  return { label: "Crítico", tone: "danger" };
}

/** Construye los 8 indicadores del dashboard a partir de los resúmenes de
 * TODOS los lotes activos de la organización (o de una granja filtrada).
 * "Proyectado" para cada indicador es el promedio de sus metas (estándar
 * genético a la edad de cada lote, o metas fijas de la organización);
 * "Ejecutado" es el promedio real. */
export function construirIndicadoresDashboard(resumenes: ResumenLote[], metaMortalidadPct = 3.5): IndicadorComparado[] {
  const n = resumenes.length || 1;
  const promedio = (f: (r: ResumenLote) => number | null) => {
    const vals = resumenes.map(f).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const invInicialProy = resumenes.reduce((s, r) => s + r.lote.poblacionInicial, 0);
  const invInicialEjec = invInicialProy; // el alojamiento no se "desvía" — es el mismo dato de entrada
  const invFinalProy = resumenes.reduce((s, r) => s + r.saldo + (r.pctMortalidad / 100) * r.lote.poblacionInicial, 0); // aves si no hubiera mortalidad fuera de meta
  const invFinalEjec = resumenes.reduce((s, r) => s + r.saldo, 0);

  const edadSacrifProy = resumenes.length ? resumenes.reduce((s, r) => s + curvaBase(r.lote.genetica).at(-1)!.edadDias, 0) / n : 35;
  const edadSacrifEjec = promedio((r) => r.edad);

  const pesoProy = promedio((r) => r.pesoEstandarKg);
  const pesoEjec = promedio((r) => r.pesoKg);

  const gdpProy = resumenes.length
    ? resumenes.reduce((s, r) => s + (r.pesoEstandarKg * 1000 - 42) / Math.max(1, r.edad), 0) / n
    : 0;
  const gdpEjec = promedio((r) => r.gdp);

  const conversionProy = 1.65; // meta corporativa de El Dorado para el ciclo completo
  const conversionEjec = promedio((r) => r.conversion) || conversionProy;

  const ieeProy = 380; // meta corporativa de referencia
  const ieeEjec = promedio((r) => r.iee) || ieeProy;

  const mortalidadEjec = promedio((r) => r.pctMortalidad) || 0;

  return [
    compararIndicador("inv_inicial", "Inv. Inicial", invInicialProy, invInicialEjec, "aves"),
    compararIndicador("iee", "I.E.E.", ieeProy, ieeEjec, "pts"),
    compararIndicador("mortalidad", "Mortalidad", metaMortalidadPct, mortalidadEjec, "%", true),
    compararIndicador("edad_sacrificio", "Edad Sacrif.", edadSacrifProy, edadSacrifEjec, "días"),
    compararIndicador("peso_promedio", "Peso Prom.", pesoProy, pesoEjec, "kg"),
    compararIndicador("gdp", "G.D.P.", gdpProy, gdpEjec, "g/día"),
    compararIndicador("conversion", "Conversión", conversionProy, conversionEjec, "", true),
    compararIndicador("inv_final", "Inv. Final", invFinalProy, invFinalEjec, "aves"),
  ];
}

// ---------------------------------------------------------------------
// Conciliación con Planta Beneficiadora
// ---------------------------------------------------------------------

export type ResultadoConciliacion = {
  desviacionAvesPct: number;
  desviacionPesoPct: number;
  dentroDeTolerancia: boolean;
  estadoSugerido: "aprobado" | "bloqueado";
};

/** Evalúa el cierre de lote reportado por la granja contra el reporte de
 * la planta beneficiadora. Si CUALQUIERA de las dos desviaciones (aves o
 * peso) supera el umbral de tolerancia, el sistema bloquea el cierre y
 * exige aprobación explícita de Coordinación Central — historia de
 * usuario "Como Coordinación Central, quiero que el sistema bloquee
 * automáticamente un cierre fuera de tolerancia". */
export function evaluarConciliacion(
  avesGranja: number,
  kgGranja: number,
  avesPlanta: number,
  kgPlanta: number,
  umbralTolerancia = 0.02
): ResultadoConciliacion {
  const desviacionAvesPct = avesGranja === 0 ? 0 : Math.abs(avesPlanta - avesGranja) / avesGranja;
  const desviacionPesoPct = kgGranja === 0 ? 0 : Math.abs(kgPlanta - kgGranja) / kgGranja;
  const dentroDeTolerancia = desviacionAvesPct <= umbralTolerancia && desviacionPesoPct <= umbralTolerancia;
  return {
    desviacionAvesPct: desviacionAvesPct * 100,
    desviacionPesoPct: desviacionPesoPct * 100,
    dentroDeTolerancia,
    estadoSugerido: dentroDeTolerancia ? "aprobado" : "bloqueado",
  };
}

// ---------------------------------------------------------------------
// Serie Peso Real vs. Estándar, por día de ciclo (gráfico del dashboard)
// ---------------------------------------------------------------------

export type PuntoPesoSerie = { edadDias: number; estandarGr: number; realGr: number | null };

/** Agrega, para un conjunto de lotes (activos + cerrados) y sus eventos,
 * el peso REAL promedio reportado en cada día de ciclo con pesaje, contra
 * el estándar genético de esa misma edad — esto alimenta el gráfico
 * "Peso Promedio — Real vs. Estándar" del dashboard. Se usa la genética
 * más común entre los lotes incluidos para trazar la curva estándar. */
export function serieRealVsEstandar(
  lotes: LotePollo[],
  eventosPorLote: Record<string, EventoLote[]>,
  tabla?: EstandarGeneticoPunto[]
): PuntoPesoSerie[] {
  const conteoGenetica: Record<string, number> = {};
  for (const l of lotes) conteoGenetica[l.genetica] = (conteoGenetica[l.genetica] ?? 0) + 1;
  const geneticaDominante = (Object.entries(conteoGenetica).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "cobb_500") as Genetica;

  const porEdad: Record<number, number[]> = {};
  for (const l of lotes) {
    const eventos = eventosPorLote[l.id] ?? [];
    for (const e of eventos) {
      if (e.tipo !== "pesaje" || e.pesoMuestraGr == null || !(e.tamanoMuestra ?? 0)) continue;
      const edad = e.edadDias ?? edadDelLote(l);
      const promedioGr = num(e.pesoMuestraGr) / (e.tamanoMuestra ?? 1);
      (porEdad[edad] ??= []).push(promedioGr);
    }
  }

  const edadesHito = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28, 33, 35];
  return edadesHito.map((edadDias) => {
    const muestras = porEdad[edadDias];
    const realGr = muestras && muestras.length ? muestras.reduce((s, v) => s + v, 0) / muestras.length : null;
    return { edadDias, estandarGr: pesoEstandarEnEdad(geneticaDominante, edadDias, tabla), realGr };
  });
}

export function causasMortalidad(eventos: EventoLote[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of eventos) {
    if (e.tipo !== "mortalidad") continue;
    out.total = (out.total ?? 0) + (e.mortalidadCantidad ?? 0);
  }
  return out;
}
