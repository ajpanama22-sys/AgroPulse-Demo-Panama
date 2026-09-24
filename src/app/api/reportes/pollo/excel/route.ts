// Reporte de Pollo de Engorde (Excel) — el reporte que faltaba por
// completo: hasta ahora el módulo de Pollo (con datos reales de lote y
// eventos) no tenía ningún export propio, solo se veía en pantalla.
// Trae tres hojas: comparativo entre lotes, resumen del/de los lote(s)
// seleccionado(s), y el detalle crudo de eventos (auditable evento por
// evento, igual que la pestaña "Captura Diaria" del módulo).
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOrganizacion, lotesPolloConUbicacion, eventosDeLote, resumenLote, mortalidadPorCausa, fmtFechaLarga } from "@/lib/reportes-data";
import type { LotePollo } from "@/lib/analisis-pollo";

const ETIQUETA_TIPO: Record<string, string> = { mortalidad: "Mortalidad", pesaje: "Pesaje muestral", alimento: "Alimento", saque: "Saque", beneficio: "Beneficio" };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const loteIdFiltro = sp.get("loteId"); // null = todos los lotes
  const hoy = new Date();

  const [lotesInfo, org] = await Promise.all([lotesPolloConUbicacion(), getOrganizacion()]);
  const lotes = loteIdFiltro ? lotesInfo.filter((l) => l.lote.id === loteIdFiltro) : lotesInfo;
  if (lotes.length === 0) return new Response("No hay lotes de Pollo de Engorde cargados", { status: 404 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["AgroPulse — Reporte de Pollo de Engorde"],
      ["Cliente", org?.nombre ?? "—"],
      ["Lote(s)", loteIdFiltro ? lotes[0]?.lote.codigo ?? loteIdFiltro : "Todos"],
      ["Generado", fmtFechaLarga()],
    ]),
    "Portada",
  );

  const comparativoRows = [];
  const resumenSheetsData: { codigo: string; rows: Record<string, string | number>[] }[] = [];
  const eventosRows: Record<string, string | number>[] = [];

  for (const { lote, ubicacionNombre, empresaNombre } of lotes) {
    const eventos = await eventosDeLote(lote.id);
    const r = resumenLote(lote as unknown as LotePollo, eventos, hoy);
    const causas = mortalidadPorCausa(eventos);

    comparativoRows.push({
      Lote: lote.codigo,
      Estado: lote.estado === "activo" ? "Activo" : "Cerrado",
      Ubicación: ubicacionNombre,
      Empresa: empresaNombre,
      Genética: lote.genetica,
      "Fecha Alojamiento": lote.fechaAlojamiento,
      "Fecha Cierre": lote.fechaCierre ?? "",
      "Población Inicial": lote.poblacionInicial,
      "Edad (días)": r.edadDias,
      "Aves Vivas": r.avesVivas,
      "% Viabilidad": +r.pctViabilidad.toFixed(2),
      "% Mortalidad": +r.pctMortalidad.toFixed(2),
      "Mortalidad Acumulada (aves)": r.mortalidadAcumulada,
      "Peso Promedio Actual (kg)": r.pesoPromedioKg !== null ? +r.pesoPromedioKg.toFixed(3) : "",
      "Alimento Acumulado (kg)": +r.alimentoAcumuladoKg.toFixed(1),
      Conversión: r.conversion !== null ? +r.conversion.toFixed(3) : "",
      "I.E.E.": r.iee !== null ? +r.iee.toFixed(1) : "",
      "% Pollo A (cierre)": lote.pctPolloA !== null ? Number(lote.pctPolloA) : "",
      "% Pollo B (cierre)": lote.pctPolloB !== null ? Number(lote.pctPolloB) : "",
      "% Merma (cierre)": lote.pctMerma !== null ? Number(lote.pctMerma) : "",
      "Conversión Final (cierre)": lote.conversion !== null ? Number(lote.conversion) : "",
      "I.E.E. Final (cierre)": lote.iee !== null ? Number(lote.iee) : "",
    });

    resumenSheetsData.push({
      codigo: lote.codigo,
      rows: causas.map((c) => ({ Causa: c.etiqueta, "Aves Muertas": c.cantidad, "% del Total": r.mortalidadAcumulada ? +((c.cantidad / r.mortalidadAcumulada) * 100).toFixed(1) : 0 })),
    });

    for (const e of eventos) {
      eventosRows.push({
        Lote: lote.codigo,
        Fecha: e.fecha,
        "Edad (días)": e.edadDias ?? "",
        Tipo: ETIQUETA_TIPO[e.tipo] ?? e.tipo,
        "Mortalidad (aves)": e.mortalidadCantidad ?? "",
        "Causa Mortalidad": (e as unknown as { mortalidadCausa: string | null }).mortalidadCausa ?? "",
        "Peso Muestra (gr)": e.pesoMuestraGr ?? "",
        "Tamaño Muestra": (e as unknown as { tamanoMuestra: number | null }).tamanoMuestra ?? "",
        "Alimento Consumido (kg)": e.alimentoConsumidoKg ?? "",
        "Aves Movidas": e.avesMovidas ?? "",
        "Kg Movidos": e.kgMovidos ?? "",
        Clasificación: e.clasificacion ?? "",
        Observaciones: e.observaciones ?? "",
      });
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comparativoRows), "Comparativo de Lotes");

  for (const { codigo, rows } of resumenSheetsData) {
    if (rows.length === 0) continue;
    const nombreHoja = `Mortalidad x Causa ${codigo}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), nombreHoja);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventosRows), "Eventos (detalle crudo)");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Pollo-${loteIdFiltro ? lotes[0]?.lote.codigo : "Todos-los-lotes"}.xlsx"`,
    },
  });
}
