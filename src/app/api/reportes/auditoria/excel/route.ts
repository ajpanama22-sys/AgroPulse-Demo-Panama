// Reporte de Auditoría (Excel) — bitácora de acciones del sistema, la
// evidencia de trazabilidad ante el cliente. Antes solo se podía consultar
// en pantalla en /admin/auditoria, sin forma de exportarla.
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOrganizacion, auditoriaReciente, fmtFechaLarga } from "@/lib/reportes-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const limit = Number(sp.get("limit")) || 2000;

  const [registros, org] = await Promise.all([auditoriaReciente(limit), getOrganizacion()]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["AgroPulse — Reporte de Auditoría"],
      ["Cliente", org?.nombre ?? "—"],
      ["Registros incluidos", registros.length],
      ["Generado", fmtFechaLarga()],
    ]),
    "Portada",
  );

  const rows = registros.map((r) => ({
    Fecha: r.creadoEn ? new Date(r.creadoEn).toLocaleString("es-PA") : "",
    Actor: r.actorNombre,
    Acción: r.accion,
    Entidad: r.entidad,
    "ID Entidad": r.entidadId ?? "",
    Detalle: r.detalle ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Bitácora");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Auditoria-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
