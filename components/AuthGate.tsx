"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="card">Cargando sesión…</div>;

  if (!authed) {
    return (
      <div className="card">
        <h1 className="h1">Inicia sesión</h1>
        <p className="p">Ve a <a href="/cuenta" style={{textDecoration:"underline"}}>Cuenta</a> para entrar/registrarte.</p>
      </div>
    );
  }

  return <>{children}</>;
}
