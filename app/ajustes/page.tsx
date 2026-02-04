"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Settings = {
  kcal_entreno: number;
  kcal_descanso: number;
  p_prot: number;
  p_carb: number;
  p_grasa: number;
  agua_obj_l: number;
  pasos_obj: number;
  sueno_obj_h: number;
};

export default function AjustesPage() {
  return (
    <AuthGate>
      <AjustesInner />
    </AuthGate>
  );
}

function AjustesInner() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setS(data as any);
    })();
  }, []);

  async function save() {
    if (!s) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...s, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : "Guardado ✅");
  }

  if (!s) return <div className="card">Cargando ajustes…</div>;

  return (
    <div className="grid">
      <div className="card" style={{gridColumn:"span 12"}}>
        <h1 className="h1">Ajustes</h1>
        <p className="p">Objetivos editables (kcal y hábitos).</p>
      </div>

      <div className="card" style={{gridColumn:"span 12"}}>
        <div className="grid">
          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Kcal entreno</div>
            <input className="input" type="number" value={s.kcal_entreno} onChange={e=>setS({...s, kcal_entreno:Number(e.target.value)})}/>
          </div>
          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Kcal descanso</div>
            <input className="input" type="number" value={s.kcal_descanso} onChange={e=>setS({...s, kcal_descanso:Number(e.target.value)})}/>
          </div>

          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">% Prot</div>
            <input className="input" type="number" step="0.01" value={s.p_prot} onChange={e=>setS({...s, p_prot:Number(e.target.value)})}/>
          </div>
          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">% Carb</div>
            <input className="input" type="number" step="0.01" value={s.p_carb} onChange={e=>setS({...s, p_carb:Number(e.target.value)})}/>
          </div>
          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">% Grasa</div>
            <input className="input" type="number" step="0.01" value={s.p_grasa} onChange={e=>setS({...s, p_grasa:Number(e.target.value)})}/>
          </div>

          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Agua (L)</div>
            <input className="input" type="number" step="0.1" value={s.agua_obj_l} onChange={e=>setS({...s, agua_obj_l:Number(e.target.value)})}/>
          </div>
          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Pasos</div>
            <input className="input" type="number" value={s.pasos_obj} onChange={e=>setS({...s, pasos_obj:Number(e.target.value)})}/>
          </div>
          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Sueño (h)</div>
            <input className="input" type="number" step="0.1" value={s.sueno_obj_h} onChange={e=>setS({...s, sueno_obj_h:Number(e.target.value)})}/>
          </div>

          <div style={{gridColumn:"span 12"}} className="row">
            <button className="btn primary" onClick={save}>Guardar</button>
            {msg && <span className="small" style={{alignSelf:"center"}}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
