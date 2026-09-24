import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lotesPollo, loteEventosPollo, ubicaciones } from "@/lib/db/schema";
import { Card, PageHeader, Badge, StatTile } from "@/components/ui";
import { theme } from "@/lib/theme";
import Donut3D from "@/components/Donut3D";
import Bars3D from "@/components/Bars3D";
import ProductIcon3D from "@/components/ProductIcon3D";
import {
  edadDelLote,
  avesVivas,
  pctViabilidad,
  pctMortalidad,
  pesoPromedioActualKg,
  conversionActual,
  ieeActual,
  clasificacionBeneficio,
  type LotePollo,
  type EventoLote,
} from "@/lib/analisis-pollo";

// Fecha de referencia del demo (mismo "hoy" sintético que usa el resto del
// panel — la captura más reciente sembrada es 2026-08-28). Se fija acá en
// vez de usar `new Date()` para que la edad/IEE del lote activo no se
// "envejezcan" con el reloj real del servidor.
const HOY_DEMO = new Date("2026-08-29T00:00:00Z");

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "alojamiento", label: "Alojamiento" },
  { key: "captura", label: "Captura Diaria" },
  { key: "beneficio", label: "Beneficio & Cierre" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function fmt(n: number | null, digits = 0) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-PA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const TIPO_LABEL: Record<string, string> = {
  mortalidad: "Mortalidad",
  pesaje: "Pesaje muestral",
  alimento: "Alimento",
  saque: "Saque",
  beneficio: "Beneficio",
};
const TIPO_TONE: Record<string, "danger" | "blue" | "orange" | "success" | "neutral"> = {
  mortalidad: "danger",
  pesaje: "blue",
  alimento: "orange",
  saque: "neutral",
  beneficio: "success",
};

export default async function PolloPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key ?? "resumen") as TabKey;

  const ubic = await db.select().from(ubicaciones);
  const galpon = ubic.find((u) => u.nombre.toLowerCase().includes("engorde")) ?? ubic.find((u) => u.subUnidad === "POLLO");

  const lotes = galpon ? await db.select().from(lotesPollo).where(eq(lotesPollo.ubicacionId, galpon.id)) : [];
  const loteActivo = (lotes.find((l) => l.estado === "activo") ?? null) as LotePollo | null;
  const loteCerrado = (lotes.find((l) => l.estado === "cerrado") ?? null) as LotePollo | null;

  const loteIds = lotes.map((l) => l.id);
  const eventos = loteIds.length ? await db.select().from(loteEventosPollo).where(inArray(loteEventosPollo.loteId, loteIds)).orderBy(asc(loteEventosPollo.fecha)) : [];

  const eventosDe = (loteId: string | undefined) => (eventos.filter((e) => e.loteId === loteId) as unknown as EventoLote[]) ?? [];
  const eventosActivo = eventosDe(loteActivo?.id);
  const eventosCerrado = eventosDe(loteCerrado?.id);

  // Indicadores derivados del lote activo — calculados en vivo a partir de
  // sus eventos reales (nunca tipeados a mano).
  const edad = loteActivo ? edadDelLote(loteActivo, HOY_DEMO) : null;
  const vivas = loteActivo ? avesVivas(loteActivo, eventosActivo) : null;
  const viabilidad = loteActivo ? pctViabilidad(loteActivo, eventosActivo) : null;
  const mortalidadPct = loteActivo ? pctMortalidad(loteActivo, eventosActivo) : null;
  const pesoKg = loteActivo ? pesoPromedioActualKg(eventosActivo) : null;
  const conversion = loteActivo ? conversionActual(loteActivo, eventosActivo) : null;
  const iee = loteActivo ? ieeActual(loteActivo, eventosActivo, HOY_DEMO) : null;

  const mortalidadSemanal = eventosActivo
    .filter((e) => e.tipo === "mortalidad")
    .map((e) => ({ label: `d${e.edadDias}`, value: e.mortalidadCantidad ?? 0 }));

  const clasificacionCerrado = loteCerrado ? clasificacionBeneficio(loteCerrado) : [];

  return (
    <div>
      <PageHeader
        title="Pollo de Engorde"
        subtitle={galpon ? `${galpon.nombre} — Agroindustrias del Istmo` : "Línea de negocio — Pollo"}
        action={
          <div className="shrink-0">
            <ProductIcon3D tipo="pollo" size={56} />
          </div>
        }
      />

      <div className="border-b border-border px-8">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={`?tab=${t.key}`}
              className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? "border-b-2 border-orange text-orange" : "text-text-muted hover:text-charcoal"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="px-8 py-6">
        {!galpon && (
          <Card>
            <p className="text-sm text-text-muted">No se encontró la ubicación de Pollo Engorde en el sistema.</p>
          </Card>
        )}

        {galpon && tab === "resumen" && (
          <>
            {loteActivo && (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone="blue">Lote activo — {loteActivo.codigo}</Badge>
                  <span className="text-xs text-text-muted">Genética {loteActivo.genetica.replace("_", " ").toUpperCase()} · Alojado {loteActivo.fechaAlojamiento}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <StatTile label="Edad" value={`${edad ?? "—"} d`} accent={theme.blue} />
                  <StatTile label="Aves vivas" value={fmt(vivas)} accent={theme.blue} />
                  <StatTile label="Viabilidad" value={viabilidad !== null ? `${viabilidad.toFixed(1)}%` : "—"} accent={theme.success} />
                  <StatTile label="Mortalidad acum." value={mortalidadPct !== null ? `${mortalidadPct.toFixed(1)}%` : "—"} accent={theme.danger} />
                  <StatTile label="Peso promedio" value={pesoKg !== null ? `${pesoKg.toFixed(2)} kg` : "—"} accent={theme.orange} />
                  <StatTile label="Conversión" value={conversion !== null ? conversion.toFixed(2) : "—"} hint={iee !== null ? `I.E.E. ${iee.toFixed(0)}` : undefined} accent={theme.orange} />
                </div>
              </>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <p className="text-sm font-semibold text-charcoal">Mortalidad por evento — lote activo {loteActivo?.codigo}</p>
                {mortalidadSemanal.length > 0 ? <Bars3D data={mortalidadSemanal} /> : <p className="py-8 text-center text-sm text-text-muted">Sin eventos de mortalidad registrados.</p>}
              </Card>
              <Card className="lg:col-span-2">
                <p className="text-sm font-semibold text-charcoal">Clasificación al beneficio — lote cerrado {loteCerrado?.codigo}</p>
                {clasificacionCerrado.length > 0 ? (
                  <>
                    <div style={{ height: 220 }} className="flex justify-center">
                      <Donut3D data={clasificacionCerrado} size={220} />
                    </div>
                    <div className="mt-2 flex justify-center gap-4">
                      {clasificacionCerrado.map((d) => (
                        <span key={d.label} className="flex items-center gap-1.5 text-xs text-text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.label} {d.value}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-text-muted">Aún no hay un lote cerrado.</p>
                )}
              </Card>
            </div>

            {loteCerrado && (
              <Card className="mt-6">
                <p className="mb-3 text-sm font-semibold text-charcoal">Lote cerrado {loteCerrado.codigo} — resultado final</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <StatTile label="Aves a beneficio" value={fmt(loteCerrado.avesBeneficio)} />
                  <StatTile label="Kg beneficiados" value={fmt(Number(loteCerrado.kgBeneficiados))} />
                  <StatTile label="% Pollo A" value={`${loteCerrado.pctPolloA}%`} />
                  <StatTile label="% Pollo B" value={`${loteCerrado.pctPolloB}%`} />
                  <StatTile label="Conversión final" value={String(loteCerrado.conversion)} />
                  <StatTile label="I.E.E. final" value={String(loteCerrado.iee)} />
                </div>
              </Card>
            )}
          </>
        )}

        {galpon && tab === "alojamiento" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {lotes.map((l) => (
              <Card key={l.id}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-charcoal">{l.codigo}</p>
                  <Badge tone={l.estado === "activo" ? "blue" : "success"}>{l.estado === "activo" ? "En curso" : "Cerrado"}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-text-muted">Galpón</dt>
                  <dd className="text-right font-medium text-charcoal">{galpon.nombre}</dd>
                  <dt className="text-text-muted">Genética</dt>
                  <dd className="text-right font-medium text-charcoal">{l.genetica.replace("_", " ").toUpperCase()}</dd>
                  <dt className="text-text-muted">Fecha de alojamiento</dt>
                  <dd className="text-right font-medium text-charcoal">{l.fechaAlojamiento}</dd>
                  <dt className="text-text-muted">Población inicial</dt>
                  <dd className="text-right font-medium text-charcoal">{fmt(l.poblacionInicial)} aves</dd>
                  <dt className="text-text-muted">Peso inicial</dt>
                  <dd className="text-right font-medium text-charcoal">{l.pesoInicialGr ?? "—"} g</dd>
                  {l.fechaCierre && (
                    <>
                      <dt className="text-text-muted">Fecha de cierre</dt>
                      <dd className="text-right font-medium text-charcoal">{l.fechaCierre}</dd>
                    </>
                  )}
                </dl>
              </Card>
            ))}
          </div>
        )}

        {galpon && tab === "captura" && (
          <Card className="overflow-x-auto">
            <p className="mb-3 text-sm font-semibold text-charcoal">Eventos de campo — lote activo {loteActivo?.codigo}</p>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Edad</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventosActivo.map((e, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-text-muted">{e.fecha}</td>
                    <td className="py-2 pr-4 text-text-muted">{e.edadDias ?? "—"} d</td>
                    <td className="py-2 pr-4">
                      <Badge tone={TIPO_TONE[e.tipo] ?? "neutral"}>{TIPO_LABEL[e.tipo] ?? e.tipo}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-charcoal">
                      {e.tipo === "mortalidad" && `${e.mortalidadCantidad} aves`}
                      {e.tipo === "pesaje" && `${e.pesoMuestraGr} g (muestra)`}
                      {e.tipo === "alimento" && `${e.alimentoConsumidoKg} kg consumidos`}
                    </td>
                  </tr>
                ))}
                {eventosActivo.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-text-muted">
                      Sin eventos registrados aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {galpon && tab === "beneficio" && (
          <Card className="overflow-x-auto">
            <p className="mb-3 text-sm font-semibold text-charcoal">Saques y beneficio — lote cerrado {loteCerrado?.codigo}</p>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Aves</th>
                  <th className="py-2 pr-4">Kg</th>
                  <th className="py-2 pr-4">Clasificación</th>
                  <th className="py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {eventosCerrado
                  .filter((e) => e.tipo === "saque" || e.tipo === "beneficio")
                  .map((e, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2 pr-4 text-text-muted">{e.fecha}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={TIPO_TONE[e.tipo] ?? "neutral"}>{TIPO_LABEL[e.tipo] ?? e.tipo}</Badge>
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-charcoal">{fmt(e.avesMovidas)}</td>
                      <td className="py-2 pr-4 tabular-nums text-charcoal">{fmt(e.kgMovidos !== null ? Number(e.kgMovidos) : null)}</td>
                      <td className="py-2 pr-4 text-charcoal">{e.clasificacion ?? "—"}</td>
                      <td className="py-2 text-text-muted">{e.observaciones ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
