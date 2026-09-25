import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lotesPollo } from "@/lib/db/schema";

// Cierre de Lote — MVP1 es deliberadamente simple (Premisa #3 de la
// Estimación): un solo campo, Fecha de salida. La Edad de Sacrificio se
// deriva (edadDelLote), no se pide en el formulario. La conciliación con
// planta beneficiadora es un paso APARTE (Coordinación Central, ver
// /api/pollo/conciliaciones), no bloquea este cierre.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const fd = await req.formData();
  const fechaCierre = String(fd.get("fechaCierre") ?? "");
  if (!fechaCierre) return NextResponse.json({ error: "Falta la fecha de salida" }, { status: 400 });

  const [lote] = await db
    .update(lotesPollo)
    .set({ estado: "cerrado", fechaCierre })
    .where(eq(lotesPollo.id, id))
    .returning();

  return NextResponse.json({ ok: true, lote });
}
