// Los cuatro modales de AgroPulse — uno por línea de negocio — con la misma
// estructura de vistas que los modales de PharmaLab AI. Este archivo es solo
// presentación (etiquetas, colores, qué indicadores se destacan); los datos
// siguen viniendo de las mismas tablas de siempre.

export type LineaSlug = "huevos" | "pollo" | "cerdo" | "aba";
export type Bueno = "up" | "down";

export type Destacado = {
  clave: string;
  titulo: string;
  bueno: Bueno;
  dec: number;
  unidad: string;
  /** Ubicación de donde sale el indicador cuando la línea tiene varias (fragmento del nombre). */
  ubicacion?: string;
};

export type LineaConfig = {
  slug: LineaSlug;
  numero: string;
  nombre: string;
  titulo: string;
  icono: "huevo" | "pollo" | "cerdo" | "aba";
  navIcon: string;
  color: string;
  descripcion: string;
  bullets: string[];
  detalle: string;
  /** Indicadores de la fila de KPIs (máx. 4) */
  kpis: Destacado[];
  /** Indicadores de los medidores del Pulse (3) */
  gauges: Destacado[];
  /** Indicadores de la tendencia de 12 meses (1 o 2) */
  tendencia: Destacado[];
  tieneFinanzas: boolean;
};

export const LINEAS: LineaConfig[] = [
  {
    slug: "huevos",
    numero: "01",
    nombre: "Huevos",
    titulo: "Estadísticas de Huevos",
    icono: "huevo",
    navIcon: "egg",
    color: "#ef7d1e",
    descripcion: "Postura, cajas producidas, mortalidad y consumo de alimento de las ponedoras de Coclé.",
    bullets: ["Pulse de postura con alertas", "Indicadores con su ficha técnica", "Estado de Resultados de la línea"],
    detalle: "Indicadores de postura",
    kpis: [
      { clave: "produccion_cajas", titulo: "Producción diaria", bueno: "up", dec: 0, unidad: "cj" },
      { clave: "pct_produccion", titulo: "% de postura", bueno: "up", dec: 1, unidad: "%" },
      { clave: "pct_mortalidad", titulo: "% mortalidad diaria", bueno: "down", dec: 2, unidad: "%" },
      { clave: "grs_ave", titulo: "Consumo por ave", bueno: "up", dec: 0, unidad: "g" },
    ],
    gauges: [
      { clave: "pct_produccion", titulo: "% de postura", bueno: "up", dec: 1, unidad: "%" },
      { clave: "produccion_cajas", titulo: "Cajas por día", bueno: "up", dec: 0, unidad: "cj" },
      { clave: "pct_mortalidad", titulo: "% mortalidad diaria", bueno: "down", dec: 2, unidad: "%" },
    ],
    tendencia: [
      { clave: "produccion_cajas", titulo: "Cajas por día", bueno: "up", dec: 0, unidad: "cj" },
      { clave: "pct_produccion", titulo: "% de postura", bueno: "up", dec: 1, unidad: "%" },
    ],
    tieneFinanzas: true,
  },
  {
    slug: "pollo",
    numero: "02",
    nombre: "Pollo",
    titulo: "Estadísticas de Pollo",
    icono: "pollo",
    navIcon: "bird",
    color: "#2f7fd0",
    descripcion: "Engorde, incubadora y reproductoras de Chiriquí: mortalidad, conversión, peso e IEE.",
    bullets: ["Pulse de engorde con alertas", "Lotes, curva genética y conciliación", "Estado de Resultados de la línea"],
    detalle: "Pollo de Engorde",
    kpis: [
      { clave: "mortalidad", titulo: "Mortalidad engorde", bueno: "down", dec: 1, unidad: "%", ubicacion: "Engorde" },
      { clave: "conversion", titulo: "Conversión alimenticia", bueno: "down", dec: 2, unidad: "kg/kg", ubicacion: "Engorde" },
      { clave: "peso_promedio", titulo: "Peso promedio", bueno: "up", dec: 2, unidad: "kg", ubicacion: "Engorde" },
      { clave: "pct_nacimiento", titulo: "% de nacimiento", bueno: "up", dec: 1, unidad: "%", ubicacion: "Incubadora" },
    ],
    gauges: [
      { clave: "iee", titulo: "Índice de Eficiencia Europeo", bueno: "up", dec: 0, unidad: "pts", ubicacion: "Engorde" },
      { clave: "conversion", titulo: "Conversión alimenticia", bueno: "down", dec: 2, unidad: "kg/kg", ubicacion: "Engorde" },
      { clave: "mortalidad", titulo: "Mortalidad engorde", bueno: "down", dec: 1, unidad: "%", ubicacion: "Engorde" },
    ],
    tendencia: [
      { clave: "peso_promedio", titulo: "Peso promedio", bueno: "up", dec: 2, unidad: "kg", ubicacion: "Engorde" },
      { clave: "iee", titulo: "IEE", bueno: "up", dec: 0, unidad: "pts", ubicacion: "Engorde" },
    ],
    tieneFinanzas: true,
  },
  {
    slug: "cerdo",
    numero: "03",
    nombre: "Cerdo",
    titulo: "Estadísticas de Cerdo",
    icono: "cerdo",
    navIcon: "pig",
    color: "#b0547c",
    descripcion: "Granjas de Azuero y Veraguas: partos, nacidos vivos, mortalidad por fase, conversión y canal.",
    bullets: ["Pulse de granjas con alertas", "Indicadores por granja", "Estado de Resultados de la línea"],
    detalle: "Indicadores por granja",
    kpis: [
      { clave: "promedio_nacidos_vivos", titulo: "Nacidos vivos por parto", bueno: "up", dec: 1, unidad: "lech.", ubicacion: "Azuero" },
      { clave: "mortalidad_lactancia", titulo: "Mortalidad en lactancia", bueno: "down", dec: 1, unidad: "%", ubicacion: "Azuero" },
      { clave: "conversion_engorde", titulo: "Conversión engorde", bueno: "down", dec: 2, unidad: "kg/kg", ubicacion: "Azuero" },
      { clave: "rendimiento_canal", titulo: "Rendimiento en canal", bueno: "up", dec: 1, unidad: "%", ubicacion: "Azuero" },
    ],
    gauges: [
      { clave: "peso_engorde", titulo: "Peso de salida engorde", bueno: "up", dec: 1, unidad: "kg", ubicacion: "Azuero" },
      { clave: "conversion_engorde", titulo: "Conversión engorde", bueno: "down", dec: 2, unidad: "kg/kg", ubicacion: "Azuero" },
      { clave: "mortalidad_lactancia", titulo: "Mortalidad en lactancia", bueno: "down", dec: 1, unidad: "%", ubicacion: "Azuero" },
    ],
    tendencia: [
      { clave: "peso_engorde", titulo: "Peso engorde", bueno: "up", dec: 1, unidad: "kg", ubicacion: "Azuero" },
      { clave: "promedio_nacidos_vivos", titulo: "Nacidos vivos", bueno: "up", dec: 1, unidad: "lech.", ubicacion: "Azuero" },
    ],
    tieneFinanzas: true,
  },
  {
    slug: "aba",
    numero: "04",
    nombre: "Planta ABA",
    titulo: "Estadísticas de Planta ABA",
    icono: "aba",
    navIcon: "factory",
    color: "#5f9a7a",
    descripcion: "Alimento balanceado de La Chorrera: toneladas por fórmula, consumo interno, maquila e insumos.",
    bullets: ["Pulse de planta con alertas", "Inventario de maíz, soya y aceite", "Producción por fórmula"],
    detalle: "Inventario de insumos",
    kpis: [
      { clave: "produccion_total", titulo: "Producción total", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "produccion_consumo_interno", titulo: "Consumo interno", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "produccion_maquila_terceros", titulo: "Maquila a terceros", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "pollo_engorde", titulo: "Fórmula pollo engorde", bueno: "up", dec: 0, unidad: "Tm" },
    ],
    gauges: [
      { clave: "produccion_total", titulo: "Producción total", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "produccion_consumo_interno", titulo: "Consumo interno", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "produccion_maquila_terceros", titulo: "Maquila a terceros", bueno: "up", dec: 0, unidad: "Tm" },
    ],
    tendencia: [
      { clave: "produccion_total", titulo: "Producción total", bueno: "up", dec: 0, unidad: "Tm" },
      { clave: "produccion_maquila_terceros", titulo: "Maquila a terceros", bueno: "up", dec: 0, unidad: "Tm" },
    ],
    tieneFinanzas: false,
  },
];

