"use client";

import { Bar3D, ChartCard, Donut3D, KpiTile, Line3D, pos, neg, warn } from "@/components/charts";
import { fmtNum, lineaPorSlug, mesLargo } from "@/lib/lineas-config";
import type { DatosInventario } from "@/lib/lineas-extra";
import { AlertList, PageIntro, PeriodoSelect } from "./Vistas";

const COLORES = ["#5f9a7a", "#c9962b", "#2f7fd0", "#b0547c", "#e0794f", "#8f6cc9", "#4fa36b", "#5b8aa8", "#b7a13a"];

export default function InventarioView({ d }: { d: DatosInventario }) {
  const l = lineaPorSlug("aba")!;
  const tm = (v: number | null) => `${fmtNum(v, 0)} Tm`;
  return (
    <section>
      <PageIntro eyebrow="PLANTA ABA / DETALLE" title="Inventario de insumos" sub={`Planta La Chorrera · ${mesLargo(d.mes)} · alcance = inventario / consumo diario promedio`}>
        <PeriodoSelect valor={d.mes} opciones={d.disponibles} />
      </PageIntro>
      <div className="c3-kpis" style={{ marginTop: 18 }}>
        {d.insumos.map((i) => (
          <KpiTile
            key={i.nombre}
            title={`${i.nombre} · alcance`}
            value={`${fmtNum(i.alcance, 1)} días`}
            good="none"
            spark={i.serie}
            accent={l.color}
            note={`${fmtNum(i.inventario, 0)} ${i.unidad} en inventario · mínimo ${i.minimo} días`}
          />
        ))}
      </div>
      <div className="c3-grid2">
        <ChartCard eyebrow="ALCANCE" title="Días de inventario contra el mínimo" footnote="Rojo: por debajo del mínimo de días definido para el insumo.">
          <Bar3D
            items={d.insumos.map((i) => ({ label: i.nombre, value: i.alcance == null ? null : Math.round(i.alcance * 10) / 10, color: i.alcance == null ? warn : i.alcance < i.minimo ? neg : pos, note: `Mínimo ${i.minimo} días` }))}
            format={(v) => `${fmtNum(v, 1)} días`}
            axisFormat={(v) => fmtNum(v, 0)}
            label="Alcance por insumo"
          />
        </ChartCard>
        <ChartCard eyebrow={`PRODUCCIÓN · ${mesLargo(d.mes).toUpperCase()}`} title="Toneladas diarias por fórmula">
          <Donut3D items={d.formulas.map((f, i) => ({ label: f.label, value: f.value, color: COLORES[i % COLORES.length] }))} format={tm} centerLabel="Tm por día" />
        </ChartCard>
        {d.insumos[0] && (
          <ChartCard wide eyebrow="ÚLTIMOS 90 DÍAS" title="Inventario por insumo">
            <Line3D
              labels={d.insumos[0].fechas.map((f) => f.slice(5))}
              series={d.insumos.map((i, k) => ({ name: i.nombre, values: i.serie, color: COLORES[k] }))}
              format={(v) => `${fmtNum(v, 0)} ${d.insumos[0].unidad}`}
              label="Inventario diario"
              height={220}
              zero
            />
          </ChartCard>
        )}
      </div>
      <AlertList alertas={d.alertas} titulo="Alertas de inventario" />
    </section>
  );
}
