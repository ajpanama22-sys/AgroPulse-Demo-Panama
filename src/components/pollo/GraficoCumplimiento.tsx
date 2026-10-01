"use client";

import { Bar3D, pos, neg, warn } from "@/components/charts";
import type { IndicadorComparado } from "@/lib/analisis-pollo";

// "% Cumplimiento por indicador" — Ejecutado vs. Proyectado de los 8
// indicadores productivos del dashboard. Verde >=95%, naranja 90-94%, rojo
// <90% — mismo umbral que el semáforo de "Seguimiento de Lotes".
// Presentación: kit de gráficas de PharmaLab AI.
export default function GraficoCumplimiento({ indicadores }: { indicadores: IndicadorComparado[] }) {
  const items = indicadores.map((i) => {
    const pct = Math.round(i.pctCumplimiento);
    return { label: i.etiqueta, value: pct, color: pct >= 95 ? pos : pct >= 90 ? warn : neg, note: `Proyectado ${i.proyectado.toLocaleString("es-PA", { maximumFractionDigits: 2 })} · Ejecutado ${i.ejecutado.toLocaleString("es-PA", { maximumFractionDigits: 2 })} ${i.unidad}` };
  });
  return <Bar3D items={items} format={(v) => `${v ?? 0} %`} axisFormat={(v) => `${v} %`} height={280} label="% Cumplimiento por indicador" />;
}
