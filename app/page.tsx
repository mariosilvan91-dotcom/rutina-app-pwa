"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";
import { db, type DayLog } from "@/lib/db";
import { queueUpsertDayLog, syncQueue } from "@/lib/sync";

function boolLabel(v: boolean | null) {
  return v === null ? "—" : v ? "Sí" : "No";
}

type TodayPlan = {
  tipo_dia?: string | null;
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

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

  // ✅ Plan de comidas del día (de week_plan_days)
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);

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

  // ✅ Cargar plan semanal del día (si existe)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("week_plan_days")
        .select("desayuno_plato,comida_plato,merienda_plato,cena_plato,tipo_dia")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();

      if (!error && data) {
        setTodayPlan({
          tipo_dia: (data as any).tipo_dia ?? null,
          desayuno_plato: (data as any).desayuno_plato ?? null,
          comida_plato: (data as any).comida_plato ?? null,
          merienda_plato: (data as any).merienda_plato ?? null,
          cena_plato: (data as any).cena_plato ?? null,
        });
      } else {
        setTodayPlan(null);
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

    const res = await syncQueue();
    setStatus(
      res.ok
        ? `Guardado ✅ (${res.synced ?? 0} sincronizados)`
        : "Guardado offline ✅ (pendiente de sync)"
    );
  }

  async function forceSync() {
    const res = await syncQueue();
    setStatus(res.ok ? `Sincronizado ✅ (${res.synced ?? 0})` : "No hay sesión o sin internet");
  }

  return (
    <div>
      {/* CABECERA */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="h1" style={{ marginBottom: 6 }}>
              HOY
            </h1>
            <p className="p">Rellena y guarda. Funciona offline y sincroniza al volver internet.</p>
          </div>
          <span className="badge">
            Fecha:&nbsp;<b>{day}</b>
          </span>
        </div>
      </div>

      {/* ✅ HOY TOCA (comidas del plan semanal) */}
      {todayPlan ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            🍽️ Hoy toca{todayPlan.tipo_dia ? ` (${todayPlan.tipo_dia})` : ""}
          </div>
          <div className="small" style={{ lineHeight: 1.5 }}>
            {todayPlan.desayuno_plato ? (
              <div>
                • Desayuno: <b>{todayPlan.desayuno_plato}</b>
              </div>
            ) : null}
            {todayPlan.comida_plato ? (
              <div>
                • Comida: <b>{todayPlan.comida_plato}</b>
              </div>
            ) : null}
            {todayPlan.merienda_plato ? (
              <div>
                • Merienda: <b>{todayPlan.merienda_plato}</b>
              </div>
            ) : null}
            {todayPlan.cena_plato ? (
              <div>
                • Cena: <b>{todayPlan.cena_plato}</b>
              </div>
            ) : null}

            {!todayPlan.desayuno_plato &&
            !todayPlan.comida_plato &&
            !todayPlan.merienda_plato &&
            !todayPlan.cena_plato ? (
              <div>— Plan vacío para hoy</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>🍽️ Hoy toca</div>
          <div className="small">
            No hay plan guardado para hoy. Ve a “Plan día” y guarda la semana.
          </div>
        </div>
      )}

      {/* FORMULARIO (MÓVIL: COLUMNA) */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div>
            <div className="label">Gym</div>
            <select
              className="input"
              value={gym === null ? "" : gym ? "1" : "0"}
              onChange={(e) => setGym(e.target.value === "" ? null : e.target.value === "1")}
            >
              <option value="">—</option>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </div>

          <div>
            <div className="label">Dieta OK</div>
            <select
              className="input"
              value={dietOk === null ? "" : dietOk ? "1" : "0"}
              onChange={(e) => setDietOk(e.target.value === "" ? null : e.target.value === "1")}
            >
              <option value="">—</option>
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="label">Agua (L)</div>
              <input
                className="input"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={water ?? ""}
                onChange={(e) => setWater(e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="label">Sueño (h)</div>
              <input
                className="input"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={sleep ?? ""}
                onChange={(e) => setSleep(e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <div className="label">Pasos</div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={steps ?? ""}
              onChange={(e) => setSteps(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>

          <div>
            <div className="label">Notas</div>
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn primary" onClick={save}>
              Guardar día
            </button>
            <button className="btn" onClick={forceSync}>
              Sincronizar ahora
            </button>
          </div>

          {status ? <div className="small">{status}</div> : null}

          <div className="small">
            Estado actual: Gym <b>{boolLabel(gym)}</b> · Dieta <b>{boolLabel(dietOk)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
