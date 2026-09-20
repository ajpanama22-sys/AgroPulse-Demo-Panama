import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { usuarios, auditoria } from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "admin") return null;
  return session;
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { nombre, email, password, rol, empresaId, ubicacionId } = body;
  if (!nombre || !email || !password || !rol) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  const [nuevo] = await db
    .insert(usuarios)
    .values({ nombre, email: String(email).toLowerCase(), passwordHash, rol, empresaId: empresaId || null, ubicacionId: ubicacionId || null })
    .returning();

  await db.insert(auditoria).values({
    actorId: session.user.id,
    actorNombre: session.user.name ?? "admin",
    accion: "usuario.crear",
    entidad: "usuario",
    entidadId: nuevo.id,
    detalle: `${nombre} <${email}> · rol ${rol}`,
  });

  return NextResponse.json({ ok: true, id: nuevo.id });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, activo } = await req.json();
  await db.update(usuarios).set({ activo }).where(eq(usuarios.id, id));
  await db.insert(auditoria).values({
    actorId: session.user.id,
    actorNombre: session.user.name ?? "admin",
    accion: activo ? "usuario.activar" : "usuario.desactivar",
    entidad: "usuario",
    entidadId: id,
  });
  return NextResponse.json({ ok: true });
}
