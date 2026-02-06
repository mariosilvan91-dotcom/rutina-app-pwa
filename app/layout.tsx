"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="nav">
      <Link href="/" className={isActive("/") ? "active" : ""}>Hoy</Link>
      <Link href="/plan-dia" className={isActive("/plan-dia") ? "active" : ""}>Plan día</Link>
      <Link href="/historia" className={isActive("/historia") ? "active" : ""}>Histórico</Link>
      <Link href="/alimentos" className={isActive("/alimentos") ? "active" : ""}>Alimentos</Link>
      <Link href="/platos" className={isActive("/platos") ? "active" : ""}>Platos</Link>
      <Link href="/ajustes" className={isActive("/ajustes") ? "active" : ""}>Ajustes</Link>
      <Link href="/cuenta" className={isActive("/cuenta") ? "active" : ""}>Cuenta</Link>
    </div>
  );
}
