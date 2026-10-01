"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

// Login con la misma presentación de PharmaLab AI: panel de marca a la
// izquierda con los modales del sistema y tarjeta de acceso a la derecha.
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
    <main className="loginPage">
      <section className="loginBrand">
        <span className="sbLogo">
          <img src="/brand/logo_agropulse.png" alt="" width={42} height={42} style={{ objectFit: "contain" }} />
        </span>
        <p className="eyebrow">AGROINDUSTRIAS DEL ISTMO / ACCESO PRIVADO</p>
        <h1>
          Agro<b>Pulse</b>
        </h1>
        <p className="loginLead">Las cuatro líneas de negocio en un solo portal, con cifras que se pueden verificar.</p>
        <ul>
          <li>
            <b>Huevos y Pollo</b>
            <span>Postura, cajas, engorde, conversión, peso e IEE contra su meta.</span>
          </li>
          <li>
            <b>Cerdo y Planta ABA</b>
            <span>Partos, mortalidad por fase, canal, toneladas por fórmula e insumos.</span>
          </li>
          <li>
            <b>Finanzas de cada línea</b>
            <span>Estado de Resultados real contra meta y consolidado del grupo.</span>
          </li>
        </ul>
      </section>
      <section className="loginCard">
        <h2>Iniciar sesión</h2>
        <p>Usa el usuario y la contraseña que te entregó el administrador.</p>
        <form onSubmit={entrar}>
          <label>
            Correo
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={cargando}>
            {cargando ? "Ingresando…" : "Entrar"}
          </button>
        </form>
        <p role="alert" className="loginError">
          {error}
        </p>
        <p className="footnote">Si perdiste el acceso, solicita el restablecimiento al administrador.</p>
      </section>
    </main>
  );
}
