"use client";

import { useMemo, useState } from "react";
import { Card, Badge } from "@/components/ui";

type Evidencia = {
  id: string;
  url: string;
  nombreArchivo: string;
  creadoEn: Date | string;
  tipo: string;
  fecha: string;
  loteCodigo: string;
  galponNombre: string;
  granjaNombre: string;
};

const TIPO_LABEL: Record<string, string> = {
  mortalidad: "Mortalidad",
  descarte: "Descarte",
  alimento: "Consumo ABA",
  pesaje: "Pesaje",
  saque: "Saque",
  beneficio: "Beneficio",
};
const TIPO_TONE: Record<string, "danger" | "orange" | "blue" | "success" | "neutral"> = {
  mortalidad: "danger",
  descarte: "orange",
  alimento: "blue",
  pesaje: "success",
  saque: "neutral",
  beneficio: "neutral",
};

const FILTROS = ["todas", "mortalidad", "descarte", "alimento", "pesaje"] as const;

// Repositorio de Evidencias — el nodo "Evidencia Fotográfica y
// Sincronización" del diagrama de navegación del cliente, visto del lado
// de Gerencia/Coordinación: cada foto que un operario o el Inspector
// Veterinario adjunta en el galponero (Mortalidad, Descarte, Consumo ABA,
// Pesaje) aparece acá organizada por proceso, con su lote/galpón/granja de
// origen, para sustentar los registros sin tener que ir campo por campo.
export default function EvidenciasPanel({ evidencias }: { evidencias: Evidencia[] }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todas");
  const [abierta, setAbierta] = useState<Evidencia | null>(null);

  const filtradas = useMemo(() => (filtro === "todas" ? evidencias : evidencias.filter((e) => e.tipo === filtro)), [evidencias, filtro]);
  const conteos = useMemo(() => {
    const out: Record<string, number> = { todas: evidencias.length };
    for (const e of evidencias) out[e.tipo] = (out[e.tipo] ?? 0) + 1;
    return out;
  }, [evidencias]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-charcoal">Repositorio de Evidencias</p>
          <p className="text-xs text-text-muted">Fotos adjuntas desde el galponero — Mortalidad, Descarte, Consumo ABA y Pesaje</p>
        </div>
        <Badge tone="neutral">{evidencias.length} foto(s) en total</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtro === f ? "bg-orange text-white" : "bg-panel-2 text-text-muted hover:text-charcoal"
            }`}
          >
            {f === "todas" ? "Todas" : TIPO_LABEL[f]} · {conteos[f] ?? 0}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            Sin evidencia fotográfica {filtro !== "todas" ? `de ${TIPO_LABEL[filtro]}` : "registrada"} todavía. Se acumula automáticamente cuando el
            operario adjunta una foto al capturar Mortalidad, Descarte, Consumo ABA o Pesaje desde el galponero.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtradas.map((e) => (
            <button key={e.id} onClick={() => setAbierta(e)} className="group overflow-hidden rounded-2xl border border-border bg-panel text-left shadow-sm">
              <div className="aspect-square w-full overflow-hidden bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt={e.nombreArchivo} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </div>
              <div className="p-3">
                <Badge tone={TIPO_TONE[e.tipo] ?? "neutral"}>{TIPO_LABEL[e.tipo] ?? e.tipo}</Badge>
                <p className="mt-1.5 truncate text-sm font-semibold text-charcoal">
                  {e.granjaNombre} · {e.galponNombre}
                </p>
                <p className="truncate text-xs text-text-faint">Lote {e.loteCodigo} · {e.fecha}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {abierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/80 p-6" onClick={() => setAbierta(null)}>
          <div className="max-h-full max-w-2xl overflow-hidden rounded-2xl bg-panel shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={abierta.url} alt={abierta.nombreArchivo} className="max-h-[70vh] w-full object-contain bg-charcoal" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <Badge tone={TIPO_TONE[abierta.tipo] ?? "neutral"}>{TIPO_LABEL[abierta.tipo] ?? abierta.tipo}</Badge>
                <p className="mt-1 text-sm font-semibold text-charcoal">
                  {abierta.granjaNombre} · {abierta.galponNombre} · Lote {abierta.loteCodigo}
                </p>
                <p className="text-xs text-text-faint">{abierta.fecha}</p>
              </div>
              <button onClick={() => setAbierta(null)} className="rounded-full bg-panel-2 px-3 py-1.5 text-sm font-semibold text-charcoal">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
