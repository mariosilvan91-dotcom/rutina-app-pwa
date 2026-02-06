"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DayLog = {
  day: string;
  gym: boolean | null;
  diet_ok: boolean | null;
  water_l: number | null;
  steps: number | null;
  sleep_h: number | null;
  notes?: string | null;
};

type Settings = {
  agua_obj_l: number;
  pasos_obj: number;
  sueno_obj_h: number;
};

type DayPlan = {
  day: string; // YYYY-MM-DD
  tipo_dia?: string | null;
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

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
function endOfWeekSunday(d: Date) {
  const s = startOfWeekMonday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function okWater(log: DayLog | undefined, s: Settings) {
  return (log?.water_l ?? 0) >= (s.agua_obj_l ?? 0);
}
function okSteps(log: DayLog | undefined, s: Settings) {
  return (log?.steps ?? 0) >= (s.pasos_obj ?? 0);
}
function okSleep(log: DayLog | undefined, s: Settings) {
  return (log?.sleep_h ?? 0) >= (s.sueno_obj_h ?? 0);
}
function okGym(log: DayLog | undefined) {
  return log?.gym === true;
}
function okDiet(log: DayLog | undefined) {
  return log?.diet_ok === true;
}
function score(log: DayLog | undefined, s: Settings) {
  return (
    (okGym(log) ? 1 : 0) +
    (okDiet(log) ? 1 : 0) +
    (okWater(log, s) ? 1 : 0) +
    (okSteps(log, s) ? 1 : 0) +
    (okSleep(log, s) ? 1 : 0)
  );
}

const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"];

export default function HistoriaPage() {
  const [tab, setTab] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [settings, setSettings] = useState<Settings>({
    agua_obj_l: 2.5,
    pasos_obj: 8000,
    sueno_obj_h: 7,
  });
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const range = useMemo(() => {
    if (tab === "week") {
      const s = startOfWeekMonday(anchor);
      const e = endOfWeekSunday(anchor);
      return { from: ymd(s), to: ymd(e), s, e };
    }
    const s = startOfMonth(anchor);
    const e = endOfMonth(anchor);
    return { from: ymd(s), to: ymd(e), s, e };
  }, [tab, anchor]);

  const logMap = useMemo(() => {
    const m = new Map<string, DayLog>();
    logs.forEach((l) => m.set(l.day, l));
    return m;
  }, [logs]);

  const planMap = useMemo(() => {
    const m = new Map<string, DayPlan>();
    plans.forEach((p) => m.set(p.day, p));
    return m;
  }, [plans]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: userRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const userId = userRes.user?.id;
        if (!userId) throw new Error("No estás logueado.");

        const [settingsRes, logsRes, plansRes] = await Promise.all([
          supabase
            .from("user_settings")
            .select("agua_obj_l,pasos_obj,sueno_obj_h")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("day_logs")
            .select("day,gym,diet_ok,water_l,steps,sleep_h,notes,updated_at")
            .eq("user_id", userId)
            .gte("day", range.from)
            .lte("day", range.to)
            .order("day", { ascending: true }),
          supabase
            .from("day_plan")
            .select("day,tipo_dia,desayuno_plato,comida_plato,merienda_plato,cena_plato,updated_at")
            .eq("user_id", userId)
            .gte("day", range.from)
            .lte("day", range.to)
            .order("day", { ascending: true }),
        ]);

        if (!settingsRes.error && settingsRes.data) {
          setSettings({
            agua_obj_l: Number(settingsRes.data.agua_obj_l ?? 2.5),
            pasos_obj: Number(settingsRes.data.pasos_obj ?? 8000),
            sueno_obj_h: Number(settingsRes.data.sueno_obj_h ?? 7),
          });
        }

        if (logsRes.error) throw logsRes.error;
        setLogs((logsRes.data ?? []) as DayLog[]);

        if (plansRes.error) throw plansRes.error;
        setPlans((plansRes.data ?? []) as any);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando histórico");
      } finally {
        setLoading(false);
      }
    })();
  }, [range.from, range.to]);

  const weekDays = useMemo(() => {
    const s = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthGrid = useMemo(() => {
    const s = startOfMonth(anchor);
    const e = endOfMonth(anchor);
    const gridStart = startOfWeekMonday(s);
    const gridEnd = endOfWeekSunday(e);
    const days: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return { days, month: anchor.getMonth() };
  }, [anchor]);

  const weekStats = useMemo(() => {
    let gym = 0,
      diet = 0,
      water = 0,
      steps = 0,
      sleep = 0;
    for (const d of weekDays) {
      const log = logMap.get(ymd(d));
      if (okGym(log)) gym++;
      if (okDiet(log)) diet++;
      if (okWater(log, settings)) water++;
      if (okSteps(log, settings)) steps++;
      if (okSleep(log, settings)) sleep++;
    }
    return { gym, diet, water, steps, sleep };
  }, [weekDays, logMap, settings]);

  const title = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions =
      tab === "week" ? { day: "2-digit", month: "short" } : { month: "long", year: "numeric" };

    if (tab === "week") {
      const s = startOfWeekMonday(anchor);
      const e = endOfWeekSunday(anchor);
      const a = s.toLocaleDateString("es-ES", opts);
      const b = e.toLocaleDateString("es-ES", opts);
      return `${a} — ${b}`;
    }
    return anchor.toLocaleDateString("es-ES", opts);
  }, [tab, anchor]);

  function shiftWeek(delta: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  }
  function shiftMonth(delta: number) {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() + delta);
    setAnchor(d);
  }

  return (
    <div>
      <h1 className="h1">Histórico</h1>

      <div className="row" style={{ gap: 10 }}>
        <button className={`btn ${tab === "week" ? "primary" : ""}`} onClick={() => setTab("week")}>
          Semana
        </button>
        <button className={`btn ${tab === "month" ? "primary" : ""}`} onClick={() => setTab("month")}>
          Mes
        </button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <button className="btn" onClick={() => (tab === "week" ? shiftWeek(-1) : shiftMonth(-1))}>
          ←
        </button>
        <div style={{ fontWeight: 800, textAlign: "center", flex: 1, padding: "0 10px" }}>{title}</div>
        <button className="btn" onClick={() => (tab === "week" ? shiftWeek(1) : shiftMonth(1))}>
          →
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setAnchor(new Date())}>
          Ir a hoy
        </button>
      </div>

      {error ? (
        <div className="card" style={{ borderColor: "rgba(239,68,68,.55)", marginTop: 12 }}>
          <div style={{ color: "#ef4444", fontWeight: 800 }}>Error</div>
          <div className="p">{error}</div>
        </div>
      ) : null}

      {loading ? <div className="small" style={{ marginTop: 12 }}>Cargando…</div> : null}

      {!loading && tab === "week" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            {weekDays.map((d, idx) => {
              const key = ymd(d);
              const log = logMap.get(key);
              const plan = planMap.get(key);
              const sc = score(log, settings);
              const today = key === ymd(new Date());

              return (
                <div
                  key={key}
                  className="card"
                  style={{
                    borderColor: today ? "rgba(255,255,255,.55)" : "var(--border)",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>
                      {DOW_ES[idx]} {d.getDate()}
                    </div>
                    <span className="badge">{sc}/5</span>
                  </div>

                  <div className="small" style={{ marginTop: 10, lineHeight: 1.45 }}>
                    <div>Gym: {okGym(log) ? "✅" : "—"}</div>
                    <div>Dieta: {okDiet(log) ? "✅" : "—"}</div>
                    <div>Agua: {log?.water_l ?? 0}/{settings.agua_obj_l}L {okWater(log, settings) ? "✅" : ""}</div>
                    <div>Pasos: {log?.steps ?? 0}/{settings.pasos_obj} {okSteps(log, settings) ? "✅" : ""}</div>
                    <div>Sueño: {log?.sleep_h ?? 0}/{settings.sueno_obj_h}h {okSleep(log, settings) ? "✅" : ""}</div>
                  </div>

                  {/* ✅ Comidas del día */}
                  {plan ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="label" style={{ marginBottom: 6 }}>🍽️ Comidas</div>
                      <div className="small" style={{ lineHeight: 1.45 }}>
                        {plan.desayuno_plato ? <div>• Desayuno: <b>{plan.desayuno_plato}</b></div> : null}
                        {plan.comida_plato ? <div>• Comida: <b>{plan.comida_plato}</b></div> : null}
                        {plan.merienda_plato ? <div>• Merienda: <b>{plan.merienda_plato}</b></div> : null}
                        {plan.cena_plato ? <div>• Cena: <b>{plan.cena_plato}</b></div> : null}
                        {!plan.desayuno_plato && !plan.comida_plato && !plan.merienda_plato && !plan.cena_plato ? (
                          <div>— Sin plan guardado</div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }} className="small">
                      🍽️ Sin plan guardado
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Resumen semanal</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div>Gym: {weekStats.gym}/7</div>
              <div>Dieta: {weekStats.diet}/7</div>
              <div>Agua OK: {weekStats.water}/7</div>
              <div>Pasos OK: {weekStats.steps}/7</div>
              <div>Sueño OK: {weekStats.sleep}/7</div>
            </div>
          </div>
        </>
      ) : null}

      {!loading && tab === "month" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              marginTop: 14,
              textAlign: "center",
              fontSize: 12,
              color: "var(--muted)",
              fontWeight: 800,
            }}
          >
            {DOW_ES.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              marginTop: 8,
            }}
          >
            {monthGrid.days.map((d) => {
              const key = ymd(d);
              const log = logMap.get(key);
              const plan = planMap.get(key);
              const sc = score(log, settings);
              const inMonth = d.getMonth() === monthGrid.month;
              const today = key === ymd(new Date());

              const bg =
                sc >= 4 ? "rgba(34,197,94,.18)" : sc >= 2 ? "rgba(245,158,11,.14)" : "rgba(239,68,68,.12)";

              const titleParts: string[] = [`${key} · ${sc}/5`];
              if (plan?.desayuno_plato) titleParts.push(`Desayuno: ${plan.desayuno_plato}`);
              if (plan?.comida_plato) titleParts.push(`Comida: ${plan.comida_plato}`);
              if (plan?.merienda_plato) titleParts.push(`Merienda: ${plan.merienda_plato}`);
              if (plan?.cena_plato) titleParts.push(`Cena: ${plan.cena_plato}`);

              return (
                <div
                  key={key}
                  className="card"
                  style={{
                    padding: 8,
                    background: bg,
                    opacity: inMonth ? 1 : 0.35,
                    borderColor: today ? "rgba(255,255,255,.55)" : "var(--border)",
                  }}
                  title={titleParts.join("\n")}
                >
                  <div style={{ fontWeight: 900, fontSize: 12 }}>{d.getDate()}</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    <Dot ok={okGym(log)} />
                    <Dot ok={okDiet(log)} />
                    <Dot ok={okWater(log, settings)} />
                    <Dot ok={okSteps(log, settings)} />
                    <Dot ok={okSleep(log, settings)} />
                  </div>
                  {/* indicador pequeño si hay plan */}
                  {plan ? (
                    <div className="small" style={{ marginTop: 6, textAlign: "center", opacity: 0.8 }}>
                      🍽️
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        display: "inline-block",
        background: ok ? "rgba(232,239,255,.95)" : "rgba(232,239,255,.20)",
      }}
    />
  );
}