export const lineaPorSlug = (slug: string) => LINEAS.find((l) => l.slug === slug);

export type Vista = { id: string; label: string; icon: string };

export function vistasDe(l: LineaConfig): Vista[] {
  const v: Vista[] = [
    { id: "", label: "Tablero de la línea", icon: "grid" },
    { id: "pulse", label: "Pulse de la línea", icon: "pulse" },
    { id: "detalle", label: l.detalle, icon: l.slug === "aba" ? "box" : l.slug === "pollo" ? "bird" : "chart" },
  ];
  if (l.tieneFinanzas) v.push({ id: "finanzas", label: "Finanzas de la línea", icon: "coin" });
  v.push({ id: "reportes", label: "Reportes", icon: "report" });
  return v;
}

/** Qué líneas puede abrir cada rol. "gerencial" y "campo" viven en sus PWA (middleware). */
export function lineasPermitidas(rol: string, unidadSlug: string | null): LineaSlug[] {
  if (rol === "admin") return LINEAS.map((l) => l.slug);
  if (unidadSlug && LINEAS.some((l) => l.slug === unidadSlug)) return [unidadSlug as LineaSlug];
  return LINEAS.map((l) => l.slug);
}

export const fmtNum = (v: number | null | undefined, dec = 0) =>
  v == null || Number.isNaN(v) ? "N/D" : v.toLocaleString("es-PA", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtUsd = (v: number | null | undefined, compact = false) => {
  if (v == null || Number.isNaN(v)) return "N/D";
  if (compact && Math.abs(v) >= 1e6) return `US$ ${(v / 1e6).toLocaleString("es-PA", { maximumFractionDigits: 2 })} M`;
  if (compact && Math.abs(v) >= 1e4) return `US$ ${(v / 1e3).toLocaleString("es-PA", { maximumFractionDigits: 1 })} mil`;
  return `US$ ${v.toLocaleString("es-PA", { maximumFractionDigits: 0 })}`;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const mesCorto = (m: string) => {
  const [y, mm] = m.split("-");
  return `${MESES[Number(mm) - 1]} ${y.slice(2)}`;
};
export const mesLargo = (m: string) => {
  const [y, mm] = m.split("-");
  const n = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][Number(mm) - 1];
  return `${n} ${y}`;
};
export const fmtValor = (d: { dec: number; unidad: string }, v: number | null | undefined) =>
  v == null ? "N/D" : d.unidad === "%" ? `${fmtNum(v, d.dec)} %` : `${fmtNum(v, d.dec)} ${d.unidad}`;
