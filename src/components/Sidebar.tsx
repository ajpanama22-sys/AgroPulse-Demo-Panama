"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

const ITEMS = [
  { href: "/", label: "Panel", icon: "grid" },
  { href: "/admin/analisis", label: "Análisis", icon: "chart" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "users" },
  { href: "/admin/auditoria", label: "Auditoría", icon: "shield" },
  { href: "/admin/organizacion", label: "Organización", icon: "building" },
];

export default function Sidebar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-charcoal text-white">
      <div className="flex items-center gap-2 px-6 py-6">
        <Image src="/brand/logo_agropulse.png" alt="AgroPulse" width={36} height={36} className="rounded" />
        <span className="font-display text-lg font-extrabold tracking-tight">
          Agro<span className="text-orange">Pulse</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-orange text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4">
        <Image src="/brand/logo_jhs.png" alt="JHS Agroindustria" width={64} height={20} style={{ objectFit: "contain" }} className="mb-3 opacity-80" />
        <p className="text-xs text-white/50">Conectado como</p>
        <p className="text-sm font-semibold">{nombre}</p>
        <SignOutButton className="mt-2 inline-block text-xs text-orange" />
      </div>
    </aside>
  );
}
