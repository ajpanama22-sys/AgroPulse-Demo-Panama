"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from "recharts";
import { theme } from "@/lib/theme";
import type { IndicadorComparado } from "@/lib/analisis-pollo";

// "% Cumplimiento por indicador" — Ejecutado vs. Proyectado de los 8
// indicadores productivos del dashboard. Verde >=95%, naranja 90-94%, rojo
// <90% — mismo umbral que el semáforo de "Seguimiento de Lotes".
export default function GraficoCumplimiento({ indicadores }: { indicadores: IndicadorComparado[] }) {
  const data = indicadores.map((i) => ({ nombre: i.etiqueta, pct: Math.round(i.pctCumplimiento) }));
  const colorDe = (pct: number) => (pct >= 95 ? theme.success : pct >= 90 ? theme.orange : theme.danger);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.border} />
        <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: theme.inkSoft }} interval={0} angle={-12} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: theme.inkSoft }} domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
        <ReferenceLine y={100} stroke={theme.border} />
        <Tooltip formatter={((v: unknown) => [`${v}%`, "% Cumplimiento"]) as any} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
        <Bar dataKey="pct" radius={[6, 6, 0, 0]} label={{ position: "top", fontSize: 11, fill: theme.ink, formatter: ((v: unknown) => `${v}%`) as any }}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorDe(d.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
