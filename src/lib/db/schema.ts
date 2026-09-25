import { pgTable, text, uuid, timestamp, boolean, integer, numeric, jsonb, date, pgEnum, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";

// AgroPulse se despliega on-premise/por-cliente (una instancia = una
// empresa) — esta fila única de configuración es lo que la "matricula" en
// el sistema: nombre, dirección y logo van al encabezado de cada reporte
// PDF/Excel en vez de quedar harcodeados a un cliente. No es una tabla
// multi-tenant (para eso está la jerarquía unidadNegocio -> empresa de
// abajo, pensada para escalar a MÁS empresas DENTRO de un mismo cliente).
export const organizacion = pgTable("organizacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  logoUrl: text("logo_url"),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});

// AgroPulse es de un solo cliente (Agroindustrias del Istmo) pero se modela con las
// mismas jerarquías que ZiMPLIFIKA/FLOTIA (unidad de negocio -> empresa ->
// ubicación) para que escalar a un segundo grupo agroindustrial en el
// futuro no requiera rediseñar el esquema, solo agregar filas.

export const rolUsuario = pgEnum("rol_usuario", ["admin", "gerencial", "coordinacion", "supervisor", "campo"]);
export const tipoUbicacion = pgEnum("tipo_ubicacion", ["granja", "galpon", "corral", "planta"]);
export const tipoValorIndicador = pgEnum("tipo_valor_indicador", ["numero", "porcentaje", "moneda", "peso_kg", "peso_gr"]);
export const origenCaptura = pgEnum("origen_captura", ["qr", "manual"]);
export const tipoEvidencia = pgEnum("tipo_evidencia", ["foto", "documento"]);

export const estadoDatosGranja = pgEnum("estado_datos_granja", ["completo", "por_completar"]);

export const unidadesNegocio = pgTable("unidades_negocio", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // huevos | pollo | cerdo | aba
  nombre: text("nombre").notNull(),
  colorHex: text("color_hex").notNull(),
  icono: text("icono").notNull(),
  orden: integer("orden").notNull().default(0),
});

export const empresas = pgTable("empresas", {
  id: uuid("id").primaryKey().defaultRandom(),
  unidadNegocioId: uuid("unidad_negocio_id").notNull().references(() => unidadesNegocio.id),
  nombre: text("nombre").notNull(), // p.ej. "AGROPECUARIA EL DORADO"
});

// El Dorado (Pollo de Engorde) agrega una jerarquia Granja -> Galpon que
// las demas lineas no necesitan: `padreId` es la auto-referencia de un
// galpon hacia su granja (null en toda ubicacion que no sea galpon).
// `supervisorNombre`/`personalAsociado`/`estadoDatos` solo aplican a
// ubicaciones tipo 'granja' (13 granjas precargadas por El Dorado).
export const ubicaciones = pgTable("ubicaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  empresaId: uuid("empresa_id").notNull().references(() => empresas.id),
  padreId: uuid("padre_id"),
  nombre: text("nombre").notNull(), // p.ej. "Cojedes", "Táchira", "Reproductoras"
  tipo: tipoUbicacion("tipo").notNull(),
  subUnidad: text("sub_unidad"), // p.ej. "REPRODUCTORAS" dentro de Pollo
  qrToken: text("qr_token").notNull().unique(),
  activa: boolean("activa").notNull().default(true),
  supervisorNombre: text("supervisor_nombre"),
  personalAsociado: integer("personal_asociado"),
  estadoDatos: estadoDatosGranja("estado_datos"),
}, (t) => [
  foreignKey({ columns: [t.padreId], foreignColumns: [t.id], name: "ubicaciones_padre_fk" }),
]);

// Operario de campo <-> galpones asignados (muchos a muchos). El resto de
// las lineas de negocio siguen usando `usuarios.ubicacionId` (una sola
// ubicacion); el galponero de El Dorado puede tener varios galpones en
// distintas granjas (ver mockup "Mis Granjas").
export const asignacionesCampo = pgTable("asignaciones_campo", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  ubicacionId: uuid("ubicacion_id").notNull().references(() => ubicaciones.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("asignaciones_campo_uq").on(t.usuarioId, t.ubicacionId)]);

