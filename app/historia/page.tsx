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

export default function HistoryPage() {
  const [tab, setTab] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [settings, setSettings] = useState<Settings>({
    agua_obj_l: 2.5,
    pasos_obj: 8000,
    sueno_obj_h: 7,
  });
  const [logs, setLogs] = useState<DayLog[]>([]);
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

  const map = useMemo(() => {
    const m = new Map<string, DayLog>();
    logs.forEach((l) => m.set(l.day, l));
    return m;
  }, [logs]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: userRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const userId = userRes.user?.id;
        if (!userId) throw new Error("No estás logueado.");

        const [settingsRes, logsRes] = await Promise.all([
          supabase
            .from("user_settings")
            .select("agua_obj_l,pasos_obj,sueno_obj_h")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("day_logs")
            .select("day,gym,diet_ok,water_l,steps,sleep_h,notes,updated_at")
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
    const days = weekDays;
    let gym = 0,
      diet = 0,
      water = 0,
      steps = 0,
      sleep = 0;
    for (const d of days) {
      const log = map.get(ymd(d));
      if (okGym(log)) gym++;
      if (okDiet(log)) diet++;
      if (okWater(log, settings)) water++;
      if (okSteps(log, settings)) steps++;
      if (okSleep(log, settings)) sleep++;
    }
    return { gym, diet, water, steps, sleep };
  }, [weekDays, map, settings]);

  const title = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions =
      tab === "week"
        ? { day: "2-digit", month: "short" }
        : { month: "long", year: "numeric" };
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
      <div className="min-h-screen">
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Histórico</h1>
        <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
          <button
            className={`px-3 py-1.5 text-sm rounded-lg ${
              tab === "week" ? "bg-white shadow" : ""
            }`}
            onClick={() => setTab("week")}
          >
            Semana
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-lg ${
              tab === "month" ? "bg-white shadow" : ""
            }`}
            onClick={() => setTab("month")}
          >
            Mes
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          className="rounded-xl border px-3 py-2"
          onClick={() => (tab === "week" ? shiftWeek(-1) : shiftMonth(-1))}
        >
          ←
        </button>

        <div className="text-sm font-semibold">{title}</div>

        <button
          className="rounded-xl border px-3 py-2"
          onClick={() => (tab === "week" ? shiftWeek(1) : shiftMonth(1))}
        >
          →
        </button>
      </div>

      <div className="mt-2">
        <button className="text-sm underline" onClick={() => setAnchor(new Date())}>
          Ir a hoy
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm opacity-70">Cargando…</div>
      ) : tab === "week" ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {weekDays.map((d, idx) => {
              const key = ymd(d);
              const log = map.get(key);
              const sc = score(log, settings);
              const today = key === ymd(new Date());

              const badge =
                sc >= 4 ? "bg-green-100" : sc >= 2 ? "bg-yellow-100" : "bg-red-100";

              return (
                <div key={key} className={`rounded-2xl border p-3 ${today ? "border-black" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {DOW_ES[idx]} {d.getDate()}
                    </div>
                    <div className={`rounded-full px-2 py-0.5 text-xs ${badge}`}>{sc}/5</div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <Pill label="Gym" ok={log?.gym === true} />
                    <Pill label="Dieta" ok={log?.diet_ok === true} />
                    <Pill
                      label={`Agua ${log?.water_l ?? 0}/${settings.agua_obj_l}L`}
                      ok={(log?.water_l ?? 0) >= settings.agua_obj_l}
                    />
                    <Pill
                      label={`Pasos ${log?.steps ?? 0}/${settings.pasos_obj}`}
                      ok={(log?.steps ?? 0) >= settings.pasos_obj}
                    />
                    <Pill
                      label={`Sueño ${log?.sleep_h ?? 0}/${settings.sueno_obj_h}h`}
                      ok={(log?.sleep_h ?? 0) >= settings.sueno_obj_h}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border p-4">
            <div className="text-sm font-semibold">Resumen semanal</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>Gym: {weekStats.gym}/7</div>
              <div>Dieta: {weekStats.diet}/7</div>
              <div>Agua OK: {weekStats.water}/7</div>
              <div>Pasos OK: {weekStats.steps}/7</div>
              <div>Sueño OK: {weekStats.sleep}/7</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold opacity-70">
            {DOW_ES.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthGrid.days.map((d) => {
              const key = ymd(d);
              const log = map.get(key);
              const sc = score(log, settings);
              const inMonth = d.getMonth() === monthGrid.month;
              const today = key === ymd(new Date());

              const color =
                sc >= 4 ? "bg-green-100" : sc >= 2 ? "bg-yellow-100" : "bg-red-100";

              return (
                <div
                  key={key}
                  className={`aspect-square rounded-xl border p-1 ${inMonth ? "" : "opacity-40"} ${
                    today ? "border-black" : ""
                  } ${color}`}
                  title={`${key} · ${sc}/5`}
                >
                  <div className="text-xs font-semibold">{d.getDate()}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Dot ok={log?.gym === true} />
                    <Dot ok={log?.diet_ok === true} />
                    <Dot ok={(log?.water_l ?? 0) >= settings.agua_obj_l} />
                    <Dot ok={(log?.steps ?? 0) >= settings.pasos_obj} />
                    <Dot ok={(log?.sleep_h ?? 0) >= settings.sueno_obj_h} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1 ${ok ? "bg-green-100" : "bg-gray-100"}`}>
      <span className="font-medium">{label}</span> {ok ? "✅" : "—"}
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-black" : "bg-black/20"}`} />;
}
