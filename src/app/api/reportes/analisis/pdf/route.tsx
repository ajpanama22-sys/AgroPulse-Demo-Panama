import { Document, Page, Text, View, StyleSheet, renderToBuffer, Svg, Circle, Rect } from "@react-pdf/renderer";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizacion } from "@/lib/db/schema";
import { agregarPorBucket, sumarRango, totalConceptoRango, etiquetaBucket, variacion, CONCEPTOS_CLAVE } from "@/lib/analisis";
import { unidadColor } from "@/lib/theme";

const CHARCOAL = "#3c3c3a";
const ORANGE = "#ef7d1e";
const BORDER = "#e4dfd3";
const CREAM = "#f5f2ec";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: CHARCOAL, fontFamily: "Helvetica" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: ORANGE, paddingBottom: 10, marginBottom: 18 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 9, color: "#736f64" },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10, backgroundColor: CREAM },
  kpiLabel: { fontSize: 8, color: "#736f64", textTransform: "uppercase" },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 4 },
  kpiDelta: { fontSize: 8, marginTop: 3 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 10 },
  chartsRow: { flexDirection: "row", gap: 16, marginTop: 6, alignItems: "flex-start" },
  chartBox: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12 },
  legendRow: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 7.5, color: "#736f64" },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginTop: 8 },
  trHead: { flexDirection: "row", backgroundColor: CHARCOAL },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  th: { flex: 1, padding: 6, fontSize: 8, color: "#fff", fontFamily: "Helvetica-Bold" },
  thConcepto: { flex: 1.8, padding: 6, fontSize: 8, color: "#fff", fontFamily: "Helvetica-Bold" },
  td: { flex: 1, padding: 6, fontSize: 8.5 },
  tdConcepto: { flex: 1.8, padding: 6, fontSize: 8.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#a29c8c", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
});

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtPct(p: number | null) {
  if (p === null) return "—";
  return `${p >= 0 ? "+" : ""}${(p * 100).toFixed(1)}%`;
}

// Precalcula el offset acumulado de cada porción fuera del render — mutar
// una variable capturada dentro del .map() del JSX es lo que el compilador
// de React (eslint-plugin-react-hooks) marca como error.
function offsetsAcumulados(data: { value: number }[], circumference: number, total: number): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const d of data) {
    offsets.push(offset);
    offset += (Math.max(d.value, 0) / total) * circumference;
  }
  return offsets;
}

function DonutSvg({ data, size = 130 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const offsets = offsetsAcumulados(data, circumference, total);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={BORDER} strokeWidth={16} fill="none" />
      {data.map((d, i) => {
        const frac = Math.max(d.value, 0) / total;
        const len = frac * circumference;
        const dash = `${Math.max(len - 2, 0)} ${circumference - len + 2}`;
        const offsetDeg = (offsets[i] / circumference) * 360;
        return (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            stroke={d.color}
            strokeWidth={16}
            fill="none"
            strokeDasharray={dash}
            transform={`rotate(${-90 + offsetDeg} ${cx} ${cy})`}
          />
        );
      })}
    </Svg>
  );
}