// Catálogo de indicadores por unidad de negocio — un registro de captura
// guarda sus valores como JSON contra este catálogo, así agregar un
// indicador nuevo (o ajustar la ficha educativa) no requiere migración.
export const indicadores = pgTable("indicadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  unidadNegocioId: uuid("unidad_negocio_id").notNull().references(() => unidadesNegocio.id),
  clave: text("clave").notNull(), // p.ej. "produccion_cajas"
  etiqueta: text("etiqueta").notNull(), // p.ej. "Producción (Cajas)"
  unidadMedida: text("unidad_medida").notNull(), // "cajas", "%", "grs/ave", "aves"
  tipoValor: tipoValorIndicador("tipo_valor").notNull(),
  orden: integer("orden").notNull().default(0),
  requiereMeta: boolean("requiere_meta").notNull().default(true),
  notaTecnica: text("nota_tecnica"), // gancho educativo — ficha/instructivo al capturar
}, (t) => [uniqueIndex("indicadores_unidad_clave_uq").on(t.unidadNegocioId, t.clave)]);

// Qué indicadores aplican a cada ubicación puntual, y en qué orden — el
// set real difiere hasta entre dos granjas de la MISMA unidad (p.ej.
// Cerdo/Táchira, una granja más joven, no reporta todavía indicadores de
// beneficio/engorde que sí reporta Cerdo/Guárico), así que no alcanza con
// asignar indicadores a nivel de unidad de negocio.
export const ubicacionIndicadores = pgTable("ubicacion_indicadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  ubicacionId: uuid("ubicacion_id").notNull().references(() => ubicaciones.id),
  indicadorId: uuid("indicador_id").notNull().references(() => indicadores.id),
  orden: integer("orden").notNull().default(0),
}, (t) => [uniqueIndex("ubicacion_indicadores_uq").on(t.ubicacionId, t.indicadorId)]);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolUsuario("rol").notNull().default("campo"),
  empresaId: uuid("empresa_id").references(() => empresas.id), // null = ve todas (gerencial/admin)
  ubicacionId: uuid("ubicacion_id").references(() => ubicaciones.id), // campo, atado a su ubicación
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// Registro de captura diaria — un formulario completo (todos los
// indicadores de esa ubicación para ese día) queda en un solo `valores`
// jsonb: { [claveIndicador]: { meta?: number, causado: number } }.
export const capturas = pgTable("capturas", {
  id: uuid("id").primaryKey().defaultRandom(),
  ubicacionId: uuid("ubicacion_id").notNull().references(() => ubicaciones.id),
  fecha: date("fecha").notNull(),
  capturadoPorId: uuid("capturado_por_id").references(() => usuarios.id),
  origen: origenCaptura("origen").notNull().default("manual"),
  valores: jsonb("valores").$type<Record<string, { meta?: number; causado: number }>>().notNull(),
  observaciones: text("observaciones"),
  creadoEnDispositivo: timestamp("creado_en_dispositivo").notNull(), // hora local del capturador (para medir latencia de sync)
  sincronizadoEn: timestamp("sincronizado_en").notNull().defaultNow(),
}, (t) => [uniqueIndex("capturas_ubicacion_fecha_uq").on(t.ubicacionId, t.fecha)]);

export const capturaEvidencias = pgTable("captura_evidencias", {
  id: uuid("id").primaryKey().defaultRandom(),
  capturaId: uuid("captura_id").notNull().references(() => capturas.id, { onDelete: "cascade" }),
  tipo: tipoEvidencia("tipo").notNull().default("foto"),
  url: text("url").notNull(), // Vercel Blob
  nombreArchivo: text("nombre_archivo").notNull(),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

export const insumos = pgTable("insumos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(), // Maíz, Soya, Aceite...
  unidadMedida: text("unidad_medida").notNull().default("Tn"),
  minimoDias: integer("minimo_dias").notNull().default(7),
});

// Lectura histórica de inventario — permite graficar la tendencia y
// calcular "alcance en días" = inventarioActual / consumoDiarioPromedio.
export const lecturasInsumo = pgTable("lecturas_insumo", {
  id: uuid("id").primaryKey().defaultRandom(),
  insumoId: uuid("insumo_id").notNull().references(() => insumos.id),
  fecha: date("fecha").notNull(),
  inventarioActual: numeric("inventario_actual").notNull(),
  consumoDiarioPromedio: numeric("consumo_diario_promedio").notNull(),
}, (t) => [uniqueIndex("lecturas_insumo_insumo_fecha_uq").on(t.insumoId, t.fecha)]);

// Estado de Resultados — una fila por concepto, por empresa, por periodo.
// El TOTAL CONSOLIDADO de la hoja EDR original se recalcula sumando estas
// filas (no se guarda aparte), así nunca puede desincronizarse.
export const edrLineas = pgTable("edr_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  empresaId: uuid("empresa_id").notNull().references(() => empresas.id),
  periodo: text("periodo").notNull(), // "2026-08"
  concepto: text("concepto").notNull(), // "(=) Utilidad Bruta", "(-) Gastos Operativos", etc.
  orden: integer("orden").notNull(),
  esSubtotal: boolean("es_subtotal").notNull().default(false),
  meta: numeric("meta").notNull(),
  causado: numeric("causado").notNull(),
}, (t) => [uniqueIndex("edr_lineas_empresa_periodo_concepto_uq").on(t.empresaId, t.periodo, t.concepto)]);

