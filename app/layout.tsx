"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopMenu() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="nav">
      <Link href="/" className={isActive("/") ? "active" : ""}>Hoy</Link>
      <Link href="/plan-dia" className={isActive("/plan-dia") ? "active" : ""}>Plan día</Link>
      <Link href="/plan-deporte" className={isActive("/plan-deporte") ? "active" : ""}>Plan deporte</Link>
      <Link href="/historia" className={isActive("/historia") ? "active" : ""}>Histórico</Link>
      <Link href="/ajustes" className={isActive("/ajustes") ? "active" : ""}>Ajustes</Link>
    </div>
  );
}

