import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Rutina Salud",
  description: "Hábitos + Plan día (PWA)",
  manifest: "/manifest.json",
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="container">
          <div className="nav">
            <Link href="/" className="">Hoy</Link>
            <Link href="/historia">Histórico</Link>
            <Link href="/plan-dia">Plan día</Link>
            <Link href="/plan-deporte">Plan deporte</Link>
            <Link href="/alimentos">Alimentos</Link>
            <Link href="/platos">Platos</Link>
            <Link href="/ajustes">Ajustes</Link>
            <Link href="/cuenta">Cuenta</Link>
          </div>
          <Suspense fallback={<div className="card">Cargando…</div>}>
            {children}
          </Suspense>
          <p className="small" style={{marginTop:16}}>Tip: en móvil abre en Safari/Chrome → Compartir → “Añadir a pantalla de inicio”.</p>
        </div>
      </body>
    </html>
  );
}
