"use client";

import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <html lang="es">
      <body>
        <div className="container">
          <Suspense fallback={<div className="card">Cargando…</div>}>
            {children}
          </Suspense>
        </div>

        <nav className="bottom-nav">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            <span className="bn-icon">🏠</span>
            <span className="bn-text">Hoy</span>
          </Link>

          <Link href="/plan-dia" className={isActive("/plan-dia") ? "active" : ""}>
            <span className="bn-icon">🍽️</span>
            <span className="bn-text">Comidas</span>
          </Link>

          <Link href="/plan-deporte" className={isActive("/plan-deporte") ? "active" : ""}>
            <span className="bn-icon">💪</span>
            <span className="bn-text">Deporte</span>
          </Link>

          <Link href="/historia" className={isActive("/historia") ? "active" : ""}>
            <span className="bn-icon">📊</span>
            <span className="bn-text">Histórico</span>
          </Link>

          <Link href="/ajustes" className={isActive("/ajustes") ? "active" : ""}>
            <span className="bn-icon">⚙️</span>
            <span className="bn-text">Ajustes</span>
          </Link>

          <Link href="/cuenta" className={isActive("/cuenta") ? "active" : ""}>
            <span className="bn-icon">👤</span>
            <span className="bn-text">Cuenta</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}
