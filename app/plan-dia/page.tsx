"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type DayType = "train" | "rest";

type Settings = {
  // Nuevos nombres (recomendados)
  kcal_train?: number | null;
  kcal_rest?: number | null;

  // Compatibilidad por si tu tabla antigua aún usa estos nombres
  kcal_entreno?: number | null;
  kcal_descanso?: number | null;

  prot_g?: number | null;
  carb_g?: number | null;
  fat_g?: number | null;
};

type DayTotalsRow = {
  user_id: string;
  day: string; // YYYY-MM-DD
  day_type: DayType;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"];

function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes=0 ... domingo=6
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DEFAULT_MEALS = [
  { meal_type: "breakfast", title: "Desayuno", order_idx: 1 },
  { meal_type: "lunch", title: "Comida", order_idx: 2 },
  { meal_type: "snack", title: "Merienda", order_idx: 3 },
  { meal_type: "dinner", title: "Cena", order_idx: 4 },
] as const;

async function ensurePlanDay(dayISO: string, defaultType: DayType) {
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user) throw new Error("No auth");

  // 1) plan_day
  const { data: existing, error: e1 } = await supabase
    .from("plan_days")
    .select("*")
    .eq("user_id", user.id)
    .eq("day", dayISO)
    .maybeSingle();

  if (e1) throw e1;

  let planDay = existing as any;

  if (!planDay) {
    const { data: inserted, error: e2 } = await supabase
      .from("plan_days")
      .insert({ user_id: user.id, day: dayISO, day_type: defaultType })
      .select("*")
      .single();
    if (e2) throw e2;
    planDay = inserted;
  }

  // 2) comidas si faltan
  const { data: meals, error: e3 } = await supabase
    .from("plan_meals")
    .select("*")
    .eq("plan_day_id", planDay.id)
    .order("order_idx", { ascending: true });

  if (e3) throw e3;

  if (!meals || meals.length === 0) {
    const payload = DEFAULT_MEALS.map((m) => ({
      plan_day_id: planDay.id,
      meal_type: m.meal_type,
      title: m.title,
      order_idx: m.order_idx,
    }));
    const { error: e4 } = await supabase.from("plan_meals").insert(payload);
    if (e4) throw e4;
  }

  return planDay as { id: string; day_type: DayType; day: string };
}

