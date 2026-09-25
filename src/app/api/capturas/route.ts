import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { capturas, capturaEvidencias, ubicaciones, auditoria, lotesPollo, loteEventosPollo } from "@/lib/db/schema";
import { avesVivas, edadDelLote, type LotePollo, type EventoLote } from "@/lib/analisis-pollo";

// Un registro por ubicación+día — reenviar el mismo día (reintento de
// sincronización offline, o el operador corrigiendo un valor) actualiza
// en vez de duplicar. Esto es lo que hace segura la cola offline: si el
// POST llegó pero la confirmación se perdió antes de vaciar la cola local,
// el reintento no crea una segunda fila.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const ubicacionId = String(form.get("ubicacionId") ?? "");
  const fecha = String(form.get("fecha") ?? "");
  const valores = JSON.parse(String(form.get("valores") ?? "{}"));
  const observaciones = String(form.get("observaciones") ?? "") || null;
  const creadoEnDispositivo = new Date(String(form.get("creadoEnDispositivo") ?? new Date().toISOString()));
  const origen = (String(form.get("origen") ?? "manual") as "qr" | "manual");
  const fotos = form.getAll("fotos").filter((f): f is File => f instanceof File);

  if (!ubicacionId || !fecha) return NextResponse.json({ error: "Faltan ubicacionId/fecha" }, { status: 400 });

  // Un operador de campo solo puede reportar por SU ubicación asignada —
  // aunque falsee el ubicacionId del formulario, el servidor no confía en
  // el cliente para esto (mismo espíritu que el fix de scope de FLOTIA).
  if (session.user.rol === "campo" && session.user.ubicacionId && session.user.ubicacionId !== ubicacionId) {
    return NextResponse.json({ error: "No autorizado para esta ubicación" }, { status: 403 });
  }

  const [ubicacion] = await db.select().from(ubicaciones).where(eq(ubicaciones.id, ubicacionId)).limit(1);
  if (!ubicacion) return NextResponse.json({ error: "Ubicación inválida" }, { status: 404 });

  const [existente] = await db.select({ id: capturas.id }).from(capturas).where(and(eq(capturas.ubicacionId, ubicacionId), eq(capturas.fecha, fecha))).limit(1);

  const [captura] = await db
    .insert(capturas)
    .values({ ubicacionId, fecha, capturadoPorId: session.user.id, origen, valores, observaciones, creadoEnDispositivo, sincronizadoEn: new Date() })
    .onConflictDoUpdate({
      target: [capturas.ubicacionId, capturas.fecha],
      set: { valores, observaciones, origen, creadoEnDispositivo, sincronizadoEn: new Date(), capturadoPorId: session.user.id },
    })
    .returning();

  for (const foto of fotos) {
    const blob = await put(`evidencias/${captura.id}/${Date.now()}-${foto.name}`, foto, { access: "public" });
    await db.insert(capturaEvidencias).values({ capturaId: captura.id, tipo: "foto", url: blob.url, nombreArchivo: foto.name });
  }

  await db.insert(auditoria).values({
    actorId: session.user.id,
    actorNombre: session.user.name ?? session.user.email ?? "desconocido",
    accion: existente ? "captura.actualizar" : "captura.crear",
    entidad: "captura",
    entidadId: captura.id,
    detalle: `${ubicacion.nombre} · ${fecha}${fotos.length ? ` · ${fotos.length} evidencia(s)` : ""}`,
  });

  // --- Pollo de Engorde: si esta ubicación tiene un lote activo, además del
  // registro genérico de arriba, generamos el EVENTO real del lote
  // (mortalidad / pesaje). Sin esto, lo que un operador capturaba acá
  // quedaba aislado — no se reflejaba en el Resumen del módulo Pollo ni en
  // el Panel Ejecutivo que ve gerencia. Con esto, la captura de campo sube
  // en vivo hasta ahí.
  const [loteActivo] = await db
    .select()
    .from(lotesPollo)
    .where(and(eq(lotesPollo.ubicacionId, ubicacionId), eq(lotesPollo.estado, "activo")))
    .limit(1);

  if (loteActivo) {
    const lote = loteActivo as unknown as LotePollo;
    const eventosLote = (await db.select().from(loteEventosPollo).where(eq(loteEventosPollo.loteId, loteActivo.id))) as unknown as EventoLote[];
    const fechaEvento = creadoEnDispositivo.toISOString().slice(0, 10);
    const edadDiasEvento = edadDelLote(lote, creadoEnDispositivo);

    const pctMortalidadDia = Number(valores.mortalidad?.causado);
    if (Number.isFinite(pctMortalidadDia) && pctMortalidadDia > 0) {
      const vivasActuales = avesVivas(lote, eventosLote);
      const cantidad = Math.max(0, Math.round((pctMortalidadDia / 100) * vivasActuales));
      if (cantidad > 0) {
        await db.insert(loteEventosPollo).values({
          loteId: loteActivo.id,
          fecha: fechaEvento,
          tipo: "mortalidad",
          edadDias: edadDiasEvento,
          mortalidadCantidad: cantidad,
          mortalidadCausa: "otra",
          observaciones: "Capturado desde la PWA de Campo",
          capturadoPorId: session.user.id,
          origen,
          creadoEnDispositivo,
        });
      }
    }

    const pesoKgDia = Number(valores.peso_promedio?.causado);
    if (Number.isFinite(pesoKgDia) && pesoKgDia > 0) {
      await db.insert(loteEventosPollo).values({
        loteId: loteActivo.id,
        fecha: fechaEvento,
        tipo: "pesaje",
        edadDias: edadDiasEvento,
        pesoMuestraGr: String(Math.round(pesoKgDia * 1000)),
        tamanoMuestra: 50,
        observaciones: "Capturado desde la PWA de Campo",
        capturadoPorId: session.user.id,
        origen,
        creadoEnDispositivo,
      });
    }
  }

  return NextResponse.json({ ok: true, capturaId: captura.id });
}
