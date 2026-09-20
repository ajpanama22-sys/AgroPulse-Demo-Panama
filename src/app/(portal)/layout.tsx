import { auth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-screen">
      <Sidebar nombre={session?.user.name ?? "Admin"} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
