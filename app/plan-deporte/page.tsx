"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";

type DayPlanRow = {
  day: string;
  tipo_dia: "entreno" | "descanso";
  sport: string | null;

  // NUEVO
  sport_time: string | null; // "HH:MM"
  remind_mode: "none" | "gcal" | "push" | null;
  remind_minutes: number | null;

  gym_workout_id: string | null;

  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

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

// Google Calendar link (evento rápido)
function toGCalLink(opts: {
  title: string;
  dateISO: string; // "YYYY-MM-DD"
  timeHHMM: string; // "HH:MM"
  durationMin?: number; // duración evento
}) {
  const { title, dateISO, timeHHMM, durationMin = 60 } = opts;

  const [hh, mm] = timeHHMM.split(":").map((n) => Number(n));
  const startLocal = new Date(
    `${dateISO}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
  );
  const endLocal = new Date(startLocal.getTime() + durationMin * 60 * 1000);

  // Formato UTC requerido por Google: YYYYMMDDTHHMMSSZ
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(".000", "");
  const dates = `${fmt(startLocal)}/${fmt(endLocal)}`;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", dates);
  return url.toString();
}

export default function PlanDiaPage() {
  return (
    <AuthGate>
      <PlanDiaInner />
    </AuthGate>
  );
}

function PlanDiaInner() {
  const [userId, setUserId] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    ymd(startOfWeekMonday(new Date()))
  );
  const [rows, setRows] = useState<DayPlanRow[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(todayISO());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState<string>("");
  const [drawerNotes, setDrawerNotes] = useState<string>("");
  const [drawerItems, setDrawerItems] = useState<WorkoutExercise[]>([]);

  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // cargar catálogo de rutinas
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

  const daysOfWeek = useMemo(() => {
    const s = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // cargar semana
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setStatus("");
      // base week
      const base: DayPlanRow[] = daysOfWeek.map((d) => ({
        day: ymd(d),
        tipo_dia: "entreno",
        sport: null,

        // NUEVO (defaults)
        sport_time: null,
        remind_mode: "none",
        remind_minutes: 30,

        gym_workout_id: null,
        desayuno_plato: null,
        comida_plato: null,
        merienda_plato: null,
        cena_plato: null,
      }));

      const { data, error } = await supabase
        .from("week_plan_days")
        .select(
          "day,tipo_dia,sport,sport_time,remind_mode,remind_minutes,gym_workout_id,desayuno_plato,comida_plato,merienda_plato,cena_plato"
        )
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .order("day", { ascending: true });

      if (error) {
        setRows(base);
        setStatus("No pude cargar la semana (usando plantilla).");
        return;
      }

      const map = new Map<string, any>();
      (data ?? []).forEach((r: any) => map.set(r.day, r));

      const merged = base.map((b) => {
        const r = map.get(b.day);
        if (!r) return b;
        return {
          ...b,
          tipo_dia: (r.tipo_dia ?? b.tipo_dia) as any,
          sport: r.sport ?? null,

          // NUEVO
          sport_time: r.sport_time ?? null,
          remind_mode: (r.remind_mode ?? b.remind_mode) as any,
          remind_minutes: r.remind_minutes ?? b.remind_minutes,

          gym_workout_id: r.gym_workout_id ?? null,
          desayuno_plato: r.desayuno_plato ?? null,
          comida_plato: r.comida_plato ?? null,
          merienda_plato: r.merienda_plato ?? null,
          cena_plato: r.cena_plato ?? null,
        };
      });

      setRows(merged);
    })();
  }, [userId, weekStart, daysOfWeek]);

  function setRow(day: string, patch: Partial<DayPlanRow>) {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  }

  async function saveWeek() {
    if (!userId) return;
    setStatus("Guardando…");

    const payload = rows.map((r) => ({
      user_id: userId,
      week_start: weekStart,
      day: r.day,
      tipo_dia: r.tipo_dia,
      sport: r.sport,

      // NUEVO
      sport_time: r.sport_time,
      remind_mode: r.remind_mode,
      remind_minutes: r.remind_minutes,

      gym_workout_id: r.gym_workout_id,
      desayuno_plato: r.desayuno_plato,
      comida_plato: r.comida_plato,
      merienda_plato: r.merienda_plato,
      cena_plato: r.cena_plato,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("week_plan_days")
      .upsert(payload, { onConflict: "user_id,day" });

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
      .select(
        "id,template_id,order,exercise_name,sets,reps_min,reps_max,rir_min,rir_max,rest_sec,notes"
      )
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
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 className="h1" style={{ marginBottom: 6 }}>
              Plan día
            </h1>
            <p className="p">
              Modo flexible: elige deporte y (si es gimnasio) elige rutina. Guarda
              por semanas.
            </p>
          </div>
          <span className="badge">
            Semana: <b>{weekStart}</b>
          </span>
        </div>

        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>
            ←
          </button>
          <button
            className="btn"
            onClick={() => setWeekStart(ymd(startOfWeekMonday(new Date())))}
          >
            Ir a esta semana
          </button>
          <button className="btn" onClick={() => shiftWeek(1)}>
            →
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <button className="btn primary" onClick={saveWeek}>
            Guardar semana
          </button>
          {status ? <span className="small">{status}</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const isGym = r.sport === "Gimnasio";
          const tplName = templates.find((t) => t.id === r.gym_workout_id)?.name ?? "";

          const hasSport = !!r.sport && r.sport !== "Descanso";

          return (
            <div key={r.day} className="card">
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <div style={{ fontWeight: 900 }}>{r.day}</div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className={`btn ${r.tipo_dia === "entreno" ? "primary" : ""}`}
                    onClick={() => setRow(r.day, { tipo_dia: "entreno" })}
                  >
                    Entreno
                  </button>
                  <button
                    className={`btn ${r.tipo_dia === "descanso" ? "primary" : ""}`}
                    onClick={() => setRow(r.day, { tipo_dia: "descanso" })}
                  >
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
                    // Si cambias a NO gimnasio, limpiamos rutina
                    setRow(r.day, {
                      sport: v,
                      gym_workout_id: v === "Gimnasio" ? r.gym_workout_id : null,
                    });
                  }}
                >
                  <option value="">—</option>
                  {SPORT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* NUEVO: Hora + Google Calendar */}
              {hasSport ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div>
                    <div className="label">Hora del deporte</div>
                    <input
                      className="input"
                      type="time"
                      value={r.sport_time ?? ""}
                      onChange={(e) =>
                        setRow(r.day, { sport_time: e.target.value || null })
                      }
                    />
                  </div>

                  <div>
                    <div className="label">Recordatorio</div>
                    <select
                      className="input"
                      value={r.remind_mode ?? "none"}
                      onChange={(e) =>
                        setRow(r.day, { remind_mode: e.target.value as any })
                      }
                    >
                      <option value="none">Ninguno</option>
                      <option value="gcal">Google Calendar</option>
                      <option value="push">Notificación (push)</option>
                    </select>
                  </div>

                  <div>
                    <div className="label">Avisar antes (min)</div>
                    <select
                      className="input"
                      value={String(r.remind_minutes ?? 30)}
                      onChange={(e) =>
                        setRow(r.day, { remind_minutes: Number(e.target.value) })
                      }
                    >
                      {[5, 10, 15, 30, 60, 90].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {r.remind_mode === "gcal" ? (
                    <div className="row" style={{ gap: 10 }}>
                      <button
                        className="btn"
                        disabled={!r.sport_time}
                        onClick={() => {
                          const title = `Deporte: ${r.sport}${
                            r.sport === "Gimnasio" && tplName ? " · " + tplName : ""
                          }`;

                          const link = toGCalLink({
                            title,
                            dateISO: r.day,
                            timeHHMM: r.sport_time ?? "12:00",
                            durationMin: 60,
                          });

                          window.open(link, "_blank");
                        }}
                      >
                        Añadir a Google Calendar
                      </button>
                      {!r.sport_time ? (
                        <span className="small">
                          Pon una hora para poder crear el evento.
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isGym ? (
                <div style={{ marginTop: 10 }}>
                  <div className="label">Rutina de gimnasio</div>
                  <select
                    className="input"
                    value={r.gym_workout_id ?? ""}
                    onChange={(e) =>
                      setRow(r.day, { gym_workout_id: e.target.value || null })
                    }
                  >
                    <option value="">—</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <div className="row" style={{ marginTop: 10, gap: 10 }}>
                    <button
                      className="btn"
                      onClick={() => openWorkout(r.day)}
                      disabled={!r.gym_workout_id}
                    >
                      Ver rutina
                    </button>
                    {tplName ? (
                      <span className="small" style={{ alignSelf: "center" }}>
                        {tplName}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* (Opcional) Aquí luego conectaremos el plan de comidas por día */}
            </div>
          );
        })}
      </div>

      {/* Drawer simple */}
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
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ fontWeight: 900 }}>{drawerTitle}</div>
              <button className="btn" onClick={() => setDrawerOpen(false)}>
                Cerrar
              </button>
            </div>

            {drawerNotes ? (
              <div
                className="small"
                style={{ marginTop: 8, whiteSpace: "pre-wrap" }}
              >
                {drawerNotes}
              </div>
            ) : null}

            {drawerLoading ? (
              <div className="small" style={{ marginTop: 12 }}>
                Cargando rutina…
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {drawerItems.map((x) => (
                  <div
                    key={x.id}
                    className="card"
                    style={{
                      marginBottom: 10,
                      background: "rgba(255,255,255,.03)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {x.order}. {x.exercise_name}
                    </div>
                    <div className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
                      Series: <b>{x.sets}</b>{" "}
                      {x.reps_min || x.reps_max ? (
                        <>
                          · Reps: <b>{x.reps_min ?? "—"}–{x.reps_max ?? "—"}</b>
                        </>
                      ) : null}
                      {x.rir_min || x.rir_max ? (
                        <>
                          {" "}
                          · RIR: <b>{x.rir_min ?? "—"}–{x.rir_max ?? "—"}</b>
                        </>
                      ) : null}
                      {x.rest_sec ? (
                        <>
                          {" "}
                          · Descanso: <b>{x.rest_sec}s</b>
                        </>
                      ) : null}
                      {x.notes ? (
                        <div style={{ marginTop: 6, opacity: 0.9 }}>
                          Nota: {x.notes}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!drawerItems.length ? (
                  <div className="small">No hay ejercicios en esta rutina.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
