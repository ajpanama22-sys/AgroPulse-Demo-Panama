import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { conciliacionesPlanta } from "@/lib/db/schema";

// Aprobación manual de un cierre BLOQUEADO por desviación fuera de
// tolerancia — solo Coordinación Central/Gerencia/Admin, y queda auditado
// (aprobadoPorId + aprobadoEn).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!["coordinacion", "admin", "gerencial"].includes(session.user.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const [row] = await db
    .update(conciliacionesPlanta)
    .set({ estado: "aprobado", aprobadoPorId: session.user.id, aprobadoEn: new Date() })
    .where(eq(conciliacionesPlanta.id, id))
    .returning();

  return NextResponse.json({ ok: true, conciliacion: row });
}
