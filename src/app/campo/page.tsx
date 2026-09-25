import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ubicaciones, ubicacionIndicadores, indicadores, capturas, empresas, unidadesNegocio, asignacionesCampo } from "@/lib/db/schema";
import CampoCaptureForm from "@/components/CampoCaptureForm";

export default async function CampoPage() {
  const session = await auth();
  const user = session!.user;

  // El operario de Pollo de Engorde (El Dorado) tiene sus galpones en
  // `asignacionesCampo`, no en `usuarios.ubicacionId` — un usuario con
  // asignaciones ahí va siempre a la app de Pollo, que es un flujo de
  // captura completamente distinto (lotes/eventos, no indicadores genéricos).
  const tieneGalponesPollo = await db.select({ id: asignacionesCampo.id }).from(asignacionesCampo).where(eq(asignacionesCampo.usuarioId, user.id)).limit(1);
  if (tieneGalponesPollo.length > 0) redirect("/campo/pollo");

  const listaUbicaciones = await db
    .select({ id: ubicaciones.id, nombre: ubicaciones.nombre, subUnidad: ubicaciones.subUnidad, qrToken: ubicaciones.qrToken, unidadNombre: unidadesNegocio.nombre })
    .from(ubicaciones)
    .innerJoin(empresas, eq(empresas.id, ubicaciones.empresaId))
    .innerJoin(unidadesNegocio, eq(unidadesNegocio.id, empresas.unidadNegocioId))
    .where(eq(ubicaciones.activa, true));

  const ubicacionActualId = user.ubicacionId ?? listaUbicaciones[0]?.id ?? "";

  const indicadoresUbicacion = await db
    .select({ clave: indicadores.clave, etiqueta: indicadores.etiqueta, unidadMedida: indicadores.unidadMedida, tipoValor: indicadores.tipoValor, notaTecnica: indicadores.notaTecnica, orden: ubicacionIndicadores.orden })
    .from(ubicacionIndicadores)
    .innerJoin(indicadores, eq(indicadores.id, ubicacionIndicadores.indicadorId))
    .where(eq(ubicacionIndicadores.ubicacionId, ubicacionActualId))
    .orderBy(ubicacionIndicadores.orden);

  const recientes = await db
    .select({ id: capturas.id, fecha: capturas.fecha, ubicacionId: capturas.ubicacionId, sincronizadoEn: capturas.sincronizadoEn })
    .from(capturas)
    .orderBy(desc(capturas.sincronizadoEn))
    .limit(6);

  const historial = await db
    .select({ id: capturas.id, fecha: capturas.fecha, ubicacionId: capturas.ubicacionId, sincronizadoEn: capturas.sincronizadoEn, observaciones: capturas.observaciones })
    .from(capturas)
    .where(eq(capturas.ubicacionId, ubicacionActualId))
    .orderBy(desc(capturas.fecha))
    .limit(30);

  const ubicNombrePorId = Object.fromEntries(listaUbicaciones.map((u) => [u.id, u]));
  const recientesConNombre = recientes.map((r) => ({ ...r, ubicacion: ubicNombrePorId[r.ubicacionId]?.nombre ?? "—" }));

  return (
    <CampoCaptureForm
      usuario={{ nombre: user.name ?? "Operador", rol: user.rol, email: user.email ?? "" }}
      ubicaciones={listaUbicaciones}
      ubicacionActualId={ubicacionActualId}
      indicadores={indicadoresUbicacion}
      recientes={recientesConNombre}
      historial={historial.map((h) => ({ id: h.id, fecha: h.fecha, sincronizadoEn: h.sincronizadoEn, observaciones: h.observaciones }))}
    />
  );
}
