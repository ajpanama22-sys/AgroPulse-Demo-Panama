import { Card, PageHeader, Badge } from "@/components/ui";
import { unidadColor } from "@/lib/theme";
import { etiquetaBucket, variacion, agregarPorBucket, sumarRango, totalConceptoRango, CONCEPTOS_CLAVE } from "@/lib/analisis";
import Donut3D from "@/components/Donut3D";
import OrbitBars3D from "@/components/OrbitBars3D";
import AnalisisControls from "@/components/AnalisisControls";
import AnalisisReportButtons from "@/components/AnalisisReportButtons";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtPct(p: number | null) {
  if (p === null) return "—";
  const s = (p * 100).toFixed(1);
  return `${p >= 0 ? "+" : ""}${s}%`;
}
function etiquetaRango(desde: string, hasta: string) {
  return desde === hasta ? etiquetaBucket(desde, "mes") : `${etiquetaBucket(desde, "mes")} – ${etiquetaBucket(hasta, "mes")}`;
}

export default async function AnalisisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { agg, unidadPorEmpresa, empresaNombre, bucketsDisponibles } = await agregarPorBucket("mes");

  const ultimo = bucketsDisponibles[bucketsDisponibles.length - 1];
  const penultimo = bucketsDisponibles[bucketsDisponibles.length - 2] ?? ultimo;

  const desdeA = sp.desdeA && bucketsDisponibles.includes(sp.desdeA) ? sp.desdeA : ultimo;
  const hastaA = sp.hastaA && bucketsDisponibles.includes(sp.hastaA) ? sp.hastaA : ultimo;
  const desdeB = sp.desdeB && bucketsDisponibles.includes(sp.desdeB) ? sp.desdeB : penultimo;
  const hastaB = sp.hastaB && bucketsDisponibles.includes(sp.hastaB) ? sp.hastaB : penultimo;

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

  const orbitA = donutData;
  const orbitB = Array.from(rangoB.entries()).map(([empresaId, conceptos]) => ({
    label: empresaNombre[empresaId],
    value: conceptos.get("(=) EBITDA") ?? 0,
    color: unidadColor[unidadPorEmpresa[empresaId]] ?? "#999",
  }));

  return (
    <div>
      <PageHeader
        title="Análisis comparativo"
        subtitle="EBITDA, ingresos y utilidad neta — comparación entre dos rangos de fecha, con 2 años de historia"
        action={<AnalisisReportButtons desdeA={desdeA} hastaA={hastaA} desdeB={desdeB} hastaB={hastaB} />}
      />
      <div className="px-8 py-6">
        <AnalisisControls desdeA={desdeA} hastaA={hastaA} desdeB={desdeB} hastaB={hastaB} bucketsDisponibles={bucketsDisponibles} />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {filas.map((f) => {
            const delta = f.a !== null && f.b !== null ? variacion(f.a, f.b) : null;
            return (
              <Card key={f.concepto}>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{f.concepto.replace(/^\(.\) /, "").replace(" (Devengado)", "")}</p>
                <p className="mt-1 font-display text-2xl font-bold text-charcoal">{f.a !== null ? fmtMoney(f.a) : "—"}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  <Badge tone={delta && delta.abs >= 0 ? "success" : "danger"}>{delta ? fmtPct(delta.pct) : "—"}</Badge>
                  <span className="text-text-muted">vs. {etiquetaRango(desdeB, hastaB)} ({f.b !== null ? fmtMoney(f.b) : "—"})</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold text-charcoal">Composición de EBITDA por unidad — {etiquetaRango(desdeA, hastaA)}</p>
            <div className="flex justify-center">
              <Donut3D data={donutData} />
            </div>
            <div className="flex justify-center gap-4">
              {donutData.map((d) => (
                <span key={d.label} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.label} · {fmtMoney(d.value)}
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-charcoal">EBITDA por unidad — Período A vs. Período B</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-center text-xs text-text-faint">{etiquetaRango(desdeA, hastaA)}</p>
                <div style={{ height: 200 }}>
                  <OrbitBars3D data={orbitA} />
                </div>
              </div>
              <div>
                <p className="text-center text-xs text-text-faint">{etiquetaRango(desdeB, hastaB)}</p>
                <div style={{ height: 200 }}>
                  <OrbitBars3D data={orbitB} />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-6 overflow-x-auto">
          <p className="mb-3 text-sm font-semibold text-charcoal">Detalle numérico</p>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="py-2 pr-4">Partida</th>
                <th className="py-2 pr-4">Período A ({etiquetaRango(desdeA, hastaA)})</th>
                <th className="py-2 pr-4">Período B ({etiquetaRango(desdeB, hastaB)})</th>
                <th className="py-2">Variación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const delta = f.a !== null && f.b !== null ? variacion(f.a, f.b) : null;
                return (
                  <tr key={f.concepto} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium text-charcoal">{f.concepto}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{f.a !== null ? fmtMoney(f.a) : "—"}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-text-muted">{f.b !== null ? fmtMoney(f.b) : "—"}</td>
                    <td className="py-2.5 tabular-nums">{delta ? fmtPct(delta.pct) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
