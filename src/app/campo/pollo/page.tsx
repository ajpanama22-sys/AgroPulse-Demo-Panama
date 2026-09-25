import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ubicaciones, asignacionesCampo, lotesPollo, loteEventosPollo, estandarGenetico } from "@/lib/db/schema";
import { resumirLote, estadoSemaforo, type EventoLote, type EstandarGeneticoPunto } from "@/lib/analisis-pollo";
import CampoPolloApp, { type AsignacionGalpon, type EventoHistorial } from "@/components/CampoPolloApp";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// PWA del Galponero — Pollo de Engorde (El Dorado / Grupo JHS). Un operario
// de campo puede tener VARIOS galpones asignados, en VARIAS granjas (RF de
// "Mis Granjas" del Mapa de Solución) — la asignación vive en
// `asignacionesCampo`, no en `usuarios.ubicacionId` (que sigue sirviendo a
// las otras líneas de negocio con un solo punto de captura).
export default async function CampoPolloPage() {
  const session = await auth();
  const user = session!.user;
  const hoy = hoyISO();

  const asignaciones = await db
    .select({ galponId: asignacionesCampo.ubicacionId })
    .from(asignacionesCampo)
    .where(eq(asignacionesCampo.usuarioId, user.id));
  const galponIds = asignaciones.map((a) => a.galponId);

  if (galponIds.length === 0) {
    return <CampoPolloApp usuario={{ nombre: user.name ?? "Operador", rol: user.rol, email: user.email ?? "" }} asignaciones={[]} historial={[]} tabla={[]} />;
  }

  const galpones = await db.select().from(ubicaciones).where(inArray(ubicaciones.id, galponIds));
  const granjaIds = [...new Set(galpones.map((g) => g.padreId).filter((id): id is string => !!id))];
  const granjas = granjaIds.length ? await db.select().from(ubicaciones).where(inArray(ubicaciones.id, granjaIds)) : [];
  const granjaPorId = Object.fromEntries(granjas.map((g) => [g.id, g]));

  const lotesActivos = await db.select().from(lotesPollo).where(inArray(lotesPollo.ubicacionId, galponIds));
  const lotesDeGalponAsignado = lotesActivos.filter((l) => l.estado === "activo");
  const loteIds = lotesDeGalponAsignado.map((l) => l.id);

  const eventos = loteIds.length ? await db.select().from(loteEventosPollo).where(inArray(loteEventosPollo.loteId, loteIds)) : [];
  const eventosPorLote: Record<string, EventoLote[]> = {};
  for (const e of eventos) (eventosPorLote[e.loteId] ??= []).push(e);

  const tablaRaw = await db.select().from(estandarGenetico);
  const tabla: EstandarGeneticoPunto[] = tablaRaw.map((f) => ({ genetica: f.genetica, edadDias: f.edadDias, pesoEstandarGr: Number(f.pesoEstandarGr) }));

  const loteActivoPorGalpon: Record<string, (typeof lotesDeGalponAsignado)[number]> = {};
  for (const l of lotesDeGalponAsignado) loteActivoPorGalpon[l.ubicacionId] = l;

  const asignacionesUi: AsignacionGalpon[] = galpones.map((g) => {
    const lote = loteActivoPorGalpon[g.id];
    const granja = g.padreId ? granjaPorId[g.padreId] : undefined;
    if (!lote) {
      return { galponId: g.id, galponNombre: g.nombre, granjaId: granja?.id ?? "", granjaNombre: granja?.nombre ?? "—", qrToken: g.qrToken, lote: null };
    }
    const eventosLote = eventosPorLote[lote.id] ?? [];
    const resumen = resumirLote(lote, eventosLote, tabla);
    const eventosHoy = eventosLote.filter((e) => e.fecha === hoy);
    const esHito = resumen.edad <= 10 || [14, 21, 28, 33, 35].includes(resumen.edad);
    return {
      galponId: g.id,
      galponNombre: g.nombre,
      granjaId: granja?.id ?? "",
      granjaNombre: granja?.nombre ?? "—",
      qrToken: g.qrToken,
      lote: {
        id: lote.id,
        codigo: lote.codigo,
        genetica: lote.genetica,
        fechaAlojamiento: lote.fechaAlojamiento,
        poblacionInicial: lote.poblacionInicial,
        edad: resumen.edad,
        saldo: resumen.saldo,
        pctMortalidad: resumen.pctMortalidad,
        pesoKg: resumen.pesoKg,
        conversion: resumen.conversion,
        pesoEstandarKg: resumen.pesoEstandarKg,
        pctCumplimientoLote: resumen.pctCumplimientoLote,
        semaforo: estadoSemaforo(resumen.pctCumplimientoLote),
        esHito,
        capturasHoy: {
          mortalidad: eventosHoy.some((e) => e.tipo === "mortalidad"),
          descarte: eventosHoy.some((e) => e.tipo === "descarte"),
          alimento: eventosHoy.some((e) => e.tipo === "alimento"),
        },
      },
    };
  });

  const historial: EventoHistorial[] = eventos
    .slice()
    .sort((a, b) => (b.creadoEnDispositivo?.toString() ?? b.fecha).localeCompare(a.creadoEnDispositivo?.toString() ?? a.fecha))
    .slice(0, 40)
    .map((e) => {
      const lote = lotesDeGalponAsignado.find((l) => l.id === e.loteId);
      const galpon = lote ? galpones.find((g) => g.id === lote.ubicacionId) : undefined;
      return {
        id: e.id,
        tipo: e.tipo,
        fecha: e.fecha,
        loteCodigo: lote?.codigo ?? "—",
        galponNombre: galpon?.nombre ?? "—",
        detalle:
          e.tipo === "mortalidad"
            ? `${e.mortalidadCantidad ?? 0} aves${e.mortalidadCausa ? ` · ${e.mortalidadCausa}` : ""}`
            : e.tipo === "descarte"
              ? `${e.descarteCantidad ?? 0} aves${e.descarteMotivo ? ` · ${e.descarteMotivo}` : ""}`
              : e.tipo === "alimento"
                ? `${Number(e.alimentoConsumidoKg ?? 0).toFixed(1)} kg`
                : e.tipo === "pesaje"
                  ? `muestra ${e.tamanoMuestra ?? 0} aves`
                  : "—",
      };
    });

  return (
    <CampoPolloApp
      usuario={{ nombre: user.name ?? "Operador", rol: user.rol, email: user.email ?? "" }}
      asignaciones={asignacionesUi}
      historial={historial}
      tabla={tabla}
    />
  );
}
