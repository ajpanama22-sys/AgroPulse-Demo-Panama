import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizacion, auditoria } from "@/lib/db/schema";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const form = await req.formData();
  const nombre = String(form.get("nombre") ?? "");
  const direccion = String(form.get("direccion") ?? "") || null;
  const logo = form.get("logo");

  const [actual] = await db.select().from(organizacion).limit(1);
  let logoUrl = actual?.logoUrl ?? null;
  if (logo instanceof File && logo.size > 0) {
    const blob = await put(`organizacion/logo-${Date.now()}-${logo.name}`, logo, { access: "public" });
    logoUrl = blob.url;
  }

  if (actual) {
    await db.update(organizacion).set({ nombre, direccion, logoUrl, actualizadoEn: new Date() });
  } else {
    await db.insert(organizacion).values({ nombre, direccion, logoUrl });
  }

  await db.insert(auditoria).values({
    actorId: session.user.id,
    actorNombre: session.user.name ?? "admin",
    accion: "organizacion.actualizar",
    entidad: "organizacion",
    detalle: nombre,
  });

  return NextResponse.json({ ok: true });
}
