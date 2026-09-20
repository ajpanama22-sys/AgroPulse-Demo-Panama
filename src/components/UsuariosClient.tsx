"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, inputStyle } from "@/components/ui";

type Usuario = { id: string; nombre: string; email: string; rol: string; activo: boolean; empresaId: string | null; ubicacionId: string | null };
type Empresa = { id: string; nombre: string };
type Ubicacion = { id: string; nombre: string; empresaId: string };

const ROL_TONE: Record<string, "orange" | "blue" | "neutral"> = { admin: "orange", gerencial: "blue", campo: "neutral" };

export default function UsuariosClient({ usuarios, empresas, ubicaciones }: { usuarios: Usuario[]; empresas: Empresa[]; ubicaciones: Ubicacion[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "campo", empresaId: "", ubicacionId: "" });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    setError("");
    setCreando(true);
    const res = await fetch("/api/admin/usuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setCreando(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Error al crear usuario");
      return;
    }
    setForm({ nombre: "", email: "", password: "", rol: "campo", empresaId: "", ubicacionId: "" });
    router.refresh();
  }

  async function toggleActivo(id: string, activo: boolean) {
    await fetch("/api/admin/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, activo }) });
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 overflow-x-auto">
        <p className="mb-3 text-sm font-semibold text-charcoal">Usuarios registrados</p>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Rol</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="py-2.5 pr-4 font-medium text-charcoal">{u.nombre}</td>
                <td className="py-2.5 pr-4 text-text-muted">{u.email}</td>
                <td className="py-2.5 pr-4">
                  <Badge tone={ROL_TONE[u.rol]}>{u.rol}</Badge>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge tone={u.activo ? "success" : "danger"}>{u.activo ? "activo" : "inactivo"}</Badge>
                </td>
                <td className="py-2.5">
                  <button onClick={() => toggleActivo(u.id, !u.activo)} className="text-xs font-semibold text-blue">
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-charcoal">Nuevo usuario</p>
        <div className="flex flex-col gap-3">
          <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={inputStyle} />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputStyle} />
          <input placeholder="Contraseña" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputStyle} />
          <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))} className={inputStyle}>
            <option value="campo">Campo</option>
            <option value="gerencial">Gerencial</option>
            <option value="admin">Admin</option>
          </select>
          {form.rol === "campo" && (
            <select value={form.ubicacionId} onChange={(e) => setForm((f) => ({ ...f, ubicacionId: e.target.value, empresaId: ubicaciones.find((u) => u.id === e.target.value)?.empresaId ?? "" }))} className={inputStyle}>
              <option value="">Ubicación (opcional)</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button onClick={crear} disabled={creando}>
            {creando ? "Creando…" : "Crear usuario"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
