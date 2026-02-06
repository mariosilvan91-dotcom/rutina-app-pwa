"use client";

import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

export const metadata = {
  title: "Rutina Salud",
  description: "Hábitos + Plan día (PWA)",
  manifest: "/manifest.json",
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <html lang="es">
      <body>
        <div className="container">
          <div className="nav">
            <Link href="/" className={isActive("/") ? "active" : ""}>Hoy</Link>
            <Link href="/historia" className={isActive("/historia") ? "active" : ""}>Histórico</Link>
            <Link href="/plan-dia" className={isActive("/plan-dia") ? "active" : ""}>Plan día</Link>
            <Link href="/plan-deporte" className={isActive("/plan-deporte") ? "active" : ""}>Plan deporte</Link>
            <Link href="/alimentos" className={isActive("/alimentos") ? "active" : ""}>Alimentos</Link>
            <Link href="/platos" className={isActive("/platos") ? "active" : ""}>Platos</Link>
            <Link href="/ajustes" className={isActive("/ajustes") ? "active" : ""}>Ajustes</Link>
            <Link href="/cuenta" className={isActive("/cuenta") ? "active" : ""}>Cuenta</Link>
          </div>

          <Suspense fallback={<div className="card">Cargando…</div>}>
            {children}
          </Suspense>

          <p className="small" style={{ marginTop: 16 }}>
            Tip: en móvil abre en Safari/Chrome → Compartir → “Añadir a pantalla de inicio”.
          </p>
        </div>
      </body>
    </html>
  );
}
