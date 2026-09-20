import type { Metadata, Viewport } from "next";
import RegisterSw from "@/components/RegisterSw";

export const metadata: Metadata = {
  title: "AgroPulse Ejecutivo",
  manifest: "/manifest-ejecutivo.json",
};

export const viewport: Viewport = {
  themeColor: "#ef7d1e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function EjecutivoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <RegisterSw path="/sw-ejecutivo.js" />
      {children}
    </div>
  );
}
