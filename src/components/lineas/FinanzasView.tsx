"use client";

import { Bar3D, ChartCard, KpiTile, Line3D, pos, neg } from "@/components/charts";
import { fmtNum, fmtUsd, lineaPorSlug, mesLargo } from "@/lib/lineas-config";
import type { DatosFinanzas } from "@/lib/lineas-extra";
import { PageIntro, PeriodoSelect } from "./Vistas";

export default function FinanzasView({ slug, d }: { slug: string; d: DatosFinanzas }) {
  const l = lineaPorSlug(slug)!;
  const usd = (v: number | null) => fmtUsd(v);
  return (
    <section>
      <PageIntro eyebrow={`${l.nombre.toUpperCase()} / FINANZAS DE LA LÍNEA`} title="Estado de Resultados" sub={`${d.empresa} · ${mesLargo(d.periodo)} · cifras en dólares`}>
        <PeriodoSelect valor={d.periodo} opciones={d.periodos} param="periodo" />
      </PageIntro>
      <p className="scenarioNote">Datos de demostración · Estado de Resultados registrado para {d.empresa}, real (causado) contra meta del período.</p>
      <div className="c3-kpis" style={{ marginTop: 18 }}>
        {d.kpis.map((k) => (
          <KpiTile key={k.titulo} title={k.titulo} value={fmtUsd(k.valor, true).replace("US$ ", "$")} delta={k.delta} spark={k.spark} accent={l.color} note={k.meta != null ? `Meta ${fmtUsd(k.meta, true)}${k.titulo === "EBITDA" && d.margenEbitda != null ? ` · margen ${fmtNum(d.margenEbitda, 1)} %` : ""}` : undefined} />
        ))}
      </div>
      <div className="c3-grid2">
        <ChartCard eyebrow="TENDENCIA" title="Ingresos por ventas: real contra meta" footnote="Pasa el mouse sobre cada mes para ver el valor, la variación y el % de la meta.">
          <Line3D labels={d.tendencia.labels} series={[{ name: "Ingresos", values: d.tendencia.ingresos, color: l.color }, { name: "Meta", values: d.tendencia.metaIngresos, color: "#5b6b7c", dashed: true }]} format={usd} label="Ingresos por mes" />
        </ChartCard>
        <ChartCard eyebrow="TENDENCIA" title="EBITDA: real contra meta" footnote="EBITDA registrado de la línea por mes.">
          <Line3D labels={d.tendencia.labels} series={[{ name: "EBITDA", values: d.tendencia.ebitda, color: "#c9962b" }, { name: "Meta", values: d.tendencia.metaEbitda, color: "#5b6b7c", dashed: true }]} format={usd} label="EBITDA por mes" />
        </ChartCard>
        <ChartCard wide eyebrow={mesLargo(d.periodo).toUpperCase()} title="Del ingreso a la utilidad neta" footnote="Verde: igual o mejor que la meta. Rojo: peor que la meta (en costos y gastos, más alto es peor).">
          <Bar3D
            items={d.subtotales.map((s) => {
              const costo = s.label === "Costos" || s.label === "Gastos operativos";
              const ok = s.value == null || s.meta == null ? true : costo ? s.value <= s.meta : s.value >= s.meta;
              return { label: s.label, value: s.value, color: ok ? pos : neg, note: s.meta != null ? `Meta ${fmtUsd(s.meta)}` : undefined };
            })}
            compare={d.subtotales.map((s) => s.meta)}
            compareLabel="Meta"
            format={usd}
            height={230}
            label="Subtotales del Estado de Resultados"
          />
        </ChartCard>
      </div>
      <div className="c3-card sectionGap">
        <div className="c3-head">
          <div>
            <p className="eyebrow">DETALLE</p>
            <h3>Estado de Resultados · {mesLargo(d.periodo)}</h3>
          </div>
        </div>
        <div className="tableWrap">
          <table className="c3-table">
            <thead>
              <tr>
                <th>Partida</th>
                <th className="num">Real</th>
                <th className="num">Meta</th>
                <th className="num">Desviación</th>
              </tr>
            </thead>
            <tbody>
              {d.lineas.map((r, i) => {
                // Las partidas sin signo heredan el sentido de la partida "(+)" o "(-)" que las agrupa.
                const cab = [...d.lineas.slice(0, i + 1)].reverse().find((x) => /^\((\+|-|=)\)/.test(x.concepto))?.concepto ?? "";
                const menosEsMejor = cab.startsWith("(-)");
                const dv = r.meta ? ((r.causado - r.meta) / Math.abs(r.meta)) * 100 : null;
                const ok = dv == null ? null : menosEsMejor ? dv <= 0 : dv >= 0;
                return (
                  <tr key={r.concepto} className={r.subtotal ? "sub" : undefined}>
                    <td>{r.concepto}</td>
                    <td className="num">{fmtUsd(r.causado)}</td>
                    <td className="num">{fmtUsd(r.meta)}</td>
                    <td className="num">{dv == null ? "—" : <span className={`pill ${ok == null ? "neutral" : ok ? "ok" : "bad"}`}>{`${dv >= 0 ? "+" : ""}${fmtNum(dv, 1)} %`}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
