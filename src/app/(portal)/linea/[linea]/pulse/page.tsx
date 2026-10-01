import { notFound } from "next/navigation";
import { lineaPorSlug } from "@/lib/lineas-config";
import { datosLinea } from "@/lib/lineas-vistas";
import { PulseView } from "@/components/lineas/Vistas";

export default async function PulseLinea({ params, searchParams }: { params: Promise<{ linea: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { linea } = await params;
  const l = lineaPorSlug(linea);
  if (!l) notFound();
  const d = await datosLinea(l, (await searchParams).mes);
  return <PulseView slug={l.slug} d={d} />;
}
