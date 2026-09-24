// Cálculos del módulo de Pollo de Engorde — a partir de eventos reales de
// lote (mortalidad, pesaje, alimento), no de un número tipeado a mano.
// Fórmulas estándar de la industria avícola (viabilidad, conversión, IEE)
// para que los indicadores del panel se puedan auditar evento por evento.

export type EventoLote = {
  tipo: "mortalidad" | "pesaje" | "alimento" | "saque" | "beneficio";
  fecha: string;
  edadDias: number | null;
  mortalidadCantidad: number | null;
  pesoMuestraGr: string | number | null;
  alimentoConsumidoKg: string | number | null;
  avesMovidas: number | null;
  kgMovidos: string | number | null;
  clasificacion: string | null;
  observaciones: string | null;
};

export type LotePollo = {
  id: string;
  codigo: string;
  genetica: string;
  fechaAlojamiento: string;
  poblacionInicial: number;
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

export function edadDelLote(lote: LotePollo, hoy = new Date()): number {
  const ref = lote.fechaCierre ? new Date(lote.fechaCierre + "T00:00:00Z") : hoy;
  const inicio = new Date(lote.fechaAlojamiento + "T00:00:00Z");
  return Math.max(0, Math.round((ref.getTime() - inicio.getTime()) / 86_400_000));
}

export function mortalidadAcumulada(eventos: EventoLote[]): number {
  return eventos.filter((e) => e.tipo === "mortalidad").reduce((s, e) => s + (e.mortalidadCantidad ?? 0), 0);
}

export function avesVivas(lote: LotePollo, eventos: EventoLote[]): number {
  return Math.max(0, lote.poblacionInicial - mortalidadAcumulada(eventos));
}

export function pctViabilidad(lote: LotePollo, eventos: EventoLote[]): number {
  if (lote.poblacionInicial === 0) return 0;
  return (avesVivas(lote, eventos) / lote.poblacionInicial) * 100;
}

export function pctMortalidad(lote: LotePollo, eventos: EventoLote[]): number {
  return 100 - pctViabilidad(lote, eventos);
}

/** Último pesaje muestral registrado (kg) — no un promedio de todos los
 * pesajes históricos, porque lo que importa para conversión/IEE es el peso
 * VIGENTE del lote, igual que en el proceso real. */
export function pesoPromedioActualKg(eventos: EventoLote[]): number | null {
  const pesajes = eventos.filter((e) => e.tipo === "pesaje" && e.pesoMuestraGr != null).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = pesajes.at(-1);
  return ultimo ? num(ultimo.pesoMuestraGr) / 1000 : null;
}

export function alimentoAcumuladoKg(eventos: EventoLote[]): number {
  return eventos.filter((e) => e.tipo === "alimento").reduce((s, e) => s + num(e.alimentoConsumidoKg), 0);
}

/** Conversión alimenticia = kg de alimento consumido / kg de peso vivo
 * total ganado por las aves que siguen en el lote. Null si todavía no hay
 * pesaje o alimento suficiente para calcularla (mejor mostrar "—" que un
 * número inventado). */
export function conversionActual(lote: LotePollo, eventos: EventoLote[]): number | null {
  const pesoKg = pesoPromedioActualKg(eventos);
  const vivas = avesVivas(lote, eventos);
  const alimento = alimentoAcumuladoKg(eventos);
  if (!pesoKg || vivas === 0 || alimento === 0) return null;
  const pesoVivoTotalKg = pesoKg * vivas;
  return alimento / pesoVivoTotalKg;
}

/** I.E.E. (Índice de Eficiencia Europeo) = (Viabilidad% × Peso vivo
 * prom. kg × 100) / (Edad días × Conversión) — fórmula estándar de la
 * industria, la misma que se ve en F13/F21. */
export function ieeActual(lote: LotePollo, eventos: EventoLote[], hoy?: Date): number | null {
  const pesoKg = pesoPromedioActualKg(eventos);
  const conversion = conversionActual(lote, eventos);
  const edad = edadDelLote(lote, hoy);
  if (!pesoKg || !conversion || edad === 0) return null;
  const viabilidad = pctViabilidad(lote, eventos);
  return (viabilidad * pesoKg * 100) / (edad * conversion);
}

export function clasificacionBeneficio(lote: LotePollo): { label: string; value: number; color: string }[] {
  return [
    { label: "Pollo A", value: num(lote.pctPolloA), color: "#ef7d1e" },
    { label: "Pollo B", value: num(lote.pctPolloB), color: "#ffbf80" },
    { label: "Merma", value: num(lote.pctMerma), color: "#c23b3b" },
  ].filter((s) => s.value > 0);
}

export function causasMortalidad(eventos: EventoLote[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of eventos) {
    if (e.tipo !== "mortalidad") continue;
    // La causa viaja en el objeto original (mortalidadCausa) — este helper
    // recibe eventos ya proyectados; quien llame debe pasar esa columna si
    // la necesita agregada. Se deja el conteo simple por evento acá.
    out.total = (out.total ?? 0) + (e.mortalidadCantidad ?? 0);
  }
  return out;
}
