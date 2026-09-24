import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { edrLineas, empresas, capturas, ubicaciones, insumos, lecturasInsumo, organizacion } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const periodo = "2026-07";
  const [edr, empresasAll, todasCapturas, ubic, insumosAll, lecturas, [org]] = await Promise.all([
    db.select().from(edrLineas).where(eq(edrLineas.periodo, periodo)),
    db.select().from(empresas),
    db.select().from(capturas),
    db.select().from(ubicaciones),
    db.select().from(insumos),
    db.select().from(lecturasInsumo),
    db.select().from(organizacion).limit(1),
  ]);
  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre]));
  const ubicNombre = Object.fromEntries(ubic.map((u) => [u.id, u.nombre]));

  const wb = XLSX.utils.book_new();

  const portadaSheet = XLSX.utils.aoa_to_sheet([
    ["AgroPulse — Reporte de Datos"],
    ["Cliente", org?.nombre ?? "—"],
    ["Dirección", org?.direccion ?? "—"],
    ["Período", periodo],
    ["Generado", new Date().toLocaleString("es-PA")],
  ]);
  XLSX.utils.book_append_sheet(wb, portadaSheet, "Portada");

  const edrRows = edr.map((l) => ({ Empresa: empresaNombre[l.empresaId], Partida: l.concepto, Meta: Number(l.meta), Causado: Number(l.causado), "%": l.meta ? Math.round((Number(l.causado) / Number(l.meta)) * 100) : "" }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(edrRows), "EDR Consolidado");

  const capturaRows = todasCapturas.map((c) => {
    const valores = c.valores as Record<string, { meta?: number; causado: number }>;
    const base: Record<string, string | number> = { Ubicación: ubicNombre[c.ubicacionId] ?? "—", Fecha: c.fecha };
    for (const [clave, v] of Object.entries(valores)) {
      base[`${clave} (meta)`] = v.meta ?? "";
      base[`${clave} (causado)`] = v.causado;
    }
    return base;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(capturaRows), "Capturas de Campo");

  const insumoRows = insumosAll.map((i) => {
    const lect = lecturas.find((l) => l.insumoId === i.id);
    const inv = Number(lect?.inventarioActual ?? 0);
    const consumo = Number(lect?.consumoDiarioPromedio ?? 1);
    return { Insumo: i.nombre, "Inventario Actual (Tm)": inv, "Consumo Diario Prom. (Tm)": consumo, "Alcance (días)": +(inv / consumo).toFixed(1), "Mínimo (días)": i.minimoDias };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(insumoRows), "Inventario Insumos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Reporte-${periodo}.xlsx"`,
    },
  });
}