export const generaPollo = pgEnum("genetica_pollo", ["cobb_500", "hubbard", "ross"]);
export const estadoLote = pgEnum("estado_lote", ["activo", "cerrado"]);
export const tipoEventoLote = pgEnum("tipo_evento_lote", ["mortalidad", "descarte", "pesaje", "alimento", "saque", "beneficio"]);
export const causaMortalidad = pgEnum("causa_mortalidad", ["ascitis", "problema_patas", "respiratorio", "picaje", "descarte", "otra"]);

// Lote de Pollo de Engorde — la unidad real de trazabilidad del proceso
// (RF03): un galpón aloja un lote a la vez, con población y genética
// propias; todo lo que pasa durante el ciclo (mortalidad, pesajes,
// alimento, saques, beneficio) se registra como un evento contra ESTE
// lote, no como una celda suelta del día. El cierre congela los
// indicadores finales (conversión, IEE) para que no se recalculen distinto
// cada vez que se mira el histórico.
export const lotesPollo = pgTable("lotes_pollo", {
  id: uuid("id").primaryKey().defaultRandom(),
  ubicacionId: uuid("ubicacion_id").notNull().references(() => ubicaciones.id), // galpón
  codigo: text("codigo").notNull(), // p.ej. "G1-2026-08"
  genetica: generaPollo("genetica").notNull().default("cobb_500"),
  fechaAlojamiento: date("fecha_alojamiento").notNull(),
  poblacionInicial: integer("poblacion_inicial").notNull(),
  pesoInicialGr: numeric("peso_inicial_gr"),
  estado: estadoLote("estado").notNull().default("activo"),
  fechaCierre: date("fecha_cierre"),
  // Congelados al cierre — null mientras el lote está activo.
  avesBeneficio: integer("aves_beneficio"),
  kgBeneficiados: numeric("kg_beneficiados"),
  pctPolloA: numeric("pct_pollo_a"),
  pctPolloB: numeric("pct_pollo_b"),
  pctMerma: numeric("pct_merma"),
  conversion: numeric("conversion"), // kg alimento consumido / kg peso vivo ganado
  iee: numeric("iee"), // Índice de Eficiencia Europeo
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
}, (t) => [uniqueIndex("lotes_pollo_ubicacion_codigo_uq").on(t.ubicacionId, t.codigo)]);

