import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Dizkos | Biomechanics Lab",
    description: "Plataforma premium de analisis biomecanico de running con IA, vision computacional y coaching inteligente.",
    icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
          <html lang="es" className={inter.variable}>
                  <body style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)" }}>
                    {children}
                  </body>body>
          </html>html>
        );
}
