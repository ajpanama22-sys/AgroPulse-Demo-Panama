"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, inputStyle } from "@/components/ui";

export default function OrganizacionForm({ org }: { org: { nombre: string; direccion: string | null; logoUrl: string | null } | null }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(org?.nombre ?? "");
  const [direccion, setDireccion] = useState(org?.direccion ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(org?.logoUrl ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function guardar() {
    setGuardando(true);
    setOk(false);
    const fd = new FormData();
    fd.set("nombre", nombre);
    fd.set("direccion", direccion);
    if (logoFile) fd.set("logo", logoFile);
    await fetch("/api/admin/organizacion", { method: "POST", body: fd });
    setGuardando(false);
    setOk(true);
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <div className="flex flex-col gap-3">
        <label>
          <span className="text-xs text-text-muted">Nombre de la empresa</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 ${inputStyle}`} />
        </label>
        <label>
          <span className="text-xs text-text-muted">Dirección (aparece en los reportes)</span>
          <textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} className={`mt-1 ${inputStyle}`} />
        </label>
        <label>
          <span className="text-xs text-text-muted">Logo</span>
          <div className="mt-1 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoPreview && <img src={logoPreview} alt="Logo" width={64} height={64} className="rounded border border-border object-contain" />}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setLogoFile(f);
                  setLogoPreview(URL.createObjectURL(f));
                }
              }}
              className="text-xs"
            />
          </div>
        </label>
        <Button onClick={guardar} disabled={guardando} className="mt-2">
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        {ok && <p className="text-xs font-medium text-success">Guardado.</p>}
      </div>
    </Card>
  );
}
