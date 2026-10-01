import type { ReactNode } from "react";

// Componentes base con la presentación de PharmaLab AI (capa premium.css).
// Mantienen la misma API para que las pantallas existentes no cambien.

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="pageIntro">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="ctrlBar">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`c3-card ${className}`}>{children}</div>;
}

const BADGE_TONES = {
  success: "pill ok",
  danger: "pill bad",
  orange: "pill warn",
  blue: "pill neutral",
  neutral: "pill neutral",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return <span className={BADGE_TONES[tone]}>{children}</span>;
}

export function StatTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="c3-kpi" style={accent ? ({ ["--accent" as string]: accent } as React.CSSProperties) : undefined}>
      <span className="c3-kpiTitle">{label}</span>
      <strong>{value}</strong>
      {hint && (
        <div className="c3-kpiFoot">
          <small className="c3-note">{hint}</small>
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: { children: ReactNode; variant?: "primary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${variant === "primary" ? "repBtn pdf" : "repBtn"} ${className}`} {...props}>
      {children}
    </button>
  );
}

export const inputStyle =
  "w-full rounded-xl border border-border bg-[var(--panel-2)] px-4 py-3 text-base text-charcoal placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
