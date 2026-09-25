import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { loteEventosPollo, evidenciasPollo } from "@/lib/db/schema";

// Captura de campo — un solo endpoint para los 3 formularios "de todos los
// días" (Mortalidad, Descarte, Consumo ABA) y el de "día hito" (Pesaje).
// `tipo` decide qué columnas se completan; el resto queda null. La
// evidencia fotográfica (opcional, Inspector Veterinario) se sube a Vercel
// Blob y queda ligada al evento vía `evidenciasPollo.loteEventoId`.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const fd = await req.formData();
  const tipo = String(fd.get("tipo") ?? "");
  const loteId = String(fd.get("loteId") ?? "");
  const fecha = String(fd.get("fecha") ?? "");
  const edadDias = fd.get("edadDias") ? Number(fd.get("edadDias")) : null;
  const observaciones = fd.get("observaciones") ? String(fd.get("observaciones")) : null;

  if (!loteId || !fecha || !["mortalidad", "descarte", "alimento", "pesaje"].includes(tipo)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const base = {
    loteId,
    fecha,
    tipo: tipo as "mortalidad" | "descarte" | "alimento" | "pesaje",
    edadDias,
    observaciones,
    capturadoPorId: session.user.id,
    origen: "manual" as const,
    creadoEnDispositivo: fd.get("creadoEnDispositivo") ? new Date(String(fd.get("creadoEnDispositivo"))) : new Date(),
  };

  let valores: Record<string, unknown> = {};
  if (tipo === "mortalidad") {
    valores = {
      mortalidadCantidad: Number(fd.get("cantidad") ?? 0),
      mortalidadCausa: fd.get("causa") ? String(fd.get("causa")) : null,
    };
  } else if (tipo === "descarte") {
    valores = {
      descarteCantidad: Number(fd.get("cantidad") ?? 0),
      descarteMotivo: fd.get("motivo") ? String(fd.get("motivo")) : null,
    };
  } else if (tipo === "alimento") {
    valores = { alimentoConsumidoKg: String(fd.get("alimentoConsumidoKg") ?? "0") };
  } else if (tipo === "pesaje") {
    valores = {
      pesoMuestraGr: String(fd.get("pesoMuestraGr") ?? "0"), // peso TOTAL de la muestra, en gramos
      tamanoMuestra: Number(fd.get("tamanoMuestra") ?? 0),
    };
  }

  const [evento] = await db.insert(loteEventosPollo).values({ ...base, ...valores }).returning();

  // El evento ya quedó guardado arriba — si la subida de fotos falla (p.ej.
  // falta BLOB_READ_WRITE_TOKEN en este ambiente), NO se debe tirar toda la
  // respuesta como error: el cliente offline (`enviarOEncolar`) reintentaría
  // el POST completo más tarde y duplicaría el evento. Se responde ok igual
  // y se informa qué fotos no se pudieron subir.
  const fotos = fd.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  let fotosSubidas = 0;
  let errorFotos: string | null = null;
  if (fotos.length > 0) {
    try {
      const subidas = await Promise.all(
        fotos.map(async (foto) => {
          const blob = await put(`pollo/${loteId}/${evento.id}-${foto.name}`, foto, { access: "public" });
          return { loteEventoId: evento.id, url: blob.url, nombreArchivo: foto.name };
        })
      );
      await db.insert(evidenciasPollo).values(subidas);
      fotosSubidas = subidas.length;
    } catch (err) {
      errorFotos = err instanceof Error ? err.message : "No se pudo subir la evidencia fotográfica";
      console.error("[pollo/eventos] fallo al subir evidencia fotográfica:", errorFotos);
    }
  }

  return NextResponse.json({ ok: true, evento, fotosSubidas, fotosTotal: fotos.length, errorFotos });
}
