"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Line3D } from "@/components/charts";
import Icon from "@/components/icons";
import { lineaPorSlug, mesCorto } from "@/lib/lineas-config";

export type PickerLinea = { slug: string; causado: (number | null)[]; meta: (number | null)[]; serieNombre: string };

const hide = () => "";

export default function Picker({ nombre, esAdmin, meses, lineas }: { nombre: string; esAdmin: boolean; meses: string[]; lineas: PickerLinea[] }) {
  const router = useRouter();
  const first = nombre.split(" ")[0];
  return (
    <main className="picker">
      <div className="pickerInner">
        <div className="pickerHead">
          <p className="eyebrow" style={{ color: "#8fa6bb" }}>
            AGROINDUSTRIAS DEL ISTMO · AGROPULSE
          </p>
          <h1>Hola, {first}. ¿Qué quieres revisar hoy?</h1>
          <p>Elige una línea de negocio. Puedes cambiar en cualquier momento desde el panel lateral, sin cerrar sesión.</p>
        </div>
        <div className="pickerGrid">
          {lineas.map((x) => {
            const l = lineaPorSlug(x.slug)!;
            return (
              <button key={l.slug} type="button" className="pickCard" style={{ ["--pc" as string]: l.color }} onClick={() => router.push(`/linea/${l.slug}`)}>
                <span className="pickIcon" aria-hidden="true">
                  <Icon name={l.navIcon} size={34} />
                </span>
                <span className="pickTag">
                  MODAL {l.numero} · {l.nombre.toUpperCase()}
                </span>
                <h2>{l.titulo}</h2>
                <p>{l.descripcion}</p>
                <div className="pickPreview" aria-hidden="true">
                  <Line3D
                    labels={meses.map((m) => mesCorto(m).split(" ")[0].slice(0, 1).toUpperCase())}
                    series={[
                      { name: x.serieNombre, values: x.causado, color: l.color },
                      { name: "Meta", values: x.meta, color: "#5b6b7c", dashed: true },
                    ]}
                    axisFormat={hide}
                    height={170}
                  />
                </div>
                <ul>
                  {l.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <span className="pickGo">Entrar al modal de {l.slug === "aba" ? "Planta ABA" : l.nombre.toLowerCase()} →</span>
              </button>
            );
          })}
        </div>
        {esAdmin && (
          <div className="pickFoot">
            <Link href="/consolidado">Consolidado de las cuatro líneas →</Link>
            <Link href="/reportes">Todos los reportes →</Link>
          </div>
        )}
      </div>
    </main>
  );
}
