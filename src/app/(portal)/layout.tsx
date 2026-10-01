import { auth } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";
import { lineasPermitidas } from "@/lib/lineas-config";
import { unidadDelUsuario } from "@/lib/lineas-data";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const rol = session?.user.rol ?? "admin";
  const permitidas = lineasPermitidas(rol, await unidadDelUsuario(session?.user.empresaId));
  return (
    <AppShell nombre={session?.user.name ?? "Admin"} rol={rol} permitidas={permitidas}>
      {children}
    </AppShell>
  );
}
