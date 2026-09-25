import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lotesPollo } from "@/lib/db/schema";
import { pesoEstandarEnEdad, type Genetica } from "@/lib/analisis-pollo";

// Apertura de Lote — un solo POST crea el lote 'activo' para un galpón que
// no tenía uno. Historia de usuario: "Como supervisor, quiero completar
// los datos de la granja una sola vez... no para crear granjas nuevas
// durante el MVP1" — este endpoint abre LOTES, no granjas (las 13 granjas
// ya vienen precargadas por el seed).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const fd = await req.formData();
  const ubicacionId = String(fd.get("ubicacionId") ?? "");
  const codigo = String(fd.get("codigo") ?? "");
  const genetica = String(fd.get("genetica") ?? "cobb_500") as Genetica;
  const fechaAlojamiento = String(fd.get("fechaAlojamiento") ?? "");
  const poblacionInicial = Number(fd.get("poblacionInicial") ?? 0);
  const observaciones = String(fd.get("observaciones") ?? "");

  if (!ubicacionId || !codigo || !fechaAlojamiento || !poblacionInicial) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const pesoInicialGr = pesoEstandarEnEdad(genetica, 0);

  const [lote] = await db
    .insert(lotesPollo)
    .values({
      ubicacionId,
      codigo,
      genetica,
      fechaAlojamiento,
      poblacionInicial,
      pesoInicialGr: String(pesoInicialGr),
      estado: "activo",
    })
    .returning();

  return NextResponse.json({ ok: true, lote, observaciones });
}
