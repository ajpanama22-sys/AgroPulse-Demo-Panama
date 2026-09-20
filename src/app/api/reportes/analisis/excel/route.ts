import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { agregarPorBucket, sumarRango, totalConceptoRango, etiquetaBucket, CONCEPTOS_CLAVE } from "@/lib/analisis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("No autenticado", { status: 401 });

  const { agg, empresaNombre, unidadPorEmpresa, bucketsDisponibles } = await agregarPorBucket("mes");
  const ultimo = bucketsDisponibles[bucketsDisponibles.length - 1];
  const penultimo = bucketsDisponibles[bucketsDisponibles.length - 2] ?? ultimo;
  const sp = req.nextUrl.searchParams;
  const desdeA = sp.get("desdeA") && bucketsDisponibles.includes(sp.get("desdeA")!) ? sp.get("desdeA")! : ultimo;
  const hastaA = sp.get("hastaA") && bucketsDisponibles.includes(sp.get("hastaA")!) ? sp.get("hastaA")! : ultimo;
  const desdeB = sp.get("desdeB") && bucketsDisponibles.includes(sp.get("desdeB")!) ? sp.get("desdeB")! : penultimo;
  const hastaB = sp.get("hastaB") && bucketsDisponibles.includes(sp.get("hastaB")!) ? sp.get("hastaB")! : penultimo;

  const rangoA = sumarRango(agg, desdeA, hastaA);
  const rangoB = sumarRango(agg, desdeB, hastaB);
  const etA = `${etiquetaBucket(desdeA, "mes")} a ${etiquetaBucket(hastaA, "mes")}`;
  const etB = `${etiquetaBucket(desdeB, "mes")} a ${etiquetaBucket(hastaB, "mes")}`;

  const resumenRows = CONCEPTOS_CLAVE.map((concepto) => ({
    Partida: concepto,
    [`Período A (${etA})`]: totalConceptoRango(rangoA, concepto) ?? "",
    [`Período B (${etB})`]: totalConceptoRango(rangoB, concepto) ?? "",
  }));

  const porEmpresaRows: Record<string, string | number>[] = [];
  for (const [empresaId, conceptos] of rangoA) {
    const fila: Record<string, string | number> = { Unidad: empresaNombre[empresaId], "Unidad de negocio": unidadPorEmpresa[empresaId] ?? "", Período: etA };
    for (const concepto of CONCEPTOS_CLAVE) fila[concepto] = conceptos.get(concepto) ?? "";
    porEmpresaRows.push(fila);
  }
  for (const [empresaId, conceptos] of rangoB) {
    const fila: Record<string, string | number> = { Unidad: empresaNombre[empresaId], "Unidad de negocio": unidadPorEmpresa[empresaId] ?? "", Período: etB };
    for (const concepto of CONCEPTOS_CLAVE) fila[concepto] = conceptos.get(concepto) ?? "";
    porEmpresaRows.push(fila);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "Resumen Comparativo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porEmpresaRows), "Por Unidad");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AgroPulse-Analisis-${desdeA}_a_${hastaA}-vs-${desdeB}_a_${hastaB}.xlsx"`,
    },
  });
}
