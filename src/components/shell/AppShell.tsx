"use client";

// Shell común de AgroPulse con la misma presentación de PharmaLab AI:
// sidebar oscuro con conmutador de modal (aquí, uno por línea de negocio),
// navegación de vistas del modal activo, sección común y pie con tema,
// instalación y usuario.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/lib/use-theme";
import { signOut } from "next-auth/react";
import Icon from "@/components/icons";
import { LINEAS, lineaPorSlug, vistasDe, type LineaSlug } from "@/lib/lineas-config";

const ROL: Record<string, string> = { admin: "Administrador", gerencial: "Gerencia", coordinacion: "Coordinación", supervisor: "Supervisor", campo: "Campo" };

const COMUNES = [
  { href: "/consolidado", label: "Consolidado", icon: "layers" },
  { href: "/admin/analisis", label: "Análisis comparativo", icon: "chart" },
  { href: "/reportes", label: "Todos los reportes", icon: "report" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users" },
  { href: "/admin/auditoria", label: "Auditoría", icon: "shield" },
  { href: "/admin/organizacion", label: "Organización", icon: "building" },
];

const TITULOS: Record<string, [string, string]> = {
  "/consolidado": ["AGROINDUSTRIAS DEL ISTMO · COMÚN", "Consolidado de las cuatro líneas"],
  "/admin/analisis": ["AGROINDUSTRIAS DEL ISTMO · COMÚN", "Análisis comparativo"],
  "/reportes": ["AGROINDUSTRIAS DEL ISTMO · COMÚN", "Todos los reportes"],
  "/admin/usuarios": ["ADMINISTRACIÓN", "Usuarios"],
  "/admin/auditoria": ["ADMINISTRACIÓN", "Auditoría"],
  "/admin/organizacion": ["ADMINISTRACIÓN", "Organización"],
  "/pollo": ["POLLO · DETALLE", "Pollo de Engorde"],
};

export default function AppShell({ nombre, rol, permitidas, children }: { nombre: string; rol: string; permitidas: LineaSlug[]; children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rutaMenu, setRutaMenu] = useState(pathname);
  const { theme, toggle: toggleTheme } = useTheme();
  // Al navegar se cierra el menú móvil.
  if (rutaMenu !== pathname) {
    setRutaMenu(pathname);
    setOpen(false);
  }

  const seg = pathname.split("/").filter(Boolean);
  const enLinea = seg[0] === "linea" && lineaPorSlug(seg[1] ?? "");
  const linea = enLinea ? lineaPorSlug(seg[1])! : pathname.startsWith("/pollo") ? lineaPorSlug("pollo")! : null;
  const vista = enLinea ? seg[2] ?? "" : pathname.startsWith("/pollo") ? "detalle" : null;
  const lineas = LINEAS.filter((l) => permitidas.includes(l.slug));
  const initials = nombre.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const [crumb, title] = linea
    ? [`${linea.nombre.toUpperCase()} · MODAL ${linea.numero}`, vistasDe(linea).find((v) => v.id === vista)?.label ?? linea.titulo]
    : TITULOS[pathname] ?? ["AGROINDUSTRIAS DEL ISTMO", "AgroPulse"];

  const cambiar = (slug: LineaSlug) => {
    const destino = lineaPorSlug(slug)!;
    const v = vista && vistasDe(destino).some((x) => x.id === vista) ? vista : "";
    router.push(`/linea/${slug}${v ? `/${v}` : ""}`);
  };

  return (
    <div
      className={`app${open ? " open" : ""}`}
      data-modal={linea?.slug}
      data-theme={theme}
      onClick={(e) => {
        if (open && (e.target as HTMLElement).classList.contains("app")) setOpen(false);
      }}
    >
      <aside className="sidebar" aria-label="Navegación principal">
        <Link href="/" className="sbBrand">
          <span className="sbLogo">
            <img src="/brand/logo_agropulse.png" alt="" width={30} height={30} style={{ objectFit: "contain" }} />
          </span>
          <span>
            <span className="brandName">
              Agro<b>Pulse</b>
            </span>
            <span className="brandSub">AGROINDUSTRIAS DEL ISTMO</span>
          </span>
        </Link>

        <p className="sbLabel">MODAL</p>
        <div className={`modalSwitch${lineas.length < 2 ? " single" : ""}`} role="group" aria-label="Línea de negocio">
          {lineas.map((l) => (
            <button key={l.slug} type="button" aria-pressed={linea?.slug === l.slug} onClick={() => cambiar(l.slug)} style={{ ["--lc" as string]: l.color }}>
              <Icon name={l.navIcon} />
              {l.nombre}
            </button>
          ))}
        </div>

        {linea && (
          <>
            <p className="sbLabel">{linea.titulo.toUpperCase()}</p>
            <nav className="sbNav">
              {vistasDe(linea).map((v) => (
                <Link key={v.id} href={`/linea/${linea.slug}${v.id ? `/${v.id}` : ""}`} aria-current={vista === v.id ? "page" : undefined}>
                  <Icon name={v.icon} />
                  {v.label}
                </Link>
              ))}
            </nav>
          </>
        )}

        <p className="sbLabel">COMÚN</p>
        <nav className="sbNav">
          {COMUNES.map((c) => (
            <Link key={c.href} href={c.href} aria-current={pathname === c.href ? "page" : undefined}>
              <Icon name={c.icon} />
              {c.label}
            </Link>
          ))}
        </nav>

        <div className="sbFoot">
          <div className="sbTools">
            <button className="sbTool" type="button" onClick={toggleTheme} aria-label="Cambiar tema">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={14} /> {theme === "dark" ? "Claro" : "Oscuro"}
            </button>
            <Link className="sbTool" href="/">
              <Icon name="grid" size={14} /> Modales
            </Link>
          </div>
          <div className="sbUser">
            <span className="sbAvatar">{initials}</span>
            <div>
              <b>{nombre}</b>
              <span>{ROL[rol] ?? rol}</span>
            </div>
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="menuBtn chip" type="button" onClick={() => setOpen(!open)} aria-label="Abrir menú">
              <Icon name="menu" size={16} />
            </button>
            <div>
              <p className="crumb">{crumb}</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topTools">
            <span className="chip">
              <i />
              Agroindustrias del Istmo · datos de demostración
            </span>
          </div>
        </div>
        <main className="view">
          {children}
          <footer>AgroPulse · Agroindustrias del Istmo · Cifras sintéticas de demostración</footer>
        </main>
      </div>
    </div>
  );
}
