import { etiquetaBucket } from "@/lib/analisis";

function MesSelect({ name, defaultValue, bucketsDisponibles }: { name: string; defaultValue: string; bucketsDisponibles: string[] }) {
  return (
    <select name={name} defaultValue={defaultValue} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
      {bucketsDisponibles.map((b) => (
        <option key={b} value={b}>
          {etiquetaBucket(b, "mes")}
        </option>
      ))}
    </select>
  );
}

export default function AnalisisControls({
  desdeA,
  hastaA,
  desdeB,
  hastaB,
  bucketsDisponibles,
}: {
  desdeA: string;
  hastaA: string;
  desdeB: string;
  hastaB: string;
  bucketsDisponibles: string[];
}) {
  const ultimo = bucketsDisponibles[bucketsDisponibles.length - 1];
  const preset = (label: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return (
      <a key={label} href={`?${qs}`} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:border-orange hover:text-orange">
        {label}
      </a>
    );
  };

  const offsetMeses = (m: string, n: number) => {
    const [y, mm] = m.split("-").map(Number);
    const d = new Date(y, mm - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const mesAnterior = (m: string) => offsetMeses(m, -1);
  const mesInteranual = (m: string) => offsetMeses(m, -12);
  const inicioAnio = (m: string) => `${m.split("-")[0]}-01`;

  return (
    <form method="get" className="flex flex-col gap-4 rounded-xl border border-border bg-panel p-4">
      <div className="flex flex-wrap gap-2">
        {preset("Este mes vs. mes anterior", { desdeA: ultimo, hastaA: ultimo, desdeB: mesAnterior(ultimo), hastaB: mesAnterior(ultimo) })}
        {preset("Este mes interanual", { desdeA: ultimo, hastaA: ultimo, desdeB: mesInteranual(ultimo), hastaB: mesInteranual(ultimo) })}
        {preset("Últimos 3 meses vs. 3 anteriores", { desdeA: offsetMeses(ultimo, -2), hastaA: ultimo, desdeB: offsetMeses(ultimo, -5), hastaB: offsetMeses(ultimo, -3) })}
        {preset("Año actual vs. año anterior", { desdeA: inicioAnio(ultimo), hastaA: ultimo, desdeB: mesInteranual(inicioAnio(ultimo)), hastaB: mesInteranual(ultimo) })}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 w-full text-xs font-semibold text-orange">Período A</legend>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Desde</span>
            <MesSelect name="desdeA" defaultValue={desdeA} bucketsDisponibles={bucketsDisponibles} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Hasta</span>
            <MesSelect name="hastaA" defaultValue={hastaA} bucketsDisponibles={bucketsDisponibles} />
          </label>
        </fieldset>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 w-full text-xs font-semibold text-blue">Período B</legend>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Desde</span>
            <MesSelect name="desdeB" defaultValue={desdeB} bucketsDisponibles={bucketsDisponibles} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Hasta</span>
            <MesSelect name="hastaB" defaultValue={hastaB} bucketsDisponibles={bucketsDisponibles} />
          </label>
        </fieldset>
        <button type="submit" className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white">
          Comparar
        </button>
      </div>
      <p className="text-[11px] text-text-faint">Cada rango puede abarcar uno o varios meses (ej. Enero–Marzo) — se suman los meses dentro del rango.</p>
    </form>
  );
}
