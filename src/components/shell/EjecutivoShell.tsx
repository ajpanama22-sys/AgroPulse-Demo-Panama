"use client";

// Pulse gerencial instalable con la presentación de PharmaLab AI: encabezado
// oscuro, conmutador de modales (Consolidado + las cuatro líneas) y la
// misma vista Pulse del portal, adaptada al teléfono.
import Link from "next/link";
import { useTheme } from "@/lib/use-theme";
import { signOut } from "next-auth/react";
import Icon from "@/components/icons";
import InstallPwaButton from "@/components/InstallPwaButton";
import { LINEAS } from "@/lib/lineas-config";

export default function EjecutivoShell({ nombre, actual, children }: { nombre: string; actual: string; children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const opciones = [{ slug: "consolidado", nombre: "Consolidado", navIcon: "layers", color: "#ef7d1e" }, ...LINEAS];
  return (
    <div className="pwaShell" data-modal={actual === "consolidado" ? undefined : actual} data-theme={theme}>
      <header className="pwaHead">
        <div className="pwaTop">
          <span className="sbBrand" style={{ padding: 0 }}>
            <span className="sbLogo">
              <img src="/brand/logo_agropulse.png" alt="" width={30} height={30} style={{ objectFit: "contain" }} />
            </span>
            <span>
              <span className="brandName">
                Agro<b>Pulse</b>
              </span>
              <span className="brandSub">PULSE GERENCIAL</span>
            </span>
          </span>
          <div className="pwaTools">
            <InstallPwaButton label="Instalar" />
            <button
              type="button"
              className="sbTool"
              aria-label="Cambiar tema"
              onClick={toggle}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
            </button>
            <button type="button" className="sbTool" aria-label="Cerrar sesión" onClick={() => signOut({ callbackUrl: "/login" })}>
              <Icon name="logout" size={14} />
            </button>
          </div>
        </div>
        <nav className="pwaTabs" aria-label="Modales">
          {opciones.map((o) => (
            <Link key={o.slug} href={`/ejecutivo?vista=${o.slug}`} aria-current={actual === o.slug ? "page" : undefined} style={{ ["--lc" as string]: o.color }}>
              <Icon name={o.navIcon} size={16} />
              {o.nombre}
            </Link>
          ))}
        </nav>
        <p className="pwaUser">Conectado como {nombre}</p>
      </header>
      <main className="view pwaView">{children}</main>
    </div>
  );
}
