import { datosConsolidado } from "@/lib/lineas-extra";
import ConsolidadoView from "@/components/lineas/ConsolidadoView";

// El antiguo "Panel en vivo": las cuatro líneas y el Estado de Resultados
// consolidado, ahora como vista común del sidebar.
export default async function ConsolidadoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const d = await datosConsolidado((await searchParams).periodo);
  return <ConsolidadoView d={d} />;
}
