import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgroPulse — Agroindustrias del Istmo",
  description: "Captura de campo y panel gerencial en tiempo real para las unidades productivas de Agroindustrias del Istmo.",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport = {
  themeColor: "#3c3c3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">{children}</body>
    </html>
  );
}
