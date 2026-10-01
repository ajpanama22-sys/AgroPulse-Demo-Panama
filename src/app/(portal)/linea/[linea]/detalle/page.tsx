import { notFound } from "next/navigation";
import { lineaPorSlug } from "@/lib/lineas-config";
import { datosLinea } from "@/lib/lineas-vistas";
import { DetalleIndicadoresView } from "@/components/lineas/Vistas";
import InventarioView from "@/components/lineas/InventarioView";
import { datosInventario } from "@/lib/lineas-extra";
import PolloPage from "../../../pollo/page";

export default async function DetalleLinea({ params, searchParams }: { params: Promise<{ linea: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { linea } = await params;
  const l = lineaPorSlug(linea);
  if (!l) notFound();
  // Pollo: la pantalla de Pollo de Engorde existente, tal cual, dentro del modal.
  if (l.slug === "pollo") return <PolloPage searchParams={searchParams} />;
  if (l.slug === "aba") return <InventarioView d={await datosInventario((await searchParams).mes)} />;
  const d = await datosLinea(l, (await searchParams).mes);
  return <DetalleIndicadoresView slug={l.slug} d={d} />;
}
