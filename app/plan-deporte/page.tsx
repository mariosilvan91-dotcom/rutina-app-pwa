"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type WorkoutTemplate = {
  id: string;
  name: string;
  level: string;
  estimated_min: number;
  notes: string | null;
};

type WorkoutExercise = {
  id: string;
  template_id: string;
  order: number;
  exercise_name: string;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rir_min: number | null;
  rir_max: number | null;
  rest_sec: number | null;
  notes: string | null;
};

type SportRow = {
  day: string;
  tipo_dia: string | null;
  sport: string | null;
  gym_workout_id: string | null;
};

const SPORT_OPTIONS = [
  "Descanso",
  "Gimnasio",
  "Natación",
  "Bicicleta",
  "Funcional",
  "Caminar",
  "Movilidad/Estiramientos",
  "HIIT",
  "Correr",
] as const;

function ymd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function PlanDeportePage() {
  return (
    <AuthGate>
      <PlanDeporteInner />
    </AuthGate>
  );
}

function PlanDeporteInner() {
  const [userId, setUserId] = useState("");
  const [weekStart, setWeekStart] = useState(() => ymd(startOfWeekMonday(new Date())));
  const [rows, setRows] = useState<SportRow[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [status, setStatus] = useState("");

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerItems, setDrawerItems] = useState<WorkoutExercise[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  const daysOfWeek = useMemo(() => {
    const s = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [weekStart]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { data, error } = await supabase
        .from("workout_templates")
        .select("id,name,level,estimated_min,notes")
        .order("name", { ascending: true });

      if (!error) setTemplates((data ?? []) as any);
    })();
  }, [userId]);

  // load week sports from week_plan_days (reutilizamos tu tabla)
  useEffect(() => {
    if (!userId) return;

    (async () => {
      setStatus("");

      const base: SportRow[] = daysOfWeek.map((d) => ({
        day: ymd(d),
        tipo_dia: "entreno",
        sport: null,
        gym_workout_id: null,
      }));

      const { data, error } = await supabase
        .from("week_plan_days")
        .select("day,tipo_dia,sport,gym_workout_id")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .order("day", { ascending: true });

      if (error) {
        setRows(base);
        setStatus("No pude cargar la semana (mostrando plantilla).");
        return;
      }

      const map = new Map<string, any>();
      (data ?? []).forEach((r: any) => map.set(r.day, r));

      const merged = base.map((b) => {
        const r = map.get(b.day);
        if (!r) return b;
        return {
          ...b,
          tipo_dia: r.tipo_dia ?? b.tipo_dia,
          sport: r.sport ?? null,
          gym_workout_id: r.gym_workout_id ?? null,
        };
      });

      setRows(merged);
    })();
  }, [userId, weekStart, daysOfWeek]);

  function setRow(day: string, patch: Partial<SportRow>) {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  }

  async function saveWeek() {
    if (!userId) return;
    setStatus("Guardando…");

    // upsert SOLO lo de deporte/rutina (sin tocar comidas)
    const payload = rows.map((r) => ({
      user_id: userId,
      week_start: weekStart,
      day: r.day,
      tipo_dia: r.tipo_dia ?? "entreno",
      sport: r.sport,
      gym_workout_id: r.gym_workout_id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("week_plan_days").upsert(payload, { onConflict: "user_id,day" });
    setStatus(error ? `Error guardando: ${error.message}` : "Semana guardada ✅");
  }

  async function openWorkout(day: string) {
    const r = rows.find((x) => x.day === day);
    if (!r?.gym_workout_id) return;

    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerItems([]);
    setDrawerTitle("Rutina");
    setDrawerNotes("");

    const tpl = templates.find((t) => t.id === r.gym_workout_id);
    if (tpl) {
      setDrawerTitle(tpl.name);
      setDrawerNotes(tpl.notes ?? "");
    }

    const { data, error } = await supabase
      .from("workout_exercises")
      .select("id,template_id,order,exercise_name,sets,reps_min,reps_max,rir_min,rir_max,rest_sec,notes")
      .eq("template_id", r.gym_workout_id)
      .order("order", { ascending: true });

    setDrawerLoading(false);

    if (error) {
      setDrawerNotes((s) => (s ? s + "\n" : "") + `Error: ${error.message}`);
      return;
    }
    setDrawerItems((data ?? []) as any);
  }

  function shiftWeek(delta: number) {
    const s = new Date(weekStart);
    s.setDate(s.getDate() + delta * 7);
    setWeekStart(ymd(startOfWeekMonday(s)));
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="h1" style={{ marginBottom: 6 }}>Plan deporte</h1>
            <p className="p">Elige deporte por día. Si es gimnasio, elige rutina y mira ejercicios.</p>
          </div>
          <span className="badge">Semana: <b>{weekStart}</b></span>
        </div>

        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>←</button>
          <button className="btn" onClick={() => setWeekStart(ymd(startOfWeekMonday(new Date())))}>Ir a esta semana</button>
          <button className="btn" onClick={() => shiftWeek(1)}>→</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <button className="btn primary" onClick={saveWeek}>Guardar semana</button>
          {status ? <span className="small">{status}</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const isGym = r.sport === "Gimnasio";

          return (
            <div key={r.day} className="card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{r.day}</div>

                <div className="row" style={{ gap: 8 }}>
                  <button className={`btn ${r.tipo_dia === "entreno" ? "primary" : ""}`} onClick={() => setRow(r.day, { tipo_dia: "entreno" })}>
                    Entreno
                  </button>
                  <button className={`btn ${r.tipo_dia === "descanso" ? "primary" : ""}`} onClick={() => setRow(r.day, { tipo_dia: "descanso" })}>
                    Descanso
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Deporte</div>
                <select
                  className="input"
                  value={r.sport ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setRow(r.day, { sport: v, gym_workout_id: v === "Gimnasio" ? r.gym_workout_id : null });
                  }}
                >
                  <option value="">—</option>
                  {SPORT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {isGym ? (
                <div style={{ marginTop: 10 }}>
                  <div className="label">Rutina de gimnasio</div>
                  <select
                    className="input"
                    value={r.gym_workout_id ?? ""}
                    onChange={(e) => setRow(r.day, { gym_workout_id: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <div className="row" style={{ marginTop: 10, gap: 10 }}>
                    <button className="btn" onClick={() => openWorkout(r.day)} disabled={!r.gym_workout_id}>
                      Ver rutina
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {drawerOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
            zIndex: 50,
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 980,
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{drawerTitle}</div>
              <button className="btn" onClick={() => setDrawerOpen(false)}>Cerrar</button>
            </div>

            {drawerNotes ? <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{drawerNotes}</div> : null}

            {drawerLoading ? (
              <div className="small" style={{ marginTop: 12 }}>Cargando rutina…</div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {drawerItems.map((x) => (
                  <div key={x.id} className="card" style={{ marginBottom: 10, background: "rgba(255,255,255,.03)" }}>
                    <div style={{ fontWeight: 900 }}>
                      {x.order}. {x.exercise_name}
                    </div>
                    <div className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
                      Series: <b>{x.sets}</b>
                      {x.reps_min || x.reps_max ? <> · Reps: <b>{x.reps_min ?? "—"}–{x.reps_max ?? "—"}</b></> : null}
                      {x.rir_min || x.rir_max ? <> · RIR: <b>{x.rir_min ?? "—"}–{x.rir_max ?? "—"}</b></> : null}
                      {x.rest_sec ? <> · Descanso: <b>{x.rest_sec}s</b></> : null}
                      {x.notes ? <div style={{ marginTop: 6, opacity: 0.9 }}>Nota: {x.notes}</div> : null}
                    </div>
                  </div>
                ))}
                {!drawerItems.length ? <div className="small">No hay ejercicios en esta rutina.</div> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
