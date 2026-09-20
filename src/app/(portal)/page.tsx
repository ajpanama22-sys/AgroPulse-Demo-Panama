import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertas, capturas, ubicaciones, empresas, edrLineas } from "@/lib/db/schema";
import { Card, PageHeader, StatTile, Badge } from "@/components/ui";
import { theme, unidadColor } from "@/lib/theme";
import ProductIcon3D from "@/components/ProductIcon3D";
import OrbitBars3D from "@/components/OrbitBars3D";
import Bars3D from "@/components/Bars3D";
import ReportButtons from "@/components/ReportButtons";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage() {
  const [alertasActivas, ubic, empresasAll, edr] = await Promise.all([
    db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn)),
    db.select().from(ubicaciones),
    db.select().from(empresas),
    db.select().from(edrLineas).where(eq(edrLineas.periodo, "2026-07")),
  ]);

  const nombrePorUbicacion = (nombre: string) => ubic.find((u) => u.nombre.toLowerCase().includes(nombre.toLowerCase()));
  const cojedes = nombrePorUbicacion("cojedes");
  const engorde = nombrePorUbicacion("engorde");
  const guarico = nombrePorUbicacion("guárico") ?? nombrePorUbicacion("guarico");

  const [capHuevos, capPollo, capCerdo, serieHuevos] = await Promise.all([
    cojedes ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, cojedes.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
    engorde ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, engorde.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
    guarico ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, guarico.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
    cojedes ? db.select().from(capturas).where(eq(capturas.ubicacionId, cojedes.id)).orderBy(capturas.fecha) : Promise.resolve([]),
  ]);

  const valHuevos = (capHuevos[0]?.valores ?? {}) as Record<string, { causado: number }>;
  const valPollo = (capPollo[0]?.valores ?? {}) as Record<string, { causado: number }>;
  const valCerdo = (capCerdo[0]?.valores ?? {}) as Record<string, { causado: number }>;

  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre]));
  const unidadPorEmpresa: Record<string, "huevos" | "pollo" | "cerdo"> = {};
  for (const e of empresasAll) {
    if (e.nombre.includes("HUEVOS")) unidadPorEmpresa[e.id] = "huevos";
    else if (e.nombre.includes("DORADO")) unidadPorEmpresa[e.id] = "pollo";
    else if (e.nombre.includes("CERDOS")) unidadPorEmpresa[e.id] = "cerdo";
  }

  const ebitdaPorEmpresa = edr.filter((l) => l.concepto === "(=) EBITDA");
  const orbitData = ebitdaPorEmpresa.map((l) => ({
    label: empresaNombre[l.empresaId]?.split(" - ")[0] ?? "—",
    value: Number(l.causado),
    color: unidadColor[unidadPorEmpresa[l.empresaId] ?? "huevos"],
  }));

  const conceptosOrden = Array.from(new Set(edr.map((l) => l.concepto))).sort((a, b) => (edr.find((l) => l.concepto === a)?.orden ?? 0) - (edr.find((l) => l.concepto === b)?.orden ?? 0));
  const empresasEnOrden = ["huevos", "pollo", "cerdo"] as const;
  const empresaIdPorUnidad = Object.fromEntries(Object.entries(unidadPorEmpresa).map(([id, u]) => [u, id]));

  const totalConsolidadoCausado = ebitdaPorEmpresa.reduce((s, l) => s + Number(l.causado), 0);
  const totalConsolidadoMeta = ebitdaPorEmpresa.reduce((s, l) => s + Number(l.meta), 0);

  const ingresosTotales = edr.filter((l) => l.concepto.includes("Ingresos por Ventas")).reduce((s, l) => s + Number(l.causado), 0);

  const serie7 = serieHuevos.slice(-7).map((c) => {
    const v = (c.valores as Record<string, { meta?: number; causado: number }>).produccion_cajas;
    const d = new Date(c.fecha + "T00:00:00Z");
    return { label: d.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", ""), value: v?.causado ?? 0, meta: v?.meta };
  });

  return (
    <div>
      <PageHeader title="Panel en vivo" subtitle="JHS Agroindustria — Consolidado de unidades productivas" action={<ReportButtons />} />

      <div className="px-8 py-6">
        {alertasActivas.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alertasActivas.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium" style={{ background: theme.warningBg, borderColor: theme.warningBorder, color: theme.orangeDeep }}>
                <WarningIcon />
                <span>
                  <strong>{a.titulo}</strong> — {a.detalle}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UnitStat tipo="huevo" accent={unidadColor.huevos} label="Producción Huevos (hoy)" value={`${valHuevos.produccion_cajas?.causado ?? "—"} cj`} hint={`Meta ${valHuevos.produccion_cajas ? "2,900" : ""}`} />
          <UnitStat tipo="pollo" accent={unidadColor.pollo} label="% Mortalidad Pollo" value={`${valPollo.mortalidad?.causado ?? "—"}%`} hint="Meta 5.5%" />
          <UnitStat tipo="cerdo" accent={unidadColor.cerdo} label="Peso Engorde Cerdo" value={`${valCerdo.peso_engorde?.causado ?? "—"} kg`} hint={`Conversión ${valCerdo.conversion_engorde?.causado ?? "—"}`} />
          <UnitStat tipo="aba" accent={unidadColor.aba} label="EBITDA Consolidado (mes)" value={fmtMoney(totalConsolidadoCausado)} hint={`${Math.round((totalConsolidadoCausado / totalConsolidadoMeta) * 100)}% de meta`} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <p className="text-sm font-semibold text-charcoal">Producción de Huevos — últimos días (cajas)</p>
            <Bars3D data={serie7} />
          </Card>
          <Card className="lg:col-span-2">
            <p className="text-sm font-semibold text-charcoal">EBITDA por unidad — julio 2026</p>
            <div style={{ height: 240 }}>
              <OrbitBars3D data={orbitData} />
            </div>
            <div className="mt-2 flex justify-center gap-4">
              {orbitData.map((d) => (
                <span key={d.label} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-6 overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-charcoal">Estado de Resultados — Consolidado (julio 2026)</p>
            <p className="text-xs text-text-muted">
              Margen EBITDA: {((ebitdaPorEmpresa.reduce((s, l) => s + Number(l.causado), 0) / ingresosTotales) * 100).toFixed(1)}%
            </p>
          </div>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="py-2 pr-4">Partida</th>
                {empresasEnOrden.map((u) => (
                  <th key={u} className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: unidadColor[u] }} />
                      {u === "huevos" ? "Huevos" : u === "pollo" ? "Pollo" : "Cerdo"}
                    </span>
                  </th>
                ))}
                <th className="py-2">Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {conceptosOrden.map((concepto) => {
                const linea = edr.find((l) => l.concepto === concepto);
                const esSubtotal = linea?.esSubtotal;
                const valoresPorUnidad = empresasEnOrden.map((u) => edr.find((l) => l.empresaId === empresaIdPorUnidad[u] && l.concepto === concepto));
                const totalFila = valoresPorUnidad.reduce((s, l) => s + Number(l?.causado ?? 0), 0);
                return (
                  <tr key={concepto} className={esSubtotal ? "border-y border-border bg-panel-2 font-bold text-charcoal" : "border-b border-border/60 text-text-muted"}>
                    <td className="py-2 pr-4">{concepto}</td>
                    {valoresPorUnidad.map((l, i) => (
                      <td key={i} className="py-2 pr-4 tabular-nums">
                        {l ? fmtMoney(Number(l.causado)) : "—"}
                      </td>
                    ))}
                    <td className="py-2 tabular-nums">{fmtMoney(totalFila)}</td>
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

function UnitStat({ tipo, accent, label, value, hint }: { tipo: "huevo" | "pollo" | "cerdo" | "aba"; accent: string; label: string; value: string; hint?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ProductIcon3D tipo={tipo} size={64} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{label}</p>
          <p className="mt-1 truncate font-display text-2xl font-bold text-charcoal">{value}</p>
          {hint && <p className="text-xs text-text-muted">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.58 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
