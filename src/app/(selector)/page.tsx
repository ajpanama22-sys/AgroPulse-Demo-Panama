import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LINEAS, lineasPermitidas } from "@/lib/lineas-config";
import { calendario, mesesHasta, serieMensual, ubicacionesDeLinea, ubicDe, unidadDelUsuario, valor } from "@/lib/lineas-data";
import Picker, { type PickerLinea } from "@/components/shell/Picker";

// Selector de modales tras el login — mismo lugar y misma presentación que
// el selector de PharmaLab AI, con un modal por línea de negocio.
export default async function SelectorPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const permitidas = lineasPermitidas(session.user.rol, await unidadDelUsuario(session.user.empresaId));
  if (permitidas.length === 1) redirect(`/linea/${permitidas[0]}`);

  const { hoy } = await calendario();
  const meses = mesesHasta(hoy.slice(0, 7), 12);
  const lineas: PickerLinea[] = [];
  for (const l of LINEAS.filter((x) => permitidas.includes(x.slug))) {
    const ubics = await ubicacionesDeLinea(l.slug);
    const d = l.tendencia[0];
    const u = ubicDe(d, ubics);
    const serie = await serieMensual(u ? [u.id] : [], meses[0], meses.at(-1)!);
    lineas.push({
      slug: l.slug,
      causado: meses.map((m) => valor(serie, u?.id, d.clave, m).causado),
      meta: meses.map((m) => valor(serie, u?.id, d.clave, m).meta),
      serieNombre: d.titulo,
    });
  }
  return <Picker nombre={session.user.name ?? "equipo"} esAdmin={session.user.rol === "admin"} meses={meses} lineas={lineas} />;
}
