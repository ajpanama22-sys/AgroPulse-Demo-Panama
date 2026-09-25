// Reporte Ejecutivo Consolidado (PDF) — el "board pack" para gerencia:
// EDR consolidado con las 4 unidades de negocio reales (antes solo
// aparecían 3, porque el join empresa→unidad estaba roto — ver
// reportes-data.ts), highlights de Pollo de Engorde con datos reales de
// lote (antes esta unidad no aparecía en ningún reporte ejecutivo), y el
// estado de inventario/alertas. Reemplaza el reporte anterior, que traía
// un período fijo hardcodeado a "2026-07" sin gráficas.
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from "@react-pdf/renderer";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  edrEnRango,
  agregarEdrPorEmpresa,
  periodosEdrDisponibles,
  unidadesPorEmpresa,
  getOrganizacion,
  lotesPolloConUbicacion,
  eventosDeLote,
  resumenLote,
  mortalidadPorCausa,
  inventarioConAlcance,
  alertasActivas,
  CONCEPTO_INGRESOS,
  CONCEPTO_EBITDA,
  CONCEPTO_UTILIDAD_NETA,
  fmtMoney,
  fmtFechaLarga,
} from "@/lib/reportes-data";
import type { LotePollo } from "@/lib/analisis-pollo";
import { unidadColor } from "@/lib/theme";
import { Donut3DPdf, Bars3DPdf, shade } from "@/lib/reportes-pdf-charts";

