// Hub central de Reportes — antes el sistema solo tenía "Análisis"
// (comparativos en pantalla) y dos botones sueltos de exportación en el
// Panel/Análisis. Esta página reúne TODOS los reportes reales del sistema
// completo: Financiero (EDR), Pollo de Engorde, Operativo (captura diaria
// de Huevos/Cerdo), Inventario de Insumos y Auditoría — cada uno con su
// versión Excel (para trabajar los datos en una tabla dinámica) y, donde
// aplica, su versión PDF para gerencia con gráficas 3D de donas y barras.
import { db } from "@/lib/db/client";
import { ubicaciones } from "@/lib/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { periodosEdrDisponibles, lotesPolloConUbicacion } from "@/lib/reportes-data";
import { etiquetaBucket } from "@/lib/analisis";

function ReportCard({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <p className="font-display text-base font-bold text-charcoal">{titulo}</p>
      <p className="mt-1 text-sm text-text-muted">{descripcion}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function BotonExcel({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-panel-2">
      📊 Excel
    </a>
  );
}

function BotonPdf({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--orange-bright)]">
      📄 PDF con gráficas 3D
    </a>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [periodos, lotes, ubic] = await Promise.all([periodosEdrDisponibles(), lotesPolloConUbicacion(), db.select({ id: ubicaciones.id, nombre: ubicaciones.nombre }).from(ubicaciones)]);

  const ultimo = periodos[periodos.length - 1];
  const desde = sp.desde && periodos.includes(sp.desde) ? sp.desde : periodos[0];
  const hasta = sp.hasta && periodos.includes(sp.hasta) ? sp.hasta : ultimo;
  const qsFinanciero = new URLSearchParams({ desde, hasta }).toString();

  const loteId = sp.loteId ?? "";
  const qsPollo = loteId ? new URLSearchParams({ loteId }).toString() : "";

  const desdeOp = sp.desdeOp ?? "2000-01-01";
  const hastaOp = sp.hastaOp ?? "2100-01-01";
  const ubicacionId = sp.ubicacionId ?? "";
  const qsOperativo = new URLSearchParams({ desde: desdeOp, hasta: hastaOp, ...(ubicacionId ? { ubicacionId } : {}) }).toString();

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Excel para trabajar los datos y PDF ejecutivo con gráficas 3D de donas y barras — cubre todo lo que maneja el sistema." />
      <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-2">
        <ReportCard titulo="Financiero (EDR)" descripcion="Estado de Resultados por unidad de negocio y consolidado — detalle listo para tabla dinámica en Excel, o PDF ejecutivo con dona y barras 3D de EBITDA/ingresos.">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Desde</span>
              <select name="desde" defaultValue={desde} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    {etiquetaBucket(p, "mes")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Hasta</span>
              <select name="hasta" defaultValue={hasta} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    {etiquetaBucket(p, "mes")}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white">
              Aplicar rango
            </button>
          </form>
          <div className="flex flex-wrap gap-3">
            <BotonExcel href={`/api/reportes/excel?${qsFinanciero}`} />
            <BotonPdf href={`/api/reportes/pdf?${qsFinanciero}`} />
          </div>
        </ReportCard>

        <ReportCard titulo="Pollo de Engorde" descripcion="Comparativo entre lotes, mortalidad por causa y detalle crudo de eventos (mortalidad, pesaje, alimento) — o PDF ejecutivo con dona 3D de mortalidad por causa y barras 3D de aves vivas.">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Lote</span>
              <select name="loteId" defaultValue={loteId} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <option value="">Todos los lotes</option>
                {lotes.map((l) => (
                  <option key={l.lote.id} value={l.lote.id}>
                    {l.lote.codigo} ({l.lote.estado === "activo" ? "Activo" : "Cerrado"})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white">
              Aplicar
            </button>
          </form>
          <div className="flex flex-wrap gap-3">
            <BotonExcel href={`/api/reportes/pollo/excel${qsPollo ? `?${qsPollo}` : ""}`} />
            <BotonPdf href={`/api/reportes/pollo/pdf${qsPollo ? `?${qsPollo}` : ""}`} />
          </div>
        </ReportCard>

        <ReportCard titulo="Operativo (Captura de Campo)" descripcion="Detalle crudo de la captura diaria de Huevos y Cerdo — auditable fila por fila, filtrable por ubicación y rango de fechas.">
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Desde</span>
              <input type="date" name="desdeOp" defaultValue={sp.desdeOp ?? ""} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Hasta</span>
              <input type="date" name="hastaOp" defaultValue={sp.hastaOp ?? ""} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Ubicación</span>
              <select name="ubicacionId" defaultValue={ubicacionId} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <option value="">Todas</option>
                {ubic.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white">
              Aplicar
            </button>
          </form>
          <div className="flex flex-wrap gap-3">
            <BotonExcel href={`/api/reportes/operativo/excel?${qsOperativo}`} />
          </div>
        </ReportCard>

        <ReportCard titulo="Inventario de Insumos" descripcion="Alcance de días por insumo, con marca de crítico — la misma base que alimenta las alertas de inventario del panel.">
          <div className="flex flex-wrap gap-3">
            <BotonExcel href="/api/reportes/inventario/excel" />
          </div>
        </ReportCard>

        <ReportCard titulo="Auditoría" descripcion="Bitácora completa de acciones del sistema — quién hizo qué y cuándo, evidencia de trazabilidad ante el cliente.">
          <div className="flex flex-wrap gap-3">
            <BotonExcel href="/api/reportes/auditoria/excel" />
          </div>
        </ReportCard>
      </div>
    </div>
  );
}
