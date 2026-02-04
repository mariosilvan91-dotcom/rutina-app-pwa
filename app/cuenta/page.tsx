"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CuentaPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessionEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp() {
    setMsg(null);
    const { error } = await supabase.auth.signUp({ email, password: pass });
    setMsg(error ? error.message : "Registro OK. Revisa tu email si pide confirmación.");
  }

  async function signIn() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setMsg(error ? error.message : "Login OK ✅");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("Sesión cerrada");
  }

  return (
    <div className="grid">
      <div className="card" style={{gridColumn:"span 12"}}>
        <h1 className="h1">Cuenta</h1>
        <p className="p">Email/contraseña (Supabase). Si ya estás logueado, verás tu email abajo.</p>
      </div>

      <div className="card" style={{gridColumn:"span 12"}}>
        <div className="row" style={{alignItems:"end"}}>
          <div style={{flex:2, minWidth:240}}>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" />
          </div>
          <div style={{flex:1, minWidth:180}}>
            <div className="label">Contraseña</div>
            <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="********" />
          </div>
          <button className="btn primary" onClick={signIn}>Entrar</button>
          <button className="btn" onClick={signUp}>Registrarme</button>
          <button className="btn danger" onClick={signOut}>Salir</button>
        </div>

        {msg && <p className="small" style={{marginTop:10}}>{msg}</p>}
        <p className="small" style={{marginTop:10}}>Sesión actual: <b>{sessionEmail ?? "—"}</b></p>
      </div>
    </div>
  );
}
