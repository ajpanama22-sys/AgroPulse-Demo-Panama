// Reporte de Inventario de Insumos (Excel) — alcance de días por insumo,
// con marca de crítico (alcance por debajo del mínimo configurado). No
// existía ningún export de esto hasta ahora, solo se veía en el panel de
// alertas.
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOrganizacion, inventarioConAlcance, fmtFechaLarga } from "@/lib/reportes-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });
  void req;

  const [inventario, org] = await Promise.all([inventarioConAlcance(), getOrganizacion()]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["AgroPulse — Reporte de Inventario de Insumos"],
      ["Cliente", org?.nombre ?? "—"],
      ["Generado", fmtFechaLarga()],
    ]),
    "Portada",
  );

  const rows = inventario
    .slice()
    .sort((a, b) => a.alcanceDias - b.alcanceDias)
    .map((i) => ({
      Insumo: i.insumo,
      "Unidad de Medida": i.unidadMedida,
      "Última Lectura": i.fecha ?? "",
      "Inventario Actual": i.inventarioActual,
      "Consumo Diario Promedio": i.consumoDiarioPromedio,
      "Alcance (días)": i.alcanceDias,
      "Mínimo Requerido (días)": i.minimoDias,
      Estado: i.critico ? "🔴 Crítico" : "🟢 Normal",
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Alcance de Insumos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Inventario-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
