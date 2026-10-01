import { notFound } from "next/navigation";
import { lineaPorSlug } from "@/lib/lineas-config";
import { datosFinanzas } from "@/lib/lineas-extra";
import FinanzasView from "@/components/lineas/FinanzasView";

export default async function FinanzasLinea({ params, searchParams }: { params: Promise<{ linea: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { linea } = await params;
  const l = lineaPorSlug(linea);
  if (!l || !l.tieneFinanzas) notFound();
  const d = await datosFinanzas(l.slug, (await searchParams).periodo);
  return <FinanzasView slug={l.slug} d={d} />;
}
