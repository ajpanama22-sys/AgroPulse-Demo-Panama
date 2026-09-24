import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ubicaciones, ubicacionIndicadores, indicadores, capturas, auditoria, empresas, unidadesNegocio } from "@/lib/db/schema";
import { Card, PageHeader, Badge } from "@/components/ui";

const FECHA_REPORTE = "2026-08-28";

export default async function AuditoriaPage() {
  const [ubic, todosLosIndicadoresPorUbicacion, capturasDelDia, log] = await Promise.all([
    db
      .select({ id: ubicaciones.id, nombre: ubicaciones.nombre, subUnidad: ubicaciones.subUnidad, unidadNombre: unidadesNegocio.nombre })
      .from(ubicaciones)
      .innerJoin(empresas, eq(empresas.id, ubicaciones.empresaId))
      .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
      .where(eq(ubicaciones.activa, true)),
    db
      .select({ ubicacionId: ubicacionIndicadores.ubicacionId, clave: indicadores.clave, etiqueta: indicadores.etiqueta })
      .from(ubicacionIndicadores)
      .innerJoin(indicadores, eq(indicadores.id, ubicacionIndicadores.indicadorId)),
    db.select().from(capturas).where(eq(capturas.fecha, FECHA_REPORTE)),
    db.select().from(auditoria).orderBy(desc(auditoria.creadoEn)).limit(40),
  ]);

  const cumplimiento = ubic.map((u) => {
    const esperados = todosLosIndicadoresPorUbicacion.filter((i) => i.ubicacionId === u.id);
    const captura = capturasDelDia.find((c) => c.ubicacionId === u.id);
    if (!captura) return { ubicacion: u, estado: "no_enviado" as const, faltantes: esperados.map((e) => e.etiqueta), sincronizadoEn: null };
    const valores = captura.valores as Record<string, { causado: number }>;
    const faltantes = esperados.filter((e) => valores[e.clave]?.causado === undefined).map((e) => e.etiqueta);
    return { ubicacion: u, estado: faltantes.length === 0 ? ("completo" as const) : ("incompleto" as const), faltantes, sincronizadoEn: captura.sincronizadoEn };
  });

  return (
    <div>
      <PageHeader title="Auditoría" subtitle={`Cumplimiento de captura diaria (${FECHA_REPORTE}) y bitácora de acciones`} />
      <div className="px-8 py-6">
        <Card className="overflow-x-auto">
          <p className="mb-3 text-sm font-semibold text-charcoal">Reporte diario de cumplimiento por dispositivo/ubicación</p>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="py-2 pr-4">Ubicación</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Sincronizado</th>
                <th className="py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cumplimiento.map((c) => (
                <tr key={c.ubicacion.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-medium text-charcoal">
                    {c.ubicacion.unidadNombre} · {c.ubicacion.nombre}
                    {c.ubicacion.subUnidad ? ` · ${c.ubicacion.subUnidad}` : ""}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={c.estado === "completo" ? "success" : c.estado === "incompleto" ? "orange" : "danger"}>
                      {c.estado === "completo" ? "Completo" : c.estado === "incompleto" ? "Incompleto" : "No enviado"}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{c.sincronizadoEn ? new Date(c.sincronizadoEn).toLocaleTimeString("es-PA") : "—"}</td>
                  <td className="py-2.5 text-xs text-text-muted">{c.faltantes.length > 0 ? `Falta: ${c.faltantes.join(", ")}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="mt-6 overflow-x-auto">
          <p className="mb-3 text-sm font-semibold text-charcoal">Bitácora de acciones</p>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Acción</th>
                <th className="py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 whitespace-nowrap text-text-muted">{new Date(l.creadoEn).toLocaleString("es-PA")}</td>
                  <td className="py-2 pr-4 font-medium text-charcoal">{l.actorNombre}</td>
                  <td className="py-2 pr-4">
                    <Badge tone="neutral">{l.accion}</Badge>
                  </td>
                  <td className="py-2 text-xs text-text-muted">{l.detalle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