function BarsSvg({ data, width = 220, height = 130 }: { data: { label: string; value: number; color: string }[]; width?: number; height?: number }) {
  const max = Math.max(...data.map((d) => Math.max(d.value, 0)), 1);
  const barW = width / (data.length * 1.8);
  const gap = barW * 0.8;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const h = (Math.max(d.value, 0) / max) * (height - 10);
        const x = gap / 2 + i * (barW + gap);
        return <Rect key={i} x={x} y={height - h} width={barW} height={h} rx={3} fill={d.color} />;
      })}
    </Svg>
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const { agg, empresaNombre, unidadPorEmpresa, bucketsDisponibles } = await agregarPorBucket("mes");
  const ultimo = bucketsDisponibles[bucketsDisponibles.length - 1];
  const penultimo = bucketsDisponibles[bucketsDisponibles.length - 2] ?? ultimo;
  const sp = req.nextUrl.searchParams;
  const desdeA = sp.get("desdeA") && bucketsDisponibles.includes(sp.get("desdeA")!) ? sp.get("desdeA")! : ultimo;
  const hastaA = sp.get("hastaA") && bucketsDisponibles.includes(sp.get("hastaA")!) ? sp.get("hastaA")! : ultimo;
  const desdeB = sp.get("desdeB") && bucketsDisponibles.includes(sp.get("desdeB")!) ? sp.get("desdeB")! : penultimo;
  const hastaB = sp.get("hastaB") && bucketsDisponibles.includes(sp.get("hastaB")!) ? sp.get("hastaB")! : penultimo;
  const etA = `${etiquetaBucket(desdeA, "mes")}${desdeA !== hastaA ? " – " + etiquetaBucket(hastaA, "mes") : ""}`;
  const etB = `${etiquetaBucket(desdeB, "mes")}${desdeB !== hastaB ? " – " + etiquetaBucket(hastaB, "mes") : ""}`;
  const [org] = await db.select().from(organizacion).limit(1);

  const rangoA = sumarRango(agg, desdeA, hastaA);
  const rangoB = sumarRango(agg, desdeB, hastaB);

  const filas = CONCEPTOS_CLAVE.map((concepto) => ({
    concepto,
    a: totalConceptoRango(rangoA, concepto),
    b: totalConceptoRango(rangoB, concepto),
  }));

  const donutData = Array.from(rangoA.entries())
    .map(([empresaId, conceptos]) => ({ label: empresaNombre[empresaId], value: conceptos.get("(=) EBITDA") ?? 0, color: unidadColor[unidadPorEmpresa[empresaId]] ?? "#999" }))
    .filter((d) => d.value > 0);
  const barsA = donutData;
  const barsB = Array.from(rangoB.entries()).map(([empresaId, conceptos]) => ({
    label: empresaNombre[empresaId],
    value: conceptos.get("(=) EBITDA") ?? 0,
    color: unidadColor[unidadPorEmpresa[empresaId]] ?? "#999",
  }));

  const fechaGeneracion = new Date().toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" });

  const doc = (
    <Document title="AgroPulse — Análisis Comparativo">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.h1}>Análisis Comparativo</Text>
            <Text style={styles.small}>
              {org?.nombre ?? "Cliente"} · {etA} vs. {etB}
            </Text>
          </View>
          <Text style={styles.small}>Generado el {fechaGeneracion}</Text>
        </View>

        <View style={styles.kpiRow}>
          {filas.map((f) => {
            const delta = f.a !== null && f.b !== null ? variacion(f.a, f.b) : null;
            return (
              <View key={f.concepto} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{f.concepto.replace(/^\(.\) /, "")}</Text>
                <Text style={styles.kpiValue}>{f.a !== null ? fmtMoney(f.a) : "—"}</Text>
                <Text style={{ ...styles.kpiDelta, color: delta && delta.abs < 0 ? "#c23b3b" : "#2f7d4f" }}>
                  {delta ? fmtPct(delta.pct) : "—"} vs. {etB}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Composición y comparación — EBITDA por unidad</Text>
        <View style={styles.chartsRow}>
          <View style={styles.chartBox}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Composición · Período A ({etA})</Text>
            <DonutSvg data={donutData} />
            <View style={styles.legendRow}>
              {donutData.map((d) => (
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
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
              Período A ({etA}) vs. Período B ({etB})
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <BarsSvg data={barsA} width={110} height={110} />
              <BarsSvg data={barsB} width={110} height={110} />
            </View>
            <View style={styles.legendRow}>
              {barsA.map((d) => (
                <View key={d.label} style={styles.legendItem}>
                  <View style={{ ...styles.legendDot, backgroundColor: d.color }} />
                  <Text style={styles.legendText}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Detalle numérico</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.thConcepto}>Partida</Text>
            <Text style={styles.th}>Período A ({etA})</Text>
            <Text style={styles.th}>Período B ({etB})</Text>
            <Text style={styles.th}>Variación</Text>
          </View>
          {filas.map((f) => {
            const delta = f.a !== null && f.b !== null ? variacion(f.a, f.b) : null;
            return (
              <View key={f.concepto} style={styles.tr}>
                <Text style={styles.tdConcepto}>{f.concepto}</Text>
                <Text style={styles.td}>{f.a !== null ? fmtMoney(f.a) : "—"}</Text>
                <Text style={styles.td}>{f.b !== null ? fmtMoney(f.b) : "—"}</Text>
                <Text style={styles.td}>{delta ? fmtPct(delta.pct) : "—"}</Text>
              </View>
            );
          })}
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
      "Content-Disposition": `attachment; filename="AgroPulse-Analisis-${desdeA}_a_${hastaA}-vs-${desdeB}_a_${hastaB}.pdf"`,
    },
  });
}
