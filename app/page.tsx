"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";
import { db, type DayLog } from "@/lib/db";
import { queueUpsertDayLog, syncQueue } from "@/lib/sync";

function boolLabel(v: boolean | null) { return v === null ? "—" : (v ? "Sí" : "No"); }

export default function HomePage() {
  return (
    <AuthGate>
      <HoyInner />
    </AuthGate>
  );
}

function HoyInner() {
  const [userId, setUserId] = useState<string>("");
  const [day, setDay] = useState<string>(todayISO());
  const [gym, setGym] = useState<boolean | null>(null);
  const [dietOk, setDietOk] = useState<boolean | null>(null);
  const [water, setWater] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");

  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // Load from local first
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const local = await db.day_logs.where({ user_id: userId, day }).first();
      if (local) {
        setGym(local.gym);
        setDietOk(local.diet_ok);
        setWater(local.water_l);
        setSteps(local.steps);
        setSleep(local.sleep_h);
        setNotes(local.notes ?? "");
      } else {
        // try remote (if online) then cache
        const { data, error } = await supabase
          .from("day_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("day", day)
          .maybeSingle();
        if (!error && data) {
          await db.day_logs.put({ ...(data as any), user_id: userId });
          setGym(data.gym);
          setDietOk(data.diet_ok);
          setWater(data.water_l);
          setSteps(data.steps);
          setSleep(data.sleep_h);
          setNotes(data.notes ?? "");
        }
      }
    })();
  }, [userId, day]);

  async function save() {
    if (!userId) return;
    const log: DayLog = {
      user_id: userId,
      day,
      gym,
      diet_ok: dietOk,
      water_l: water,
      steps,
      sleep_h: sleep,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    await db.day_logs.put(log);
    await queueUpsertDayLog(log);

    // try sync if online
    const res = await syncQueue();
    setStatus(res.ok ? `Guardado ✅ (${res.synced ?? 0} sincronizados)` : "Guardado offline ✅ (pendiente de sync)");
  }

  async function forceSync() {
    const res = await syncQueue();
    setStatus(res.ok ? `Sincronizado ✅ (${res.synced ?? 0})` : "No hay sesión o sin internet");
  }

  return (
    <div className="grid">
      <div className="card" style={{gridColumn:"span 12"}}>
        <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <h1 className="h1">HOY</h1>
            <p className="p">Rellena y guarda. Funciona offline y sincroniza al volver internet.</p>
          </div>
          <span className="badge">Fecha: <b>{day}</b></span>
        </div>
      </div>

      <div className="card" style={{gridColumn:"span 12"}}>
        <div className="grid">
          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Gym</div>
            <select className="input" value={gym === null ? "" : (gym ? "1" : "0")} onChange={e=>setGym(e.target.value===""?null:e.target.value==="1")}>
              <option value="">—</option><option value="1">Sí</option><option value="0">No</option>
            </select>
          </div>

          <div style={{gridColumn:"span 3", minWidth:200}}>
            <div className="label">Dieta OK</div>
            <select className="input" value={dietOk === null ? "" : (dietOk ? "1" : "0")} onChange={e=>setDietOk(e.target.value===""?null:e.target.value==="1")}>
              <option value="">—</option><option value="1">Sí</option><option value="0">No</option>
            </select>
          </div>

          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">Agua (L)</div>
            <input className="input" type="number" step="0.1" value={water ?? ""} onChange={e=>setWater(e.target.value===""?null:Number(e.target.value))} />
          </div>

          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">Pasos</div>
            <input className="input" type="number" value={steps ?? ""} onChange={e=>setSteps(e.target.value===""?null:Number(e.target.value))} />
          </div>

          <div style={{gridColumn:"span 2", minWidth:160}}>
            <div className="label">Sueño (h)</div>
            <input className="input" type="number" step="0.1" value={sleep ?? ""} onChange={e=>setSleep(e.target.value===""?null:Number(e.target.value))} />
          </div>

          <div style={{gridColumn:"span 12"}}>
            <div className="label">Notas</div>
            <input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div style={{gridColumn:"span 12"}} className="row">
            <button className="btn primary" onClick={save}>Guardar día</button>
            <button className="btn" onClick={forceSync}>Sincronizar ahora</button>
            {status && <span className="small" style={{alignSelf:"center"}}>{status}</span>}
          </div>

          <div style={{gridColumn:"span 12"}} className="small">
            Estado actual: Gym <b>{boolLabel(gym)}</b> · Dieta <b>{boolLabel(dietOk)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