// Evento diario de un lote — una fila por hecho (no un JSON de "el día"),
// así la mortalidad acumulada, el alimento acumulado y el peso muestral
// se pueden sumar/promediar sin ambigüedad y quedan trazables uno por uno
// (quién, cuándo, con qué causa) para la auditoría del cierre.
export const loteEventosPollo = pgTable("lote_eventos_pollo", {
  id: uuid("id").primaryKey().defaultRandom(),
  loteId: uuid("lote_id").notNull().references(() => lotesPollo.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  tipo: tipoEventoLote("tipo").notNull(),
  edadDias: integer("edad_dias"),
  // mortalidad
  mortalidadCantidad: integer("mortalidad_cantidad"),
  mortalidadCausa: causaMortalidad("mortalidad_causa"),
  // descarte — evento propio, separado de mortalidad (ver analisis-pollo.ts)
  descarteCantidad: integer("descarte_cantidad"),
  descarteMotivo: text("descarte_motivo"),
  // pesaje muestral
  pesoMuestraGr: numeric("peso_muestra_gr"),
  tamanoMuestra: integer("tamano_muestra"),
  // alimento
  alimentoConsumidoKg: numeric("alimento_consumido_kg"),
  // saque (venta en pie parcial) / beneficio (cierre de planta)
  avesMovidas: integer("aves_movidas"),
  kgMovidos: numeric("kg_movidos"),
  clasificacion: text("clasificacion"), // "A" | "B" | "merma" — solo aplica a eventos de beneficio
  observaciones: text("observaciones"),
  capturadoPorId: uuid("capturado_por_id").references(() => usuarios.id),
  origen: origenCaptura("origen").notNull().default("manual"),
  creadoEnDispositivo: timestamp("creado_en_dispositivo").notNull(),
  sincronizadoEn: timestamp("sincronizado_en").notNull().defaultNow(),
});

// Bitácora de auditoría — quién hizo qué, cuándo. Se lee en el panel de
// administración (solo admin/gerencial) y sirve como evidencia ante el
// cliente de que el sistema es trazable, no una hoja de cálculo compartida.
export const auditoria = pgTable("auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => usuarios.id),
  actorNombre: text("actor_nombre").notNull(),
  accion: text("accion").notNull(), // "captura.crear" | "usuario.crear" | "usuario.desactivar" | "alerta.resolver" | ...
  entidad: text("entidad").notNull(), // "captura" | "usuario" | "alerta" | ...
  entidadId: text("entidad_id"),
  detalle: text("detalle"),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// Alertas WOW-style detectadas por el motor de escaneo (alcance de
// inventario crítico, mortalidad fuera de rango, etc.) — igual patrón que
// TRULINK WOW: se guardan al detectarse, se leen para el banner del panel.
export const alertas = pgTable("alertas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(), // "inventario_critico" | "mortalidad_alta" | "meta_incumplida"
  severidad: text("severidad").notNull().default("alta"), // alta | media
  titulo: text("titulo").notNull(),
  detalle: text("detalle").notNull(),
  entidadRef: text("entidad_ref"), // id de insumo/ubicacion relacionado, para deep-link
  resuelta: boolean("resuelta").notNull().default(false),
  creadaEn: timestamp("creada_en").notNull().defaultNow(),
});


// Estandar Genetico — curva de peso objetivo por raza y edad (dias).
// Cobb 500 y Ross 308 comparten la misma curva en la operacion de El
// Dorado (confirmado por el cliente); Hubbard 1,2 se carga por separado.
// Ver src/lib/analisis-pollo.ts para las curvas base y su fuente.
export const estandarGenetico = pgTable("estandar_genetico", {
  id: uuid("id").primaryKey().defaultRandom(),
  genetica: generaPollo("genetica").notNull(),
  edadDias: integer("edad_dias").notNull(),
  pesoEstandarGr: numeric("peso_estandar_gr").notNull(),
  fuente: text("fuente"),
}, (t) => [uniqueIndex("estandar_genetico_genetica_edad_uq").on(t.genetica, t.edadDias)]);

export const estadoConciliacion = pgEnum("estado_conciliacion", ["pendiente", "aprobado", "bloqueado"]);

// Conciliacion con Planta Beneficiadora — cierre de lote (reportado por la
// granja) contra el reporte de la planta, con tolerancia y bloqueo
// automatico fuera de rango (historias de usuario de Coordinacion Central).
export const conciliacionesPlanta = pgTable("conciliaciones_planta", {
  id: uuid("id").primaryKey().defaultRandom(),
  loteId: uuid("lote_id").notNull().references(() => lotesPollo.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  avesReportadasGranja: integer("aves_reportadas_granja").notNull(),
  kgReportadosGranja: numeric("kg_reportados_granja").notNull(),
  avesReportadasPlanta: integer("aves_reportadas_planta").notNull(),
  kgReportadosPlanta: numeric("kg_reportados_planta").notNull(),
  umbralTolerancia: numeric("umbral_tolerancia").notNull().default("0.02"),
  desviacionAvesPct: numeric("desviacion_aves_pct").notNull(),
  desviacionPesoPct: numeric("desviacion_peso_pct").notNull(),
  estado: estadoConciliacion("estado").notNull().default("pendiente"),
  aprobadoPorId: uuid("aprobado_por_id").references(() => usuarios.id),
  aprobadoEn: timestamp("aprobado_en"),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// Evidencia fotografica ligada a UN evento de lote (mortalidad, descarte o
// pesaje) — distinta de `capturaEvidencias`, que sirve al modulo generico
// de capturas de las otras lineas de negocio.
export const evidenciasPollo = pgTable("evidencias_pollo", {
  id: uuid("id").primaryKey().defaultRandom(),
  loteEventoId: uuid("lote_evento_id").notNull().references(() => loteEventosPollo.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  nombreArchivo: text("nombre_archivo").notNull(),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});
