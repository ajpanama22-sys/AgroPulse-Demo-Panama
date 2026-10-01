// Arma, del lado del servidor, los datos ya listos para cada vista de un
// modal de línea. Solo lee y agrupa; los valores salen tal cual de la base.
import { type LineaConfig, type Destacado, mesCorto } from "@/lib/lineas-config";
import {
  alertasDeLinea,
  calendario,
  cumplimiento,
  indicadoresPorUbicacion,
  mesesHasta,
  pctVar,
  prevMes,
  sentido,
  serieMensual,
  ubicacionesDeLinea,
  ubicDe,
  valor,
  type Serie,
  type Ubic,
} from "@/lib/lineas-data";

export type KpiData = { titulo: string; valor: number | null; meta: number | null; dec: number; unidad: string; delta: number | null; bueno: "up" | "down"; spark: (number | null)[]; ubic?: string };
export type SerieData = { titulo: string; dec: number; unidad: string; labels: string[]; causado: (number | null)[]; meta: (number | null)[] };
export type AlertaData = { nivel: "alta" | "media"; tipo: string; titulo: string; detalle: string; href?: string };
export type FilaIndicador = { clave: string; etiqueta: string; nota: string | null; unidad: string; causado: number | null; meta: number | null; anterior: number | null; cumpl: number | null; bueno: "up" | "down"; spark: (number | null)[] };
export type GrupoUbic = { id: string; nombre: string; empresa: string; filas: FilaIndicador[]; cumplProm: number | null };

const corto = (nombre: string) => nombre.replace(/^Chiriquí — /, "");

function kpi(d: Destacado, ubics: Ubic[], serie: Serie, mes: string, meses: string[]): KpiData {
  const u = ubicDe(d, ubics);
  const cur = valor(serie, u?.id, d.clave, mes);
  const prev = valor(serie, u?.id, d.clave, prevMes(mes));
  return {
    titulo: d.titulo,
    valor: cur.causado,
    meta: cur.meta,
    dec: d.dec,
    unidad: d.unidad,
    delta: pctVar(cur.causado, prev.causado),
    bueno: d.bueno,
    spark: meses.map((m) => valor(serie, u?.id, d.clave, m).causado),
    ubic: ubics.length > 1 && u ? corto(u.nombre) : undefined,
  };
}

export async function datosLinea(l: LineaConfig, mesPedido?: string) {
  const { hoy, meses: disponibles } = await calendario();
  const mes = mesPedido && disponibles.includes(mesPedido) ? mesPedido : hoy.slice(0, 7);
  const meses = mesesHasta(mes, 12);
  const ubics = await ubicacionesDeLinea(l.slug);
  const ids = ubics.map((u) => u.id);
  const [serie, catalogo, guardadas] = await Promise.all([serieMensual(ids, prevMes(meses[0]), mes), indicadoresPorUbicacion(ids), alertasDeLinea(l.slug, ubics)]);

  const kpis = l.kpis.map((d) => kpi(d, ubics, serie, mes, meses));
  const gauges = l.gauges.map((d) => kpi(d, ubics, serie, mes, meses));
  const tendencias: SerieData[] = l.tendencia.map((d) => {
    const u = ubicDe(d, ubics);
    return {
      titulo: d.titulo,
      dec: d.dec,
      unidad: d.unidad,
      labels: meses.map(mesCorto),
      causado: meses.map((m) => valor(serie, u?.id, d.clave, m).causado),
      meta: meses.map((m) => valor(serie, u?.id, d.clave, m).meta),
    };
  });

  const grupos: GrupoUbic[] = ubics.map((u) => {
    const filas: FilaIndicador[] = (catalogo[u.id] ?? []).map((ind) => {
      const cur = valor(serie, u.id, ind.clave, mes);
      const prev = valor(serie, u.id, ind.clave, prevMes(mes));
      const bueno = sentido(ind.clave);
      return {
        clave: ind.clave,
        etiqueta: ind.etiqueta,
        nota: ind.notaTecnica,
        unidad: ind.unidadMedida,
        causado: cur.causado,
        meta: ind.requiereMeta ? cur.meta : null,
        anterior: prev.causado,
        cumpl: ind.requiereMeta ? cumplimiento(cur, bueno) : null,
        bueno,
        spark: meses.map((m) => valor(serie, u.id, ind.clave, m).causado),
      };
    });
    const c = filas.map((f) => f.cumpl).filter((v): v is number => v != null);
    return { id: u.id, nombre: u.nombre, empresa: u.empresaNombre, filas, cumplProm: c.length ? c.reduce((a, b) => a + b, 0) / c.length : null };
  });

  // Alertas: las registradas por el sistema para esta línea + los
  // indicadores del mes que quedaron por debajo de su meta.
  const alertas: AlertaData[] = guardadas.map((a) => ({ nivel: a.severidad === "alta" ? "alta" : "media", tipo: a.tipo === "inventario_critico" ? "Inventario" : a.tipo === "mortalidad_alta" ? "Sanidad" : "Meta", titulo: a.titulo, detalle: a.detalle }));
  const fuera = grupos
    .flatMap((g) => g.filas.filter((f) => f.cumpl != null && f.cumpl < 95).map((f) => ({ g, f })))
    .sort((a, b) => (a.f.cumpl ?? 0) - (b.f.cumpl ?? 0))
    .slice(0, 6);
  for (const { g, f } of fuera) {
    alertas.push({
      nivel: (f.cumpl ?? 0) < 85 ? "alta" : "media",
      tipo: "Meta del mes",
      titulo: `${f.etiqueta}${grupos.length > 1 ? ` · ${corto(g.nombre)}` : ""}: ${Math.round(f.cumpl ?? 0)} % de la meta`,
      detalle: `Promedio diario ${num(f.causado)} contra meta ${num(f.meta)} ${f.unidad} en el mes.`,
    });
  }

  const cumplBarras = grupos
    .flatMap((g) => g.filas.filter((f) => f.cumpl != null).map((f) => ({ label: grupos.length > 1 ? `${f.etiqueta} · ${corto(g.nombre)}` : f.etiqueta, value: Math.round((f.cumpl ?? 0) * 10) / 10 })))
    .sort((a, b) => a.value - b.value)
    .slice(0, 10);

  return { mes, disponibles, meses, ubics: ubics.map((u) => ({ id: u.id, nombre: u.nombre, empresa: u.empresaNombre })), kpis, gauges, tendencias, grupos, alertas, cumplBarras };
}

const num = (v: number | null) => (v == null ? "N/D" : v.toLocaleString("es-PA", { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 }));

export type DatosLinea = Awaited<ReturnType<typeof datosLinea>>;
