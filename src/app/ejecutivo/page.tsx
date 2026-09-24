import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { alertas, capturas, ubicaciones, empresas, edrLineas } from "@/lib/db/schema";
import { unidadColor } from "@/lib/theme";
import ProductIcon3D from "@/components/ProductIcon3D";
import InstallPwaButton from "@/components/InstallPwaButton";
import SignOutButton from "@/components/SignOutButton";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function EjecutivoPage() {
  const session = await auth();
  const periodo = "2026-07";
  const [alertasActivas, ubic, empresasAll, edr] = await Promise.all([
    db.select().from(alertas).where(eq(alertas.resuelta, false)).orderBy(desc(alertas.creadaEn)),
    db.select().from(ubicaciones),
    db.select().from(empresas),
    db.select().from(edrLineas).where(eq(edrLineas.periodo, periodo)),
  ]);

  const cojedes = ubic.find((u) => u.nombre.toLowerCase().includes("cojedes"));
  const engorde = ubic.find((u) => u.nombre.toLowerCase().includes("engorde"));
  const guarico = ubic.find((u) => u.nombre.toLowerCase().includes("guár") || u.nombre.toLowerCase().includes("guar"));

  const [capHuevos, capPollo, capCerdo] = await Promise.all([
    cojedes ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, cojedes.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
    engorde ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, engorde.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
    guarico ? db.select().from(capturas).where(and(eq(capturas.ubicacionId, guarico.id), eq(capturas.fecha, "2026-08-28"))).limit(1) : Promise.resolve([]),
  ]);
  const valHuevos = (capHuevos[0]?.valores ?? {}) as Record<string, { causado: number }>;
  const valPollo = (capPollo[0]?.valores ?? {}) as Record<string, { causado: number }>;
  const valCerdo = (capCerdo[0]?.valores ?? {}) as Record<string, { causado: number }>;

  const empresaNombre = Object.fromEntries(empresasAll.map((e) => [e.id, e.nombre]));
  const ebitdaLineas = edr.filter((l) => l.concepto === "(=) EBITDA");
  const ebitdaTotal = ebitdaLineas.reduce((s, l) => s + Number(l.causado), 0);
  const ebitdaMeta = ebitdaLineas.reduce((s, l) => s + Number(l.meta), 0);
  const utilidadNeta = edr.filter((l) => l.concepto === "(=) UTILIDAD NETA").reduce((s, l) => s + Number(l.causado), 0);
  const ingresos = edr.filter((l) => l.concepto.includes("Ingresos por Ventas")).reduce((s, l) => s + Number(l.causado), 0);

  return (
    <div className="mx-auto min-h-screen max-w-md pb-10">
      <header className="bg-charcoal px-5 pb-5 pt-6 text-white">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Agro<span className="text-orange">Pulse</span>
          </h1>
          <InstallPwaButton label="Instalar" />
        </div>
        <p className="mt-1 text-xs text-white/60">Panel Ejecutivo · Agroindustrias del Istmo</p>
      </header>

      {alertasActivas.length > 0 && (
        <div className="flex flex-col gap-2 px-5 pt-4">
          {alertasActivas.slice(0, 3).map((a) => (
            <div key={a.id} className="rounded-xl border border-[var(--warning-border,#f4c98b)] bg-[var(--warning-bg,#fdf0e0)] px-4 py-2.5 text-xs">
              <p className="font-bold text-orange-deep">{a.titulo}</p>
              <p className="mt-0.5 text-charcoal">{a.detalle}</p>
            </div>
          ))}
        </div>
      )}

      <main className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <ExecTile tipo="huevo" accent={unidadColor.huevos} label="Producción Huevos" value={`${valHuevos.produccion_cajas?.causado ?? "—"} cj`} />
          <ExecTile tipo="pollo" accent={unidadColor.pollo} label="Mortalidad Pollo" value={`${valPollo.mortalidad?.causado ?? "—"}%`} />
          <ExecTile tipo="cerdo" accent={unidadColor.cerdo} label="Peso Engorde Cerdo" value={`${valCerdo.peso_engorde?.causado ?? "—"} kg`} />
          <ExecTile tipo="aba" accent={unidadColor.aba} label="EBITDA / meta" value={`${Math.round((ebitdaTotal / ebitdaMeta) * 100)}%`} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Estado de Resultados — {periodo}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-text-muted">Ingresos</span>
            <span className="font-display text-lg font-bold text-charcoal">{fmtMoney(ingresos)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-text-muted">EBITDA</span>
            <span className="font-display text-lg font-bold text-charcoal">{fmtMoney(ebitdaTotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold text-charcoal">Utilidad Neta</span>
            <span className="font-display text-xl font-extrabold text-orange">{fmtMoney(utilidadNeta)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {ebitdaLineas.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
              <span className="text-sm font-medium text-charcoal">{empresaNombre[l.empresaId]?.split(" - ")[0]}</span>
              <span className="text-sm font-bold text-charcoal">{fmtMoney(Number(l.causado))}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <a href="/api/reportes/pdf" className="text-xs font-semibold text-orange">
            Descargar reporte PDF
          </a>
          <SignOutButton className="text-xs text-text-faint" />
        </div>
        <p className="mt-1 text-[10px] text-text-faint">Conectado como {session?.user.name}</p>
      </main>
    </div>
  );
}

function ExecTile({ tipo, accent, label, value }: { tipo: "huevo" | "pollo" | "cerdo" | "aba"; accent: string; label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-panel p-3">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-center gap-2">
        <ProductIcon3D tipo={tipo} size={44} />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-faint">{label}</p>
          <p className="truncate font-display text-lg font-bold text-charcoal">{value}</p>
        </div>
      </div>
    </div>
  );
}
