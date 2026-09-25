import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { conciliacionesPlanta } from "@/lib/db/schema";
import { evaluarConciliacion } from "@/lib/analisis-pollo";

// Workflow de Conciliación con Planta Beneficiadora — Coordinación Central
// registra lo reportado por la granja vs. lo reportado por planta; el
// sistema calcula la desviación y BLOQUEA automáticamente si supera el
// umbral de tolerancia (2% por defecto), exigiendo aprobación explícita
// (historia de usuario "quiero que el sistema bloquee automáticamente un
// cierre fuera de tolerancia, para exigir mi aprobación explícita").
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!["coordinacion", "admin", "gerencial"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Solo Coordinación Central puede registrar conciliaciones" }, { status: 403 });
  }

  const body = await req.json();
  const { loteId, fecha, avesGranja, kgGranja, avesPlanta, kgPlanta, umbralTolerancia } = body as {
    loteId: string; fecha: string; avesGranja: number; kgGranja: number; avesPlanta: number; kgPlanta: number; umbralTolerancia?: number;
  };

  const umbral = umbralTolerancia ?? 0.02;
  const resultado = evaluarConciliacion(avesGranja, kgGranja, avesPlanta, kgPlanta, umbral);

  const [row] = await db
    .insert(conciliacionesPlanta)
    .values({
      loteId,
      fecha,
      avesReportadasGranja: avesGranja,
      kgReportadosGranja: String(kgGranja),
      avesReportadasPlanta: avesPlanta,
      kgReportadosPlanta: String(kgPlanta),
      umbralTolerancia: String(umbral),
      desviacionAvesPct: resultado.desviacionAvesPct.toFixed(2),
      desviacionPesoPct: resultado.desviacionPesoPct.toFixed(2),
      estado: resultado.estadoSugerido,
      ...(resultado.estadoSugerido === "aprobado" ? { aprobadoPorId: session.user.id, aprobadoEn: new Date() } : {}),
    })
    .returning();

  return NextResponse.json({ ok: true, conciliacion: row, resultado });
}
