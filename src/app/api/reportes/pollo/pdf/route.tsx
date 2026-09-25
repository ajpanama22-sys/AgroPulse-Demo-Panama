// Reporte Ejecutivo de Pollo de Engorde (PDF) — hasta ahora esta unidad no
// tenía ningún reporte propio para gerencia, solo se veía en pantalla en
// /pollo y /ejecutivo. Trae dona 3D de mortalidad por causa y barras 3D
// comparando aves vivas/viabilidad entre lotes, más el detalle numérico
// completo por lote (incluye los campos congelados al cierre para lotes
// ya beneficiados).
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOrganizacion, lotesPolloConUbicacion, eventosDeLote, resumenLote, mortalidadPorCausa, fmtFechaLarga } from "@/lib/reportes-data";
import type { LotePollo } from "@/lib/analisis-pollo";
import { unidadColor } from "@/lib/theme";
import { Donut3DPdf, Bars3DPdf, shade } from "@/lib/reportes-pdf-charts";

const ORANGE = "#ef7d1e";
const CHARCOAL = "#3c3c3a";
const CREAM = "#f5f2ec";
const BORDER = "#e4dfd3";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: CHARCOAL, fontFamily: "Helvetica" },
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
  th: { flex: 1, padding: 6, fontSize: 7.5, color: "#fff", fontFamily: "Helvetica-Bold" },
  td: { flex: 1, padding: 6, fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#a29c8c", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const loteIdFiltro = sp.get("loteId");
  const hoy = new Date();

  const [lotesInfo, org] = await Promise.all([lotesPolloConUbicacion(), getOrganizacion()]);
  const lotes = loteIdFiltro ? lotesInfo.filter((l) => l.lote.id === loteIdFiltro) : lotesInfo;
  if (lotes.length === 0) return new Response("No hay lotes de Pollo de Engorde cargados", { status: 404 });

  const resumenes = await Promise.all(
    lotes.map(async (l) => {
      const eventos = await eventosDeLote(l.lote.id);
      return { lote: l.lote as unknown as LotePollo, ubicacion: l.ubicacionNombre, resumen: resumenLote(l.lote as unknown as LotePollo, eventos, hoy), eventos };
    }),
  );
  const eventosTodos = resumenes.flatMap((r) => r.eventos);
  const causas = mortalidadPorCausa(eventosTodos);
  const donutMortalidad = causas.map((c, i) => ({ label: c.etiqueta, value: c.cantidad, color: shade(unidadColor.pollo, i % 2 === 0 ? -0.15 * i : 0.15 * i) }));
  const barsAvesVivas = resumenes.map((r, i) => ({ label: r.lote.codigo, value: r.resumen.avesVivas, color: shade(unidadColor.pollo, (i % 3) * -0.15) }));

  const activos = resumenes.filter((r) => r.lote.estado === "activo");
  const totalAvesVivas = activos.reduce((s, r) => s + r.resumen.avesVivas, 0);
  const conConversion = activos.filter((r) => r.resumen.conversion !== null);
  const conversionProm = conConversion.length ? conConversion.reduce((s, r) => s + (r.resumen.conversion ?? 0), 0) / conConversion.length : null;
  const conIee = activos.filter((r) => r.resumen.iee !== null);
  const ieeProm = conIee.length ? conIee.reduce((s, r) => s + (r.resumen.iee ?? 0), 0) / conIee.length : null;
  const viabilidadProm = activos.length ? activos.reduce((s, r) => s + r.resumen.pctViabilidad, 0) / activos.length : null;

  const tituloRango = loteIdFiltro ? `Lote ${resumenes[0]?.lote.codigo}` : "Todos los lotes";
  const fechaGeneracion = fmtFechaLarga();

  const doc = (
    <Document title={`AgroPulse — Reporte Ejecutivo de Pollo de Engorde — ${tituloRango}`} author="AgroPulse">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.h1}>Pollo de Engorde — Reporte Ejecutivo</Text>
            <Text style={styles.small}>
              {org?.nombre ?? "Cliente"} · {tituloRango}
            </Text>
          </View>
          <Text style={styles.small}>Generado el {fechaGeneracion}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Aves Vivas (lotes activos)</Text>
            <Text style={styles.kpiValue}>{totalAvesVivas.toLocaleString("es-PA")}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>% Viabilidad Promedio</Text>
            <Text style={styles.kpiValue}>{viabilidadProm !== null ? `${viabilidadProm.toFixed(1)}%` : "—"}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Conversión Promedio</Text>
            <Text style={styles.kpiValue}>{conversionProm !== null ? conversionProm.toFixed(2) : "—"}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>I.E.E. Promedio</Text>
            <Text style={styles.kpiValue}>{ieeProm !== null ? ieeProm.toFixed(1) : "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Mortalidad y aves vivas</Text>
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
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Aves vivas por lote · barras 3D</Text>
            <Bars3DPdf data={barsAvesVivas} width={200} height={140} />
            <View style={styles.legendRow}>
              {barsAvesVivas.map((d) => (
                <View key={d.label} style={styles.legendItem}>
                  <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                  <Text style={styles.legendText}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalle por lote</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={{ ...styles.th, flex: 1.3 }}>Lote</Text>
            <Text style={styles.th}>Estado</Text>
            <Text style={styles.th}>Edad (d)</Text>
            <Text style={styles.th}>Aves Vivas</Text>
            <Text style={styles.th}>% Viab.</Text>
            <Text style={styles.th}>Peso (kg)</Text>
            <Text style={styles.th}>Conversión</Text>
            <Text style={styles.th}>I.E.E.</Text>
            <Text style={styles.th}>% A / % B / % Merma</Text>
          </View>
          {resumenes.map((r) => (
            <View key={r.lote.id} style={styles.tr}>
              <Text style={{ ...styles.td, flex: 1.3 }}>
                {r.lote.codigo} ({r.ubicacion})
              </Text>
              <Text style={styles.td}>{r.lote.estado === "activo" ? "Activo" : "Cerrado"}</Text>
              <Text style={styles.td}>{r.resumen.edadDias}</Text>
              <Text style={styles.td}>{r.resumen.avesVivas.toLocaleString("es-PA")}</Text>
              <Text style={styles.td}>{r.resumen.pctViabilidad.toFixed(1)}%</Text>
              <Text style={styles.td}>{r.resumen.pesoPromedioKg !== null ? r.resumen.pesoPromedioKg.toFixed(2) : "—"}</Text>
              <Text style={styles.td}>{r.resumen.conversion !== null ? r.resumen.conversion.toFixed(2) : "—"}</Text>
              <Text style={styles.td}>{r.resumen.iee !== null ? r.resumen.iee.toFixed(1) : "—"}</Text>
              <Text style={styles.td}>
                {r.lote.pctPolloA !== null ? `${Number(r.lote.pctPolloA).toFixed(1)}% / ${Number(r.lote.pctPolloB ?? 0).toFixed(1)}% / ${Number(r.lote.pctMerma ?? 0).toFixed(1)}%` : "—"}
              </Text>
            </View>
          ))}
        </View>

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
      "Content-Disposition": `attachment; filename="AgroPulse-Pollo-Ejecutivo-${loteIdFiltro ? resumenes[0]?.lote.codigo : "Todos-los-lotes"}.pdf"`,
    },
  });
}
