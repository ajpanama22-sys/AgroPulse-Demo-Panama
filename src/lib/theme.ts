import type { CSSProperties } from "react";

// Paleta AgroPulse — basada en la identidad corporativa del cliente:
// franja/header en charcoal oscuro, acento naranja vivo como acento
// primario, y azul como color secundario. El verde queda reservado solo
// como semántica de "positivo/meta cumplida", no como color de marca —
// el cliente no usa verde como identidad, así que no se fuerza el
// cliché "agro = verde".
export const theme = {
  ink: "#3c3c3a", // charcoal corporativo — headers, texto fuerte, sidebar
  inkSoft: "#6b6b67",
  bgPage: "#f5f2ec", // crema cálido, no blanco puro
  bgCard: "#ffffff",
  border: "#e4dfd3",
  orange: "#ef7d1e", // naranja corporativo — acento primario
  orangeDeep: "#cf6710",
  blue: "#1d5a96", // azul secundario
  blueDeep: "#154573",
  success: "#2f7d4f",
  danger: "#c23b3b",
  warningBg: "#fdf0e0",
  warningBorder: "#f4c98b",
  radius: 14,
  font: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
} as const;

// Un color por unidad de negocio — Huevos y Pollo toman los colores reales
// de sus sub-marcas (Andi Huevos = naranja, Andi Pollo = azul); Cerdo y
// ABA no tienen sub-marca pública, así que reciben un color funcional
// propio para poder diferenciarse en tablas/gráficos.
export const unidadColor: Record<string, string> = {
  huevos: theme.orange,
  pollo: theme.blue,
  cerdo: "#8a3b5c",
  aba: "#4f6b5c",
};

export function pageWrapStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: theme.bgPage,
    color: theme.ink,
    fontFamily: theme.font,
    display: "flex",
  };
}
import type { CSSProperties } from "react";

// Paleta AgroPulse — basada en la identidad corporativa REAL de JHS
// Agroindustria (jhs.com.ve): franja/header en charcoal oscuro, acento
// naranja vivo (el mismo de su CTA "Más de una década" y del empaque
// Andi Huevos), y azul como color secundario (marca Andi Pollo, visible
// en su propio banner). El verde queda reservado solo como semántica de
// "positivo/meta cumplida", no como color de marca — JHS no usa verde
// como identidad, así que no se fuerza el cliché "agro = verde".
export const theme = {
  ink: "#3c3c3a", // charcoal JHS — headers, texto fuerte, sidebar
  inkSoft: "#6b6b67",
  bgPage: "#f5f2ec", // crema cálido, no blanco puro
  bgCard: "#ffffff",
  border: "#e4dfd3",
  orange: "#ef7d1e", // naranja corporativo JHS — acento primario
  orangeDeep: "#cf6710",
  blue: "#1d5a96", // azul secundario JHS (Andi Pollo)
  blueDeep: "#154573",
  success: "#2f7d4f",
  danger: "#c23b3b",
  warningBg: "#fdf0e0",
  warningBorder: "#f4c98b",
  radius: 14,
  font: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
} as const;

// Un color por unidad de negocio — Huevos y Pollo toman los colores reales
// de sus sub-marcas (Andi Huevos = naranja, Andi Pollo = azul); Cerdo y
// ABA no tienen sub-marca pública, así que reciben un color funcional
// propio para poder diferenciarse en tablas/gráficos.
export const unidadColor: Record<string, string> = {
  huevos: theme.orange,
  pollo: theme.blue,
  cerdo: "#8a3b5c",
  aba: "#4f6b5c",
};

export function pageWrapStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: theme.bgPage,
    color: theme.ink,
    fontFamily: theme.font,
    display: "flex",
  };
}
