"use client";

// Vistas de cada modal de línea con la presentación de PharmaLab AI:
// encabezado con selector de período, fila de KPIs con tendencia,
// medidores contra meta, alertas y tarjetas de gráficas 3D.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar3D, ChartCard, Gauge, KpiTile, Line3D, pos, neg, warn } from "@/components/charts";
import { fmtNum, fmtValor, lineaPorSlug, mesLargo } from "@/lib/lineas-config";
import type { DatosLinea, KpiData, SerieData } from "@/lib/lineas-vistas";
import { Sparkline } from "@/components/charts/kpi";

export function PageIntro({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="pageIntro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="ctrlBar">{children}</div>}
    </div>
  );
}

export function PeriodoSelect({ valor, opciones, param = "mes", etiqueta = "Período" }: { valor: string; opciones: string[]; param?: string; etiqueta?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label>
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          q.set(param, e.target.value);
          router.push(`${pathname}?${q.toString()}`);
        }}
      >
        {[...opciones].reverse().map((m) => (
          <option key={m} value={m}>
            {mesLargo(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

const nota = (k: KpiData) => [k.meta != null ? `Meta ${fmtValor(k, k.meta)}` : null, k.ubic].filter(Boolean).join(" · ");

export function KpiRow({ kpis, accent, onGo }: { kpis: KpiData[]; accent: string; onGo?: () => void }) {
  return (
    <div className="c3-kpis" style={{ marginTop: 18 }}>
      {kpis.map((k) => (
        <KpiTile key={k.titulo + (k.ubic ?? "")} title={k.titulo} value={fmtValor(k, k.valor)} delta={k.delta} good={k.bueno} spark={k.spark} accent={accent} note={nota(k)} onClick={onGo} />
      ))}
    </div>
  );
}

function rango(k: KpiData) {
  const m = k.meta ?? k.valor ?? 1;
  const v = k.valor ?? m;
  const paso = (x: number) => Math.pow(10, Math.floor(Math.log10(Math.abs(x) || 1))) / 2;
  const abajo = (x: number) => Math.floor(x / paso(x)) * paso(x);
  const arriba = (x: number) => Math.ceil(x / paso(x)) * paso(x);
  if (k.bueno === "up") return { min: abajo(Math.min(m * 0.6, v * 0.9)), max: arriba(Math.max(m * 1.3, v * 1.05)) };
  return { min: 0, max: arriba(Math.max(m * 2, v * 1.1)) };
}

export function TrendCard({ s, color, eyebrow, wide }: { s: SerieData; color: string; eyebrow: string; wide?: boolean }) {
  const f = (v: number | null) => fmtValor(s, v);
  return (
    <ChartCard wide={wide} eyebrow={eyebrow} title={`${s.titulo}: real contra meta`} footnote="Promedio diario de cada mes. Pasa el mouse sobre cada mes para ver el valor y la variación.">
      <Line3D
        labels={s.labels}
        series={[
          { name: s.titulo, values: s.causado, color },
          { name: "Meta", values: s.meta, color: "#5b6b7c", dashed: true },
        ]}
        format={f}
        axisFormat={(v) => fmtNum(v, s.dec > 1 ? 1 : s.dec)}
        label={`Tendencia de ${s.titulo}`}
        height={wide ? 210 : 300}
      />
    </ChartCard>
  );
}

function CumplCard({ items, onOpen }: { items: { label: string; value: number }[]; onOpen?: () => void }) {
  return (
    <ChartCard eyebrow="CUMPLIMIENTO DEL MES" title="Indicadores más lejos de su meta" onOpen={onOpen} openLabel="Ver indicadores" footnote="100 % = en meta. En mortalidad y conversión, más bajo es mejor y ya viene orientado.">
      <Bar3D
        items={items.map((it) => ({ ...it, color: it.value >= 100 ? pos : it.value >= 95 ? warn : neg }))}
        format={(v) => `${fmtNum(v, 1)} % de la meta`}
        axisFormat={(v) => `${fmtNum(v, 0)} %`}
        onSelect={onOpen}
        label="Cumplimiento por indicador"
      />
    </ChartCard>
  );
}

export function TableroView({ slug, d }: { slug: string; d: DatosLinea }) {
  const l = lineaPorSlug(slug)!;
  const router = useRouter();
  const ubic = d.ubics.map((u) => u.nombre).join(" · ");
  const empresa = [...new Set(d.ubics.map((u) => u.empresa))].join(", ");
  return (
    <section>
      <PageIntro eyebrow={`${l.nombre.toUpperCase()} / TABLERO DE LA LÍNEA`} title={l.titulo} sub={`${empresa} · ${ubic}`}>
        <PeriodoSelect valor={d.mes} opciones={d.disponibles} />
      </PageIntro>
      <p className="scenarioNote">Datos de demostración · {mesLargo(d.mes)} · promedio diario del mes contra la meta registrada en cada captura.</p>
      <KpiRow kpis={d.kpis} accent={l.color} onGo={() => router.push(`/linea/${slug}/detalle`)} />
      <div className="c3-grid2">
        <TrendCard s={d.tendencias[0]} color={l.color} eyebrow="TENDENCIA 12 MESES" />
        <CumplCard items={d.cumplBarras} onOpen={() => router.push(`/linea/${slug}/detalle`)} />
        {d.tendencias[1] && <TrendCard s={d.tendencias[1]} color={l.color} eyebrow="TENDENCIA 12 MESES" wide />}
      </div>
      {d.grupos.length > 1 && (
        <div className="c3-card sectionGap">
          <div className="c3-head">
            <div>
              <p className="eyebrow">UBICACIONES</p>
              <h3>Cumplimiento promedio por ubicación</h3>
            </div>
          </div>
          <Bar3D
            items={d.grupos.map((g) => ({ label: g.nombre, value: g.cumplProm == null ? null : Math.round(g.cumplProm * 10) / 10, color: l.color }))}
            format={(v) => `${fmtNum(v, 1)} % de la meta`}
            axisFormat={(v) => `${fmtNum(v, 0)} %`}
            height={180}
            label="Cumplimiento por ubicación"
          />
        </div>
      )}
    </section>
  );
}

export function AlertList({ alertas, titulo = "Alertas abiertas de la línea" }: { alertas: DatosLinea["alertas"]; titulo?: string }) {
  return (
    <div className="c3-card sectionGap">
      <div className="sumHead">
        <h3>{titulo}</h3>
        <span className="tag">{alertas.length}</span>
      </div>
      {alertas.length === 0 ? (
        <p className="c3-empty" style={{ padding: "18px 0" }}>
          Sin alertas en este período: todos los indicadores están en meta.
        </p>
      ) : (
        <div className="alertList">
          {alertas.map((a, i) => (
            <div key={i} className="alertItem" role="listitem">
              <span className={`alertDot ${a.nivel}`}>!</span>
              <span>
                <span className="alertKind">{a.tipo}</span>
                <b>{a.titulo}</b>
                <small>{a.detalle}</small>
              </span>
              <span>{a.nivel === "alta" ? "Alta" : "Media"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PulseView({ slug, d, pwa }: { slug: string; d: DatosLinea; pwa?: boolean }) {
  const l = lineaPorSlug(slug)!;
  const router = useRouter();
  return (
    <section>
      <PageIntro eyebrow={`PULSE / VIGILANCIA DE ${l.nombre.toUpperCase()}`} title="¿Está la línea en meta?" sub={`${mesLargo(d.mes)} · ${d.ubics.map((u) => u.nombre).join(" · ")}`}>
        <PeriodoSelect valor={d.mes} opciones={d.disponibles} />
      </PageIntro>
      <KpiRow kpis={d.kpis} accent={l.color} onGo={pwa ? undefined : () => router.push(`/linea/${slug}/detalle`)} />
      <div className="c3-grid3" style={{ marginBottom: 22 }}>
        {d.gauges.map((g) => {
          const r = rango(g);
          return (
            <ChartCard key={g.titulo} eyebrow={`META · ${g.ubic ?? l.nombre.toUpperCase()}`} title={`${g.titulo} vs meta ${fmtValor(g, g.meta)}`}>
              <Gauge value={g.valor} min={r.min} max={r.max} target={g.meta ?? undefined} good={g.bueno === "down" ? "low" : "high"} label="Promedio diario del mes" display={fmtValor(g, g.valor)} accent={l.color} />
            </ChartCard>
          );
        })}
      </div>
      <AlertList alertas={d.alertas} />
    </section>
  );
}

export function DetalleIndicadoresView({ slug, d }: { slug: string; d: DatosLinea }) {
  const l = lineaPorSlug(slug)!;
  return (
    <section>
      <PageIntro eyebrow={`${l.nombre.toUpperCase()} / DETALLE`} title={l.detalle} sub={`${mesLargo(d.mes)} · cada indicador con su meta y su ficha técnica`}>
        <PeriodoSelect valor={d.mes} opciones={d.disponibles} />
      </PageIntro>
      <KpiRow kpis={d.kpis} accent={l.color} />
      {d.grupos.map((g) => (
        <div key={g.id} className="c3-card sectionGap">
          <div className="c3-head">
            <div>
              <p className="eyebrow">{g.empresa.toUpperCase()}</p>
              <h3>{g.nombre}</h3>
            </div>
            {g.cumplProm != null && <span className={`pill ${g.cumplProm >= 100 ? "ok" : g.cumplProm >= 95 ? "warn" : "bad"}`}>{fmtNum(g.cumplProm, 1)} % de la meta en promedio</span>}
          </div>
          <div className="tableWrap">
            <table className="c3-table">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th className="num">Real (prom. diario)</th>
                  <th className="num">Meta</th>
                  <th className="num">Cumplimiento</th>
                  <th className="num">vs. mes anterior</th>
                  <th>12 meses</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((f) => {
                  const dl = f.causado != null && f.anterior ? ((f.causado - f.anterior) / Math.abs(f.anterior)) * 100 : null;
                  const mejor = dl == null ? null : f.bueno === "up" ? dl >= 0 : dl <= 0;
                  const dec = f.unidad === "%" || (f.causado ?? 0) < 10 ? 2 : (f.causado ?? 0) < 100 ? 1 : 0;
                  return (
                    <tr key={f.clave}>
                      <td>
                        <b>{f.etiqueta}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>({f.unidad})</span>
                        {f.nota && <small>{f.nota}</small>}
                      </td>
                      <td className="num">{fmtNum(f.causado, dec)}</td>
                      <td className="num">{f.meta == null ? "—" : fmtNum(f.meta, dec)}</td>
                      <td className="num">{f.cumpl == null ? <span className="pill neutral">Sin meta</span> : <span className={`pill ${f.cumpl >= 100 ? "ok" : f.cumpl >= 95 ? "warn" : "bad"}`}>{fmtNum(f.cumpl, 1)} %</span>}</td>
                      <td className="num" style={{ color: mejor == null ? "var(--muted)" : mejor ? pos : neg, fontWeight: 700 }}>
                        {dl == null ? "—" : `${dl >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(dl), 1)} %`}
                      </td>
                      <td style={{ width: 110 }}>
                        <div style={{ position: "relative", height: 34, width: 100 }}>
                          <Sparkline values={f.spark} color={l.color} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
