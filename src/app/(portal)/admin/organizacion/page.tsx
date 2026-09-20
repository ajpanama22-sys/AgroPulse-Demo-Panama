import { db } from "@/lib/db/client";
import { organizacion } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import OrganizacionForm from "@/components/OrganizacionForm";

export default async function OrganizacionPage() {
  const [org] = await db.select().from(organizacion).limit(1);
  return (
    <div>
      <PageHeader title="Organización" subtitle="Matrícula del cliente en el sistema — nombre, dirección y logo para los reportes (despliegue on-premise, un cliente por instancia)" />
      <div className="px-8 py-6">
        <OrganizacionForm org={org ? { nombre: org.nombre, direccion: org.direccion, logoUrl: org.logoUrl } : null} />
      </div>
    </div>
  );
}
