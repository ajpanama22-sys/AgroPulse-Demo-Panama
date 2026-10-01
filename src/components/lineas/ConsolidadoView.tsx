"use client";

import Link from "next/link";
import { Bar3D, ChartCard, Donut3D, KpiTile } from "@/components/charts";
import Icon from "@/components/icons";
import { fmtNum, fmtUsd, fmtValor, lineaPorSlug, mesLargo } from "@/lib/lineas-config";
import type { DatosConsolidado } from "@/lib/lineas-extra";
import { AlertList, PageIntro, PeriodoSelect } from "./Vistas";

export default function ConsolidadoView({ d, pwa }: { d: DatosConsolidado; pwa?: boolean }) {
  const color = (slug: string) => lineaPorSlug(slug)?.color ?? "#999";
  const margen = d.totIng ? (d.totEbitda / d.totIng) * 100 : null;
  return (
    <section>
      <PageIntro eyebrow="COMÚN / CONSOLIDADO" title="Agroindustrias del Istmo en una sola pantalla" sub={`Producción a ${mesLargo(d.mes)} · finanzas de ${mesLargo(d.periodo)}`}>
        <PeriodoSelect valor={d.periodo} opciones={d.periodos} param="periodo" etiqueta="Período financiero" />
      </PageIntro>

      <div className="lineCards" style={{ marginTop: 18 }}>
        {d.tarjetas.map((t) => {
          const l = lineaPorSlug(t.slug)!;
          return (
            <Link key={t.slug} href={pwa ? `/ejecutivo?vista=${t.slug}` : `/linea/${t.slug}`} className="lineCard" style={{ ["--lc" as string]: l.color }}>
              <span className="lineIcon" style={{ position: "absolute" }}>
                <Icon name={l.navIcon} size={22} />
              </span>
              <b>{l.nombre}</b>
              <span>{t.titulo}</span>
              <strong>{fmtValor(t, t.valor)}</strong>
              <span>
                Meta {fmtValor(t, t.meta)}
                {t.cumpl != null && (
                  <>
                    {" · "}
                    <em style={{ fontStyle: "normal", fontWeight: 700, color: t.cumpl >= 100 ? "#2e9e6a" : "#d0544f" }}>{fmtNum(t.cumpl, 0)} % de la meta</em>
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="c3-kpis" style={{ marginTop: 22 }}>
        <KpiTile title="Ingresos consolidados" value={fmtUsd(d.totIng, true)} accent="#ef7d1e" note={mesLargo(d.periodo)} />
        <KpiTile title="EBITDA consolidado" value={fmtUsd(d.totEbitda, true)} accent="#ef7d1e" note={`Meta ${fmtUsd(d.totMeta, true)} · ${d.totMeta ? fmtNum((d.totEbitda / d.totMeta) * 100, 0) : "N/D"} % de la meta`} />
        <KpiTile title="Margen EBITDA" value={`${fmtNum(margen, 1)} %`} accent="#ef7d1e" note="EBITDA / ingresos" good="none" />
      </div>

      <div className="c3-grid2">
        <ChartCard eyebrow={mesLargo(d.periodo).toUpperCase()} title="EBITDA por línea">
          <Bar3D items={d.ebitda.map((e) => ({ label: e.label, value: e.value, color: color(e.slug), note: e.meta != null ? `Meta ${fmtUsd(e.meta)}` : undefined }))} compare={d.ebitda.map((e) => e.meta)} compareLabel="Meta" format={(v) => fmtUsd(v)} total label="EBITDA por empresa" />
        </ChartCard>
        <ChartCard eyebrow={mesLargo(d.periodo).toUpperCase()} title="Ingresos por línea">
          <Donut3D items={d.ingresos.map((e) => ({ label: e.label, value: e.value, color: color(e.slug) }))} format={(v) => fmtUsd(v)} centerLabel="Ingresos" centerValue={fmtUsd(d.totIng, true).replace("US$ ", "$")} />
        </ChartCard>
      </div>

      <AlertList alertas={d.alertas} titulo="Alertas abiertas de las cuatro líneas" />

      <div className="c3-card sectionGap">
        <div className="c3-head">
          <div>
            <p className="eyebrow">ESTADO DE RESULTADOS</p>
            <h3>Consolidado · {mesLargo(d.periodo)}</h3>
          </div>
          <span className="tag">Margen EBITDA {fmtNum(margen, 1)} %</span>
        </div>
        <div className="tableWrap">
          <table className="c3-table">
            <thead>
              <tr>
                <th>Partida</th>
                {d.empresas.map((e) => (
                  <th key={e.id} className="num">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <i style={{ width: 8, height: 8, borderRadius: 4, background: color(e.slug), display: "inline-block" }} />
                      {lineaPorSlug(e.slug)?.nombre}
                    </span>
                  </th>
                ))}
                <th className="num">Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {d.tabla.map((r) => (
                <tr key={r.concepto} className={r.subtotal ? "sub" : undefined}>
                  <td>{r.concepto}</td>
                  {r.valores.map((v, i) => (
                    <td key={i} className="num">
                      {v == null ? "—" : fmtUsd(v)}
                    </td>
                  ))}
                  <td className="num">{fmtUsd(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
