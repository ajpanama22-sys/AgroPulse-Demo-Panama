// Reporte Financiero (Excel) — Estado de Resultados por unidad de negocio
// y consolidado, para un rango de períodos. Reemplaza el export anterior
// (que traía un período fijo hardcodeado a "2026-07" y mezclaba capturas
// de campo e inventario en el mismo archivo, que ahora tienen su propio
// reporte). Ahora es "para trabajar sobre ellos": una fila por partida x
// empresa x período, lista para tabla dinámica en Excel, más una hoja ya
// resumida por unidad/consolidado.
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { edrEnRango, getOrganizacion, periodosEdrDisponibles, unidadesPorEmpresa, fmtFechaLarga } from "@/lib/reportes-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const disponibles = await periodosEdrDisponibles();
  if (disponibles.length === 0) return new Response("No hay datos de EDR cargados", { status: 404 });
  const ultimo = disponibles[disponibles.length - 1];
  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde") && disponibles.includes(sp.get("desde")!) ? sp.get("desde")! : disponibles[0];
  const hasta = sp.get("hasta") && disponibles.includes(sp.get("hasta")!) ? sp.get("hasta")! : ultimo;

  const [lineas, unidadesInfo, org] = await Promise.all([edrEnRango(desde, hasta), unidadesPorEmpresa(), getOrganizacion()]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["AgroPulse — Reporte Financiero"],
      ["Cliente", org?.nombre ?? "—"],
      ["Dirección", org?.direccion ?? "—"],
      ["Período", desde === hasta ? desde : `${desde} a ${hasta}`],
      ["Generado", fmtFechaLarga()],
    ]),
    "Portada",
  );

  // Detalle: una fila por partida x empresa x período — el formato que
  // realmente sirve para armar una tabla dinámica en Excel.
  const detalleRows = lineas
    .map((l) => {
      const u = unidadesInfo[l.empresaId];
      return {
        Período: l.periodo,
        "Unidad de Negocio": u?.unidadNombre ?? "—",
        Empresa: u?.empresaNombre ?? "—",
        Partida: l.concepto,
        Orden: l.orden,
        Subtotal: l.esSubtotal ? "Sí" : "No",
        Meta: Number(l.meta),
        Causado: Number(l.causado),
        "% de Meta": Number(l.meta) ? +((Number(l.causado) / Number(l.meta)) * 100).toFixed(1) : "",
      };
    })
    .sort((a, b) => a.Período.localeCompare(b.Período) || a.Orden - b.Orden || a["Unidad de Negocio"].localeCompare(b["Unidad de Negocio"]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleRows), "EDR Detalle");

  // Resumen: partidas sumadas en todo el rango, una columna por unidad +
  // consolidado — la vista que un ejecutivo abre primero.
  const unidadesOrdenadas = Array.from(new Set(Object.values(unidadesInfo).sort((a, b) => a.orden - b.orden).map((u) => u.unidadNombre)));
  const conceptos = Array.from(new Set(lineas.map((l) => l.concepto))).sort((a, b) => (lineas.find((l) => l.concepto === a)?.orden ?? 0) - (lineas.find((l) => l.concepto === b)?.orden ?? 0));
  const resumenRows = conceptos.map((concepto) => {
    const fila: Record<string, string | number> = { Partida: concepto };
    let total = 0;
    for (const unidadNombre of unidadesOrdenadas) {
      const suma = lineas.filter((l) => l.concepto === concepto && unidadesInfo[l.empresaId]?.unidadNombre === unidadNombre).reduce((s, l) => s + Number(l.causado), 0);
      fila[unidadNombre] = suma;
      total += suma;
    }
    fila["Consolidado"] = total;
    return fila;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "EDR Resumen por Unidad");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Financiero-${desde}_a_${hasta}.xlsx"`,
    },
  });
}
