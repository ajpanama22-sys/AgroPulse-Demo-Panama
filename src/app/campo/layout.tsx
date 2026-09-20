import type { Metadata, Viewport } from "next";
import RegisterSw from "@/components/RegisterSw";

export const metadata: Metadata = {
  title: "AgroPulse Campo",
  manifest: "/manifest-campo.json",
};

export const viewport: Viewport = {
  themeColor: "#3c3c3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CampoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <RegisterSw path="/sw-campo.js" />
      {children}
    </div>
  );
}
