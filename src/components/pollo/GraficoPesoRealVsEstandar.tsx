"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { theme } from "@/lib/theme";
import type { PuntoPesoSerie } from "@/lib/analisis-pollo";

// "Peso Promedio — Real vs. Estándar" por día de ciclo (0-35) — compara el
// estándar genético (curva objetivo) contra el peso real promedio
// reportado ese día en todas las granjas con pesaje registrado.
export default function GraficoPesoRealVsEstandar({ serie }: { serie: PuntoPesoSerie[] }) {
  const data = serie.map((p) => ({
    dia: `d${p.edadDias}`,
    "Estándar genético (Proyectado)": Math.round(p.estandarGr),
    "Peso real (Ejecutado)": p.realGr !== null ? Math.round(p.realGr) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.border} />
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: theme.inkSoft }} />
        <YAxis tick={{ fontSize: 11, fill: theme.inkSoft }} tickFormatter={(v) => `${v}g`} />
        <Tooltip formatter={((v: unknown) => (v === null || v === undefined ? "—" : `${v} g`)) as any} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="Estándar genético (Proyectado)" stroke={theme.blue} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="Peso real (Ejecutado)" stroke={theme.orange} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
