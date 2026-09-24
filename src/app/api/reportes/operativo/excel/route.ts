// Reporte Operativo (Excel) — el detalle crudo de "Captura del día" por
// ubicación (Huevos y Cerdo, que todavía usan el formulario genérico de
// indicadores; Pollo de Engorde tiene su propio reporte con eventos
// reales). Filtrable por rango de fechas y por ubicación.
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { and, gte, lte, eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { capturas, ubicaciones } from "@/lib/db/schema";
import { getOrganizacion, unidadesPorEmpresa, fmtFechaLarga } from "@/lib/reportes-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const ubicacionId = sp.get("ubicacionId") || null;
  const desde = sp.get("desde") || "2000-01-01";
  const hasta = sp.get("hasta") || "2100-01-01";

  const condiciones = [gte(capturas.fecha, desde), lte(capturas.fecha, hasta)];
  if (ubicacionId) condiciones.push(eq(capturas.ubicacionId, ubicacionId));

  const [filas, ubic, unidadesInfo, org] = await Promise.all([
    db
      .select()
      .from(capturas)
      .where(and(...condiciones))
      .orderBy(asc(capturas.fecha)),
    db.select({ id: ubicaciones.id, nombre: ubicaciones.nombre, empresaId: ubicaciones.empresaId }).from(ubicaciones),
    unidadesPorEmpresa(),
    getOrganizacion(),
  ]);

  const ubicPorId = Object.fromEntries(ubic.map((u) => [u.id, u]));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["AgroPulse — Reporte Operativo (Captura de Campo)"],
      ["Cliente", org?.nombre ?? "—"],
      ["Rango", `${desde} a ${hasta}`],
      ["Ubicación", ubicacionId ? ubicPorId[ubicacionId]?.nombre ?? ubicacionId : "Todas"],
      ["Generado", fmtFechaLarga()],
    ]),
    "Portada",
  );

  const rows = filas.map((c) => {
    const u = ubicPorId[c.ubicacionId];
    const unidad = u ? unidadesInfo[u.empresaId] : undefined;
    const valores = c.valores as Record<string, { meta?: number; causado: number }>;
    const base: Record<string, string | number> = {
      Fecha: c.fecha,
      "Unidad de Negocio": unidad?.unidadNombre ?? "—",
      Ubicación: u?.nombre ?? "—",
      Origen: c.origen,
      "Capturado (hora dispositivo)": c.creadoEnDispositivo ? new Date(c.creadoEnDispositivo).toLocaleString("es-PA") : "",
      Observaciones: c.observaciones ?? "",
    };
    for (const [clave, v] of Object.entries(valores)) {
      if (v.meta !== undefined) base[`${clave} (meta)`] = v.meta;
      base[`${clave} (causado)`] = v.causado;
    }
    return base;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Capturas");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Operativo-${desde}_a_${hasta}.xlsx"`,
    },
  });
}
