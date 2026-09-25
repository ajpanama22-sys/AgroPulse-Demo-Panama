"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button } from "@/components/ui";

type Conciliacion = {
  id: string;
  loteCodigo: string;
  granjaNombre: string;
  fecha: string;
  avesReportadasGranja: number;
  kgReportadosGranja: string;
  avesReportadasPlanta: number;
  kgReportadosPlanta: string;
  desviacionAvesPct: string;
  desviacionPesoPct: string;
  estado: "pendiente" | "aprobado" | "bloqueado";
};

const ESTADO_TONE = { aprobado: "success", bloqueado: "danger", pendiente: "orange" } as const;

// "Workflow de Conciliación" — Reportado por Granja vs. Reportado por
// Planta, con bloqueo automático fuera de tolerancia (2%) y aprobación
// explícita de Coordinación Central. Historial abajo, igual que el mockup.
export default function ConciliacionPanel({ conciliaciones, puedeAprobar }: { conciliaciones: Conciliacion[]; puedeAprobar: boolean }) {
  const router = useRouter();
  const [aprobando, setAprobando] = useState<string | null>(null);
  const destacada = conciliaciones.find((c) => c.estado === "bloqueado") ?? conciliaciones[0];

  async function aprobar(id: string) {
    setAprobando(id);
    try {
      await fetch(`/api/pollo/conciliaciones/${id}/aprobar`, { method: "POST" });
      router.refresh();
    } finally {
      setAprobando(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {destacada && (
        <Card>
          <p className="text-sm font-semibold text-charcoal">Workflow de Conciliación — Lote {destacada.loteCodigo}, {destacada.granjaNombre}</p>
          <p className="text-xs text-text-muted">Cierre de lote vs. reporte de Planta Beneficiadora</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-panel-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Reportado por Granja</p>
              <p className="mt-1 text-lg font-bold text-charcoal">
                {Number(destacada.avesReportadasGranja).toLocaleString("es-PA")} aves · {Number(destacada.kgReportadosGranja).toLocaleString("es-PA")} kg
              </p>
            </div>
            <div className="rounded-xl border border-border bg-panel-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Reportado por Planta</p>
              <p className="mt-1 text-lg font-bold text-charcoal">
                {Number(destacada.avesReportadasPlanta).toLocaleString("es-PA")} aves · {Number(destacada.kgReportadosPlanta).toLocaleString("es-PA")} kg
              </p>
            </div>
            <div className="rounded-xl border border-border bg-panel-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Desviación</p>
              <p className="mt-1 text-lg font-bold text-danger">
                {destacada.desviacionAvesPct}% aves · {destacada.desviacionPesoPct}% peso
              </p>
            </div>
          </div>

          {destacada.estado === "bloqueado" && (
            <div className="mt-4 rounded-xl border border-[var(--warning-border,#f4c98b)] bg-[var(--warning-bg,#fdf0e0)] px-4 py-3">
              <p className="text-sm font-semibold text-orange-deep">Alerta: desviación fuera del umbral de tolerancia (2%) — requiere aprobación</p>
              {puedeAprobar && (
                <Button className="mt-3" onClick={() => aprobar(destacada.id)} disabled={aprobando === destacada.id}>
                  {aprobando === destacada.id ? "Aprobando…" : "Aprobar cierre de todas formas"}
                </Button>
              )}
            </div>
          )}
          {destacada.estado === "aprobado" && (
            <div className="mt-4 rounded-xl border border-[var(--success-dim)] bg-[var(--success-dim)] px-4 py-3 text-sm font-semibold text-success">
              Dentro del umbral de tolerancia (2%) — no requiere bloqueo
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-x-auto">
        <p className="mb-3 text-sm font-semibold text-charcoal">Histórico de conciliaciones</p>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
              <th className="py-2 pr-4">Lote</th>
              <th className="py-2 pr-4">Granja</th>
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Desv. Aves</th>
              <th className="py-2 pr-4">Desv. Peso</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {conciliaciones.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium text-charcoal">{c.loteCodigo}</td>
                <td className="py-2 pr-4 text-text-muted">{c.granjaNombre}</td>
                <td className="py-2 pr-4 text-text-muted">{c.fecha}</td>
                <td className="py-2 pr-4 tabular-nums text-charcoal">{c.desviacionAvesPct}%</td>
                <td className="py-2 pr-4 tabular-nums text-charcoal">{c.desviacionPesoPct}%</td>
                <td className="py-2">
                  <Badge tone={ESTADO_TONE[c.estado]}>{c.estado === "aprobado" ? "Aprobado" : c.estado === "bloqueado" ? "Bloqueado" : "Pendiente"}</Badge>
                </td>
              </tr>
            ))}
            {conciliaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-text-muted">Sin conciliaciones registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