export default function PlanDiaWeekPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const weekStart = useMemo(() => startOfWeekMonday(anchor), [anchor]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekStartISO = useMemo(() => ymd(weekStart), [weekStart]);
  const weekEndISO = useMemo(() => ymd(addDays(weekStart, 6)), [weekStart]);

  const title = useMemo(() => {
    const s = weekStart;
    const e = addDays(weekStart, 6);
    return `${s.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — ${e.toLocaleDateString(
      "es-ES",
      { day: "2-digit", month: "short" }
    )}`;
  }, [weekStart]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [totals, setTotals] = useState<DayTotalsRow[]>([]);

  function shiftWeek(delta: number) {
    setAnchor((prev) => addDays(prev, delta * 7));
  }

  function kcalTargetFor(dayType: DayType) {
    if (!settings) return 0;
    // preferir nuevos nombres, fallback antiguos
    const train = settings.kcal_train ?? settings.kcal_entreno ?? 0;
    const rest = settings.kcal_rest ?? settings.kcal_descanso ?? 0;
    return dayType === "train" ? train : rest;
  }

  async function loadWeek() {
    setLoading(true);
    setStatus("");

    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    // 1) settings (compatibles con nombres viejos y nuevos)
    const { data: s, error: es } = await supabase
      .from("user_settings")
      .select("kcal_train,kcal_rest,kcal_entreno,kcal_descanso,prot_g,carb_g,fat_g")
      .eq("user_id", user.id)
      .maybeSingle();

    if (es) {
      setStatus("Error settings: " + es.message);
    } else {
      setSettings((s as any) ?? null);
    }

    // 2) asegurar estructura de 7 días (sin duplicar)
    try {
      for (const d of weekDays) {
        const iso = ymd(d);
        await ensurePlanDay(iso, "train");
      }
    } catch (e: any) {
      setStatus("Error asegurando días: " + (e?.message ?? "unknown"));
      setLoading(false);
      return;
    }

    // 3) cargar totales desde la vista v_day_totals
    const { data: rows, error: et } = await supabase
      .from("v_day_totals")
      .select("user_id,day,day_type,kcal,prot,carb,fat")
      .eq("user_id", user.id)
      .gte("day", weekStartISO)
      .lte("day", weekEndISO)
      .order("day", { ascending: true });

    if (et) {
      setStatus("Error totales: " + et.message);
      setTotals([]);
    } else {
      setTotals(((rows as any) ?? []) as DayTotalsRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  async function setDayType(dayISO: string, newType: DayType) {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return;

    // Actualizamos el day_type del plan_day correspondiente
    const { data: pd, error: e1 } = await supabase
      .from("plan_days")
      .select("id")
      .eq("user_id", user.id)
      .eq("day", dayISO)
      .maybeSingle();

    if (e1 || !pd?.id) {
      setStatus("No encuentro plan_day para " + dayISO);
      return;
    }

    const { error: e2 } = await supabase.from("plan_days").update({ day_type: newType }).eq("id", pd.id);
    if (e2) {
      setStatus("Error cambiando tipo: " + e2.message);
      return;
    }

    // Refrescamos totales/estado
    setTotals((prev) =>
      prev.map((r) => (r.day === dayISO ? { ...r, day_type: newType } : r))
    );
  }

  const weekTotals = useMemo(() => {
    return totals.reduce(
      (acc, r) => ({
        kcal: acc.kcal + (r.kcal ?? 0),
        prot: acc.prot + (r.prot ?? 0),
        carb: acc.carb + (r.carb ?? 0),
        fat: acc.fat + (r.fat ?? 0),
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [totals]);

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan semanal</h1>

        <div className="row" style={{ justifyContent: "space-between", margin: "15px 0" }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>←</button>
          <span className="badge"><b>{title}</b></span>
          <button className="btn" onClick={() => shiftWeek(1)}>→</button>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setAnchor(new Date())}>Hoy</button>
          <button className="btn" onClick={loadWeek} disabled={loading}>
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <span className="badge">Semana: {weekTotals.kcal.toFixed(0)} kcal</span>
          <span className="badge">P: {weekTotals.prot.toFixed(0)}</span>
          <span className="badge">C: {weekTotals.carb.toFixed(0)}</span>
          <span className="badge">G: {weekTotals.fat.toFixed(0)}</span>
        </div>

        {status && <div className="small" style={{ marginTop: 10 }}>{status}</div>}
      </div>

      <div style={{ display: "grid", gap: 15, marginTop: 15 }}>
        {weekDays.map((d, idx) => {
          const iso = ymd(d);

          const row =
            totals.find((x) => x.day === iso) ??
            ({
              user_id: "",
              day: iso,
              day_type: "train",
              kcal: 0,
              prot: 0,
              carb: 0,
              fat: 0,
            } as DayTotalsRow);

          const target = kcalTargetFor(row.day_type);
          const diff = row.kcal - target;

          return (
            <div key={iso} className="card">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {DOW_ES[idx]} {d.getDate()}
                  <div className="small muted">{iso}</div>
                </div>

                <div className="row" style={{ gap: 5 }}>
                  <button
                    className={`btn small ${row.day_type === "train" ? "primary" : ""}`}
                    onClick={() => setDayType(iso, "train")}
                  >
                    E
                  </button>
                  <button
                    className={`btn small ${row.day_type === "rest" ? "primary" : ""}`}
                    onClick={() => setDayType(iso, "rest")}
                  >
                    D
                  </button>
                </div>
              </div>

              <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div>
                    <b>{row.kcal.toFixed(0)}</b> kcal{" "}
                    <span className="muted">
                      · P {row.prot.toFixed(0)} · C {row.carb.toFixed(0)} · G {row.fat.toFixed(0)}
                    </span>
                  </div>
                  <div className="small muted">
                    Obj: {target} kcal · {diff >= 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0)} kcal
                  </div>
                </div>

                <Link className="btn primary" href={`/plan-dia/${iso}`}>
                  Ver día →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
