"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { inputStyle } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setCargando(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-sm rounded-2xl bg-panel p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <Image src="/brand/logo_agropulse.png" alt="AgroPulse" width={140} height={70} />
          <p className="mt-2 text-xs text-text-muted">Portal on-premise de Agroindustrias del Istmo</p>
        </div>
        <form onSubmit={entrar} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} required />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <button type="submit" disabled={cargando} className="mt-2 rounded-xl bg-orange py-3 text-sm font-bold text-white disabled:opacity-60">
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
