"use client";

import { Line3D } from "@/components/charts";
import type { PuntoPesoSerie } from "@/lib/analisis-pollo";

// "Peso Promedio — Real vs. Estándar" por día de ciclo (0-35) — compara el
// estándar genético (curva objetivo) contra el peso real promedio
// reportado ese día en todas las granjas con pesaje registrado.
// Presentación: kit de gráficas de PharmaLab AI.
export default function GraficoPesoRealVsEstandar({ serie }: { serie: PuntoPesoSerie[] }) {
  return (
    <Line3D
      labels={serie.map((p) => `d${p.edadDias}`)}
      series={[
        { name: "Peso real (Ejecutado)", values: serie.map((p) => (p.realGr !== null ? Math.round(p.realGr) : null)), color: "#2f7fd0" },
        { name: "Estándar genético (Proyectado)", values: serie.map((p) => Math.round(p.estandarGr)), color: "#c9962b", dashed: true },
      ]}
      format={(v) => (v == null ? "—" : `${v.toLocaleString("es-PA")} g`)}
      axisFormat={(v) => `${v.toLocaleString("es-PA")} g`}
      height={280}
      label="Peso promedio real contra estándar"
    />
  );
}
