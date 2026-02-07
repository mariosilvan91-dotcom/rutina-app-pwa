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
          {/* Navegación optimizada */}
          <div className="nav" style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "10px", 
            marginBottom: "20px" 
          }}>
            <Link href="/">Hoy</Link>
            <Link href="/plan-dia">Plan día</Link>
            <Link href="/editor-platos">🍳 Recetas</Link> {/* Nueva pestaña */}
            <Link href="/historia">Histórico</Link>
            <Link href="/plan-deporte">Deporte</Link>
            <Link href="/ajustes">Ajustes</Link>
            <Link href="/cuenta">Cuenta</Link>
          </div>

          <Suspense fallback={<div className="card">Cargando…</div>}>
            {children}
          </Suspense>

          <footer style={{ marginTop: 24, borderTop: "1px solid #333", paddingTop: 16 }}>
            <p className="small">
              Tip: en móvil abre en Safari/Chrome → Compartir → “Añadir a pantalla de inicio”.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
