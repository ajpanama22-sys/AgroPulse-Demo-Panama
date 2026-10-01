import { notFound } from "next/navigation";
import { lineaPorSlug } from "@/lib/lineas-config";
import { ubicacionesDeLinea } from "@/lib/lineas-data";
import { periodosEdrDisponibles } from "@/lib/reportes-data";
import Icon from "@/components/icons";

function Btn({ href, pdf, children }: { href: string; pdf?: boolean; children: React.ReactNode }) {
  return (
    <a className={`repBtn${pdf ? " pdf" : ""}`} href={href}>
      <Icon name="report" size={16} />
      {children}
    </a>
  );
}

// Reportes de la línea: los mismos exportes Excel/PDF del sistema, filtrados
// a la línea cuando el exporte lo permite.
export default async function ReportesLinea({ params }: { params: Promise<{ linea: string }> }) {
  const { linea } = await params;
  const l = lineaPorSlug(linea);
  if (!l) notFound();
  const [ubics, periodos] = await Promise.all([ubicacionesDeLinea(l.slug), periodosEdrDisponibles()]);
  const qsFin = new URLSearchParams({ desde: periodos[0] ?? "", hasta: periodos.at(-1) ?? "" }).toString();
  return (
    <section>
      <div className="pageIntro">
        <div>
          <p className="eyebrow">{l.nombre.toUpperCase()} / REPORTES</p>
          <h2>Reportes de la línea</h2>
          <p>Excel para trabajar los datos y PDF ejecutivo con gráficas.</p>
        </div>
      </div>
      <div className="repGrid">
        {ubics.map((u) => (
          <div key={u.id} className="c3-card flat repCard">
            <p className="eyebrow">OPERATIVO · CAPTURA DE CAMPO</p>
            <h3>{u.nombre}</h3>
            <p>Detalle diario de la captura de {u.nombre}, auditable fila por fila.</p>
            <div className="repBtns">
              <Btn href={`/api/reportes/operativo/excel?${new URLSearchParams({ desde: "2000-01-01", hasta: "2100-01-01", ubicacionId: u.id })}`}>Excel operativo</Btn>
            </div>
          </div>
        ))}
        {l.slug === "pollo" && (
          <div className="c3-card flat repCard">
            <p className="eyebrow">POLLO DE ENGORDE</p>
            <h3>Lotes, mortalidad y pesajes</h3>
            <p>Comparativo entre lotes, mortalidad por causa y detalle de eventos.</p>
            <div className="repBtns">
              <Btn href="/api/reportes/pollo/excel">Excel</Btn>
              <Btn href="/api/reportes/pollo/pdf" pdf>
                PDF ejecutivo
              </Btn>
            </div>
          </div>
        )}
        {l.slug === "aba" && (
          <div className="c3-card flat repCard">
            <p className="eyebrow">INSUMOS</p>
            <h3>Inventario de insumos</h3>
            <p>Alcance en días por insumo, con marca de crítico.</p>
            <div className="repBtns">
              <Btn href="/api/reportes/inventario/excel">Excel de inventario</Btn>
            </div>
          </div>
        )}
        {l.tieneFinanzas && (
          <div className="c3-card flat repCard">
            <p className="eyebrow">FINANCIERO</p>
            <h3>Estado de Resultados</h3>
            <p>Estado de Resultados por unidad de negocio y consolidado. El archivo incluye las tres líneas con Estado de Resultados.</p>
            <div className="repBtns">
              <Btn href={`/api/reportes/excel?${qsFin}`}>Excel</Btn>
              <Btn href={`/api/reportes/pdf?${qsFin}`} pdf>
                PDF ejecutivo
              </Btn>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
