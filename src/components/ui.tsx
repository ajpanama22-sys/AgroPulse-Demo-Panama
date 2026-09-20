import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-panel p-5 shadow-sm ${className}`}>{children}</div>;
}

const BADGE_TONES = {
  success: "bg-[var(--success-dim)] text-success",
  danger: "bg-[var(--danger-dim)] text-danger",
  orange: "bg-orange-dim text-orange",
  blue: "bg-[var(--blue-dim)] text-blue",
  neutral: "bg-panel-2 text-text-muted",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="relative overflow-hidden">
      {accent && <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
      <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-charcoal">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: { children: ReactNode; variant?: "primary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-orange text-white hover:bg-[var(--orange-bright)]"
      : "bg-transparent text-charcoal border border-border hover:bg-panel-2";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export const inputStyle =
  "w-full rounded-xl border border-border bg-[var(--panel-2)] px-4 py-3 text-base text-charcoal placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
