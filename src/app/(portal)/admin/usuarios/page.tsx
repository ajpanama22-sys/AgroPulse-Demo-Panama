import { db } from "@/lib/db/client";
import { usuarios, empresas, ubicaciones } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import UsuariosClient from "@/components/UsuariosClient";

export default async function UsuariosPage() {
  const [lista, empresasAll, ubicacionesAll] = await Promise.all([
    db.select().from(usuarios).orderBy(usuarios.creadoEn),
    db.select().from(empresas),
    db.select().from(ubicaciones),
  ]);

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Roles y accesos — campo, gerencial y administración" />
      <div className="px-8 py-6">
        <UsuariosClient
          usuarios={lista.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, empresaId: u.empresaId, ubicacionId: u.ubicacionId }))}
          empresas={empresasAll.map((e) => ({ id: e.id, nombre: e.nombre }))}
          ubicaciones={ubicacionesAll.map((u) => ({ id: u.id, nombre: u.nombre, empresaId: u.empresaId }))}
        />
      </div>
    </div>
  );
}
