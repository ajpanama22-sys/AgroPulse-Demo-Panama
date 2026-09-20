import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from "@react-pdf/renderer";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { edrLineas, empresas, alertas, organizacion } from "@/lib/db/schema";

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
  kpiValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4, color: CHARCOAL },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 4 },
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

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const periodo = "2026-07";
  const [edr, empresasAll, alertasActivas, [org]] = await Promise.all([
    db.select().from(edrLineas).where(eq(edrLineas.periodo, periodo)),
    db.select().from(empresas),
    db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn)),
    db.select().from(organizacion).limit(1),
  ]);
  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre]));
  const unidadPorEmpresa: Record<string, string> = {};
  for (const e of empresasAll) {
    if (e.nombre.includes("HUEVOS")) unidadPorEmpresa[e.id] = "Huevos";
    else if (e.nombre.includes("DORADO")) unidadPorEmpresa[e.id] = "Pollo";
    else if (e.nombre.includes("CERDOS")) unidadPorEmpresa[e.id] = "Cerdo";
  }
  const unidades = ["Huevos", "Pollo", "Cerdo"];
  const empresaIdPorUnidad: Record<string, string> = {};
  for (const [id, u] of Object.entries(unidadPorEmpresa)) empresaIdPorUnidad[u] = id;

  const conceptos = Array.from(new Set(edr.map((l) => l.concepto))).sort((a, b) => (edr.find((l) => l.concepto === a)?.orden ?? 0) - (edr.find((l) => l.concepto === b)?.orden ?? 0));
  const ebitdaLineas = edr.filter((l) => l.concepto === "(=) EBITDA");
  const ebitdaTotal = ebitdaLineas.reduce((s, l) => s + Number(l.causado), 0);
  const ingresosTotal = edr.filter((l) => l.concepto.includes("Ingresos por Ventas")).reduce((s, l) => s + Number(l.causado), 0);
  const utilidadNetaTotal = edr.filter((l) => l.concepto === "(=) UTILIDAD NETA").reduce((s, l) => s + Number(l.causado), 0);
  const margenEbitda = ((ebitdaTotal / ingresosTotal) * 100).toFixed(1);

  const fechaGeneracion = new Date().toLocaleDateString("es-PA", { day: "2-digit", month: "long", year: "numeric" });

  const doc = (
    <Document title={`AgroPulse — Reporte Ejecutivo ${periodo}`} author="AgroPulse · Agroindustrias del Istmo">
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
              {org?.nombre ?? "Cliente"} — Período {periodo}
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
          <Text style={styles.small}>AgroPulse · {periodo}</Text>
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

        <Text style={styles.sectionTitle}>Estado de Resultados — Consolidado</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={{ ...styles.th, flex: 1.8 }}>Partida</Text>
            {unidades.map((u) => (
              <Text key={u} style={styles.th}>
                {u}
              </Text>
            ))}
            <Text style={styles.th}>Consolidado</Text>
          </View>
          {conceptos.map((concepto) => {
            const linea = edr.find((l) => l.concepto === concepto);
            const filaStyle = linea?.esSubtotal ? styles.trSubtotal : styles.tr;
            const cellStyle = linea?.esSubtotal ? styles.tdBold : styles.td;
            const valores = unidades.map((u) => edr.find((l) => l.empresaId === empresaIdPorUnidad[u] && l.concepto === concepto));
            const total = valores.reduce((s, l) => s + Number(l?.causado ?? 0), 0);
            return (
              <View key={concepto} style={filaStyle}>
                <Text style={styles.tdConcepto}>{concepto}</Text>
                {valores.map((l, i) => (
                  <Text key={i} style={cellStyle}>
                    {l ? fmtMoney(Number(l.causado)) : "—"}
                  </Text>
                ))}
                <Text style={cellStyle}>{fmtMoney(total)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Alertas Activas</Text>
        {alertasActivas.length === 0 && <Text style={styles.small}>Sin alertas activas al momento de generar el reporte.</Text>}
        {alertasActivas.map((a) => (
          <View key={a.id} style={styles.alertRow}>
            <Text style={styles.alertTitle}>{a.titulo}</Text>
            <Text style={styles.alertDetail}>{a.detalle}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>AgroPulse — Agroindustrias del Istmo</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AgroPulse-Reporte-Ejecutivo-${periodo}.pdf"`,
    },
  });
}
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from "@react-pdf/renderer";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { edrLineas, empresas, alertas, organizacion } from "@/lib/db/schema";

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
  kpiValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4, color: CHARCOAL },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 4 },
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

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const periodo = "2026-07";
  const [edr, empresasAll, alertasActivas, [org]] = await Promise.all([
    db.select().from(edrLineas).where(eq(edrLineas.periodo, periodo)),
    db.select().from(empresas),
    db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn)),
    db.select().from(organizacion).limit(1),
  ]);
  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre]));
  const unidadPorEmpresa: Record<string, string> = {};
  for (const e of empresasAll) {
    if (e.nombre.includes("HUEVOS")) unidadPorEmpresa[e.id] = "Huevos";
    else if (e.nombre.includes("DORADO")) unidadPorEmpresa[e.id] = "Pollo";
    else if (e.nombre.includes("CERDOS")) unidadPorEmpresa[e.id] = "Cerdo";
  }
  const unidades = ["Huevos", "Pollo", "Cerdo"];
  const empresaIdPorUnidad: Record<string, string> = {};
  for (const [id, u] of Object.entries(unidadPorEmpresa)) empresaIdPorUnidad[u] = id;

  const conceptos = Array.from(new Set(edr.map((l) => l.concepto))).sort((a, b) => (edr.find((l) => l.concepto === a)?.orden ?? 0) - (edr.find((l) => l.concepto === b)?.orden ?? 0));
  const ebitdaLineas = edr.filter((l) => l.concepto === "(=) EBITDA");
  const ebitdaTotal = ebitdaLineas.reduce((s, l) => s + Number(l.causado), 0);
  const ingresosTotal = edr.filter((l) => l.concepto.includes("Ingresos por Ventas")).reduce((s, l) => s + Number(l.causado), 0);
  const utilidadNetaTotal = edr.filter((l) => l.concepto === "(=) UTILIDAD NETA").reduce((s, l) => s + Number(l.causado), 0);
  const margenEbitda = ((ebitdaTotal / ingresosTotal) * 100).toFixed(1);

  const fechaGeneracion = new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });

  const doc = (
    <Document title={`AgroPulse — Reporte Ejecutivo ${periodo}`} author="AgroPulse · JHS Agroindustria">
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
              {org?.nombre ?? "Cliente"} — Período {periodo}
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
          <Text style={styles.small}>AgroPulse · {periodo}</Text>
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

        <Text style={styles.sectionTitle}>Estado de Resultados — Consolidado</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={{ ...styles.th, flex: 1.8 }}>Partida</Text>
            {unidades.map((u) => (
              <Text key={u} style={styles.th}>
                {u}
              </Text>
            ))}
            <Text style={styles.th}>Consolidado</Text>
          </View>
          {conceptos.map((concepto) => {
            const linea = edr.find((l) => l.concepto === concepto);
            const filaStyle = linea?.esSubtotal ? styles.trSubtotal : styles.tr;
            const cellStyle = linea?.esSubtotal ? styles.tdBold : styles.td;
            const valores = unidades.map((u) => edr.find((l) => l.empresaId === empresaIdPorUnidad[u] && l.concepto === concepto));
            const total = valores.reduce((s, l) => s + Number(l?.causado ?? 0), 0);
            return (
              <View key={concepto} style={filaStyle}>
                <Text style={styles.tdConcepto}>{concepto}</Text>
                {valores.map((l, i) => (
                  <Text key={i} style={cellStyle}>
                    {l ? fmtMoney(Number(l.causado)) : "—"}
                  </Text>
                ))}
                <Text style={cellStyle}>{fmtMoney(total)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Alertas Activas</Text>
        {alertasActivas.length === 0 && <Text style={styles.small}>Sin alertas activas al momento de generar el reporte.</Text>}
        {alertasActivas.map((a) => (
          <View key={a.id} style={styles.alertRow}>
            <Text style={styles.alertTitle}>{a.titulo}</Text>
            <Text style={styles.alertDetail}>{a.detalle}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>AgroPulse — Corporación JHS</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="AgroPulse-Reporte-Ejecutivo-${periodo}.pdf"`,
    },
  });
}