const ORANGE = "#ef7d1e";
const CHARCOAL = "#3c3c3a";
const CREAM = "#f5f2ec";
const BORDER = "#e4dfd3";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: CHARCOAL, fontFamily: "Helvetica" },
  coverPage: { padding: 0, backgroundColor: CHARCOAL, color: "#fff", fontFamily: "Helvetica" },
  coverInner: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 48 },
  brand: { fontSize: 30, fontFamily: "Helvetica-Bold" },
  brandOrange: { color: ORANGE },
  coverTitle: { fontSize: 22, marginTop: 60, fontFamily: "Helvetica-Bold" },
  coverSubtitle: { fontSize: 12, marginTop: 8, color: "#cfcdc7" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: ORANGE, paddingBottom: 10, marginBottom: 18 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 9, color: "#736f64" },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10, backgroundColor: CREAM },
  kpiLabel: { fontSize: 8, color: "#736f64", textTransform: "uppercase" },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 4, color: CHARCOAL },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 14 },
  chartsRow: { flexDirection: "row", gap: 16, marginTop: 6, alignItems: "flex-start" },
  chartBox: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12 },
  legendRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 7.5, color: "#736f64" },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  trHead: { flexDirection: "row", backgroundColor: CHARCOAL },
  trSubtotal: { flexDirection: "row", backgroundColor: CREAM, borderBottomWidth: 1, borderBottomColor: BORDER },
  th: { flex: 1, padding: 6, fontSize: 8, color: "#fff", fontFamily: "Helvetica-Bold" },
  td: { flex: 1, padding: 6, fontSize: 8.5 },
  tdBold: { flex: 1, padding: 6, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  tdConcepto: { flex: 1.8, padding: 6, fontSize: 8.5 },
  alertRow: { borderWidth: 1, borderColor: "#f4c98b", backgroundColor: "#fdf0e0", borderRadius: 4, padding: 8, marginBottom: 6 },
  alertTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#cf6710" },
  alertDetail: { fontSize: 8.5, color: CHARCOAL, marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#a29c8c", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const disponibles = await periodosEdrDisponibles();
  if (disponibles.length === 0) return new Response("No hay datos de EDR cargados", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde") && disponibles.includes(sp.get("desde")!) ? sp.get("desde")! : disponibles[0];
  const hasta = sp.get("hasta") && disponibles.includes(sp.get("hasta")!) ? sp.get("hasta")! : disponibles[disponibles.length - 1];
  const periodoLabel = desde === hasta ? desde : `${desde} a ${hasta}`;

  const [lineas, unidadesInfo, org, lotesInfo, inventario, alertasList] = await Promise.all([
    edrEnRango(desde, hasta),
    unidadesPorEmpresa(),
    getOrganizacion(),
    lotesPolloConUbicacion(),
    inventarioConAlcance(),
    alertasActivas(),
  ]);

  const porEmpresa = agregarEdrPorEmpresa(lineas);
  const unidadesOrdenadas = Array.from(new Map(Object.values(unidadesInfo).map((u) => [u.unidadId, u])).values()).sort((a, b) => a.orden - b.orden);

  const totalConsolidado = (concepto: string) => Array.from(porEmpresa.values()).reduce((s, m) => s + (m.get(concepto)?.causado ?? 0), 0);
  const ingresosTotal = totalConsolidado(CONCEPTO_INGRESOS);
  const ebitdaTotal = totalConsolidado(CONCEPTO_EBITDA);
  const utilidadNetaTotal = totalConsolidado(CONCEPTO_UTILIDAD_NETA);
  const margenEbitda = ingresosTotal ? ((ebitdaTotal / ingresosTotal) * 100).toFixed(1) : "—";

  const conceptos = Array.from(new Set(lineas.map((l) => l.concepto))).sort((a, b) => (lineas.find((l) => l.concepto === a)?.orden ?? 0) - (lineas.find((l) => l.concepto === b)?.orden ?? 0));
  const esSubtotalPorConcepto: Record<string, boolean> = {};
  for (const l of lineas) esSubtotalPorConcepto[l.concepto] = l.esSubtotal;

  const donutEbitda = unidadesOrdenadas
    .map((u) => ({ label: u.unidadNombre, value: Math.max(porEmpresa.get(u.empresaId)?.get(CONCEPTO_EBITDA)?.causado ?? 0, 0), color: unidadColor[u.unidadSlug] ?? "#999" }))
    .filter((d) => d.value > 0);
  const barsIngresos = unidadesOrdenadas.map((u) => ({ label: u.unidadNombre, value: porEmpresa.get(u.empresaId)?.get(CONCEPTO_INGRESOS)?.causado ?? 0, color: unidadColor[u.unidadSlug] ?? "#999" }));

  // Highlights de Pollo de Engorde — solo lotes activos, con los mismos
  // cálculos que ve el usuario en /pollo y /ejecutivo.
  const hoy = new Date();
  const lotesActivos = lotesInfo.filter((l) => l.lote.estado === "activo");
  const resumenesLotes = await Promise.all(
    lotesActivos.map(async (l) => {
      const eventos = await eventosDeLote(l.lote.id);
      return { codigo: l.lote.codigo, ubicacion: l.ubicacionNombre, resumen: resumenLote(l.lote as unknown as LotePollo, eventos, hoy), eventos };
    }),
  );
  const eventosTodos = resumenesLotes.flatMap((r) => r.eventos);
  const mortalidadCausas = mortalidadPorCausa(eventosTodos);
  const donutMortalidad = mortalidadCausas.map((c, i) => ({ label: c.etiqueta, value: c.cantidad, color: shade(unidadColor.pollo, i % 2 === 0 ? -0.15 * i : 0.15 * i) }));
  const barsViabilidad = resumenesLotes.map((r, i) => ({ label: r.codigo, value: +r.resumen.pctViabilidad.toFixed(1), color: shade(unidadColor.pollo, (i % 3) * -0.15) }));

  const insumosCriticos = inventario.filter((i) => i.critico).sort((a, b) => a.alcanceDias - b.alcanceDias);

  return renderConsolidadoPdf({
    org,
    periodoLabel,
    ingresosTotal,
    ebitdaTotal,
    utilidadNetaTotal,
    margenEbitda,
    conceptos,
    esSubtotalPorConcepto,
    unidadesOrdenadas,
    porEmpresa,
    donutEbitda,
    barsIngresos,
    resumenesLotes,
    donutMortalidad,
    barsViabilidad,
    insumosCriticos,
    alertasList,
  });
}

async function renderConsolidadoPdf(p: {
  org: Awaited<ReturnType<typeof getOrganizacion>>;
  periodoLabel: string;
  ingresosTotal: number;
  ebitdaTotal: number;
  utilidadNetaTotal: number;
  margenEbitda: string;
  conceptos: string[];
  esSubtotalPorConcepto: Record<string, boolean>;
  unidadesOrdenadas: Awaited<ReturnType<typeof unidadesPorEmpresa>>[string][];
  porEmpresa: ReturnType<typeof agregarEdrPorEmpresa>;
  donutEbitda: { label: string; value: number; color: string }[];
  barsIngresos: { label: string; value: number; color: string }[];
  resumenesLotes: { codigo: string; ubicacion: string; resumen: ReturnType<typeof resumenLote> }[];
  donutMortalidad: { label: string; value: number; color: string }[];
  barsViabilidad: { label: string; value: number; color: string }[];
  insumosCriticos: Awaited<ReturnType<typeof inventarioConAlcance>>;
  alertasList: Awaited<ReturnType<typeof alertasActivas>>;
}) {
  const { org, periodoLabel, ingresosTotal, ebitdaTotal, utilidadNetaTotal, margenEbitda, conceptos, esSubtotalPorConcepto, unidadesOrdenadas, porEmpresa, donutEbitda, barsIngresos, resumenesLotes, donutMortalidad, barsViabilidad, insumosCriticos, alertasList } = p;
  const fechaGeneracion = fmtFechaLarga();

  const doc = (
    <Document title={`AgroPulse — Reporte Ejecutivo Consolidado ${periodoLabel}`} author="AgroPulse">
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverInner}>
          <View>
            <Text style={styles.brand}>
              AGRO<Text style={styles.brandOrange}>PULSE</Text>
            </Text>
            <Text style={{ fontSize: 9, marginTop: 4, color: "#cfcdc7" }}>REAL DATA. BETTER DECISIONS.</Text>
          </View>
          <View>
            <Text style={styles.coverTitle}>Reporte Ejecutivo Consolidado</Text>
            <Text style={styles.coverSubtitle}>
              {org?.nombre ?? "Cliente"} — Período {periodoLabel}
            </Text>
            {org?.direccion && <Text style={{ ...styles.coverSubtitle, marginTop: 2 }}>{org.direccion}</Text>}
            {org?.logoUrl && (
              <View style={{ marginTop: 16 }}>
                <Image src={org.logoUrl} style={{ height: 40, objectFit: "contain" }} />
              </View>
            )}
            <Text style={{ ...styles.coverSubtitle, marginTop: 30 }}>Generado el {fechaGeneracion}</Text>
            <Text style={styles.coverSubtitle}>Confidencial — uso interno gerencial</Text>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.h1}>Resumen Ejecutivo</Text>
          <Text style={styles.small}>AgroPulse · {periodoLabel}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ingresos Consolidados</Text>
            <Text style={styles.kpiValue}>{fmtMoney(ingresosTotal)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>EBITDA Consolidado</Text>
            <Text style={styles.kpiValue}>{fmtMoney(ebitdaTotal)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Margen EBITDA</Text>
            <Text style={styles.kpiValue}>{margenEbitda}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Utilidad Neta</Text>
            <Text style={styles.kpiValue}>{fmtMoney(utilidadNetaTotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>EBITDA por unidad de negocio</Text>
        <View style={styles.chartsRow}>
          <View style={styles.chartBox}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Composición · dona 3D</Text>
            <Donut3DPdf data={donutEbitda} />
            <View style={styles.legendRow}>
              {donutEbitda.map((d) => (
                <View key={d.label} style={styles.legendItem}>
                  <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                  <Text style={styles.legendText}>
                    {d.label} {fmtMoney(d.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.chartBox}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Ingresos por unidad · barras 3D</Text>
            <Bars3DPdf data={barsIngresos} width={200} height={140} />
            <View style={styles.legendRow}>
              {barsIngresos.map((d) => (
                <View key={d.label} style={styles.legendItem}>
                  <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                  <Text style={styles.legendText}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Estado de Resultados — Consolidado</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={{ ...styles.th, flex: 1.8 }}>Partida</Text>
            {unidadesOrdenadas.map((u) => (
              <Text key={u.unidadId} style={styles.th}>
                {u.unidadNombre}
              </Text>
            ))}
            <Text style={styles.th}>Consolidado</Text>
          </View>
          {conceptos.map((concepto) => {
            const filaStyle = esSubtotalPorConcepto[concepto] ? styles.trSubtotal : styles.tr;
            const cellStyle = esSubtotalPorConcepto[concepto] ? styles.tdBold : styles.td;
            const valores = unidadesOrdenadas.map((u) => porEmpresa.get(u.empresaId)?.get(concepto)?.causado ?? null);
            const total = valores.reduce((s: number, v) => s + (v ?? 0), 0);
            return (
              <View key={concepto} style={filaStyle}>
                <Text style={styles.tdConcepto}>{concepto}</Text>
                {valores.map((v, i) => (
                  <Text key={i} style={cellStyle}>
                    {v !== null ? fmtMoney(v) : "—"}
                  </Text>
                ))}
                <Text style={cellStyle}>{fmtMoney(total)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text>AgroPulse — {org?.nombre ?? "Cliente"}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.h1}>Pollo de Engorde — Lotes Activos</Text>
          <Text style={styles.small}>AgroPulse · {periodoLabel}</Text>
        </View>

        {resumenesLotes.length === 0 ? (
          <Text style={styles.small}>No hay lotes de Pollo de Engorde activos al momento de generar el reporte.</Text>
        ) : (
          <>
            <View style={styles.chartsRow}>
              <View style={styles.chartBox}>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Mortalidad por causa · dona 3D</Text>
                {donutMortalidad.length > 0 ? (
                  <Donut3DPdf data={donutMortalidad} />
                ) : (
                  <Text style={{ ...styles.small, marginTop: 30 }}>Sin eventos de mortalidad registrados.</Text>
                )}
                <View style={styles.legendRow}>
                  {donutMortalidad.map((d) => (
                    <View key={d.label} style={styles.legendItem}>
                      <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                      <Text style={styles.legendText}>
                        {d.label} ({d.value})
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.chartBox}>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>% Viabilidad por lote · barras 3D</Text>
                <Bars3DPdf data={barsViabilidad} width={200} height={140} />
                <View style={styles.legendRow}>
                  {barsViabilidad.map((d) => (
                    <View key={d.label} style={styles.legendItem}>
                      <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                      <Text style={styles.legendText}>
                        {d.label} ({d.value}%)
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Detalle por lote</Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={{ ...styles.th, flex: 1.4 }}>Lote</Text>
                <Text style={styles.th}>Edad (d)</Text>
                <Text style={styles.th}>Aves Vivas</Text>
                <Text style={styles.th}>% Viab.</Text>
                <Text style={styles.th}>Peso (kg)</Text>
                <Text style={styles.th}>Conversión</Text>
                <Text style={styles.th}>I.E.E.</Text>
              </View>
              {resumenesLotes.map((r) => (
                <View key={r.codigo} style={styles.tr}>
                  <Text style={{ ...styles.td, flex: 1.4 }}>
                    {r.codigo} ({r.ubicacion})
                  </Text>
                  <Text style={styles.td}>{r.resumen.edadDias}</Text>
                  <Text style={styles.td}>{r.resumen.avesVivas.toLocaleString("es-PA")}</Text>
                  <Text style={styles.td}>{r.resumen.pctViabilidad.toFixed(1)}%</Text>
                  <Text style={styles.td}>{r.resumen.pesoPromedioKg !== null ? r.resumen.pesoPromedioKg.toFixed(2) : "—"}</Text>
                  <Text style={styles.td}>{r.resumen.conversion !== null ? r.resumen.conversion.toFixed(2) : "—"}</Text>
                  <Text style={styles.td}>{r.resumen.iee !== null ? r.resumen.iee.toFixed(1) : "—"}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Inventario Crítico</Text>
        {insumosCriticos.length === 0 ? (
          <Text style={styles.small}>Ningún insumo por debajo del mínimo de días de alcance.</Text>
        ) : (
          insumosCriticos.map((i) => (
            <View key={i.insumo} style={styles.alertRow}>
              <Text style={styles.alertTitle}>{i.insumo}</Text>
              <Text style={styles.alertDetail}>
                Alcance {i.alcanceDias} días (mínimo {i.minimoDias}) — inventario actual {i.inventarioActual} {i.unidadMedida}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Alertas Activas</Text>
        {alertasList.length === 0 && <Text style={styles.small}>Sin alertas activas al momento de generar el reporte.</Text>}
        {alertasList.map((a) => (
          <View key={a.id} style={styles.alertRow}>
            <Text style={styles.alertTitle}>{a.titulo}</Text>
            <Text style={styles.alertDetail}>{a.detalle}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>AgroPulse — {org?.nombre ?? "Cliente"}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AgroPulse-Reporte-Ejecutivo-${periodoLabel.replace(/\s/g, "")}.pdf"`,
    },
  });
}
