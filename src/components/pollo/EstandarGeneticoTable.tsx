"use client";

import { useState } from "react";
import { Card, Badge } from "@/components/ui";

type Fila = { genetica: "cobb_500" | "ross" | "hubbard"; edadDias: number; pesoEstandarGr: number; fuente: string | null };

const NOMBRE_RAZA: Record<Fila["genetica"], string> = { cobb_500: "Cobb 500", ross: "Ross 308", hubbard: "Hubbard 1,2" };

// Tabla editable de Estándar Genético — mismo espíritu que el Excel de
// Registro de Granja ("celdas amarillas = editables"). Cobb 500 y Ross 308
// comparten curva en El Dorado (confirmado por el cliente); Hubbard queda
// marcada como estimada hasta que se confirme la tabla oficial.
export default function EstandarGeneticoTable({ filas }: { filas: Fila[] }) {
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(filas.map((f) => [`${f.genetica}-${f.edadDias}`, f.pesoEstandarGr]))
  );
  const [guardando, setGuardando] = useState<string | null>(null);
  const edades = Array.from(new Set(filas.map((f) => f.edadDias))).sort((a, b) => a - b);

  async function guardar(genetica: Fila["genetica"], edadDias: number, pesoEstandarGr: number) {
    const key = `${genetica}-${edadDias}`;
    setGuardando(key);
    try {
      await fetch("/api/pollo/estandar-genetico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genetica, edadDias, pesoEstandarGr }),
      });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Card className="overflow-x-auto">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-charcoal">Estándar Genético — peso objetivo (g) por edad</p>
        <Badge tone="orange">Celdas editables</Badge>
      </div>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
            <th className="py-2 pr-4">Raza</th>
            {edades.map((e) => (
              <th key={e} className="py-2 pr-4 text-right">{e}d</th>
            ))}
            <th className="py-2 pr-4">Fuente</th>
          </tr>
        </thead>
        <tbody>
          {(["cobb_500", "ross", "hubbard"] as const).map((genetica) => (
            <tr key={genetica} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium text-charcoal">{NOMBRE_RAZA[genetica]}</td>
              {edades.map((edadDias) => {
                const key = `${genetica}-${edadDias}`;
                return (
                  <td key={key} className="py-2 pr-4 text-right">
                    <input
                      inputMode="numeric"
                      value={valores[key] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [key]: Number(e.target.value) }))}
                      onBlur={(e) => guardar(genetica, edadDias, Number(e.target.value))}
                      className={`w-16 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-orange ${
                        guardando === key ? "border-orange bg-orange-dim" : "border-border bg-[var(--warning-bg,#fdf8ec)]"
                      }`}
                    />
                  </td>
                );
              })}
              <td className="py-2 pr-4 max-w-[280px] truncate text-xs text-text-faint" title={filas.find((f) => f.genetica === genetica)?.fuente ?? ""}>
                {genetica === "hubbard" ? "Estimado — verificar con proveedor" : "Registro de Granja — El Dorado"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
