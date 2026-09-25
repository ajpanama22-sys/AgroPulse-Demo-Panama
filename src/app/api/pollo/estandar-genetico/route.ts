import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { estandarGenetico } from "@/lib/db/schema";

// Edición de la curva de Estándar Genético — celda por celda, como en el
// Excel de Registro de Granja ("celdas amarillas = datos a llenar").
// Cobb 500 y Ross 308 comparten curva en El Dorado; Hubbard queda marcada
// como estimada hasta que el cliente confirme la tabla real.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!["admin", "coordinacion", "gerencial"].includes(session.user.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { genetica, edadDias, pesoEstandarGr } = (await req.json()) as { genetica: string; edadDias: number; pesoEstandarGr: number };

  await db
    .update(estandarGenetico)
    .set({ pesoEstandarGr: String(pesoEstandarGr), fuente: `Editado manualmente por ${session.user.name ?? session.user.email}` })
    .where(and(eq(estandarGenetico.genetica, genetica as "cobb_500" | "ross" | "hubbard"), eq(estandarGenetico.edadDias, edadDias)));

  return NextResponse.json({ ok: true });
}
