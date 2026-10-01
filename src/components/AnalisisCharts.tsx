"use client";

import { Bar3D, ChartCard, Donut3D } from "@/components/charts";

type D = { label: string; value: number; color: string };
const usd = (v: number | null) => (v == null ? "N/D" : `US$ ${v.toLocaleString("es-PA", { maximumFractionDigits: 0 })}`);

// Gráficas del Análisis comparativo con el kit de PharmaLab AI (mismos datos).
export default function AnalisisCharts({ donut, a, b, etiquetaA, etiquetaB }: { donut: D[]; a: D[]; b: D[]; etiquetaA: string; etiquetaB: string }) {
  return (
    <div className="c3-grid2" style={{ marginTop: 22 }}>
      <ChartCard eyebrow={`PERÍODO A · ${etiquetaA.toUpperCase()}`} title="Composición de EBITDA por unidad">
        <Donut3D items={donut} format={usd} centerLabel="EBITDA" />
      </ChartCard>
      <ChartCard eyebrow="PERÍODO A CONTRA PERÍODO B" title="EBITDA por unidad" footnote={`Barras: ${etiquetaA}. Pasa el mouse para ver ${etiquetaB} y la variación.`}>
        <Bar3D items={a} compare={a.map((x) => b.find((y) => y.label === x.label)?.value ?? null)} compareLabel={etiquetaB} format={usd} total label="EBITDA por unidad" />
      </ChartCard>
    </div>
  );
}
