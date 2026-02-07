"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { ensurePlanDay } from "@/lib/plan";

type Settings = {
  kcal_train: number;
  kcal_rest: number;
  prot_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
};

type DayRow = {
  day: string; // YYYY-MM-DD
  day_type: "train" | "rest";
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Lunes como inicio de semana
function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 domingo, 1 lunes...
  const diff = day === 0 ? -6 : 1 - day; // si domingo => retrocede 6
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const WEEKDAY_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function PlanDiaWeekPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState<Date>(() => new Date()); // fecha “actual” para esa semana

  const week = useMemo(() => {
    const start = startOfWeekMonday(anchor);
    const arr = Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      return { date: d, iso: toISODate(d), label: WEEKDAY_ES[i] };
    });
    return { start, arr };
  }, [anchor]);

  async function load() {
    setLoading(true);

    const { data: userWrap } = await supabase.auth.getUser();
    const user = userWrap?.user;
    if (!user) return;

    // 1) Settings
    const { data: s } = await supabase
      .from("user_settings")
      .select("kcal_train,kcal_rest,prot_g,carb_g,fat_g")
      .eq("user_id", user.id)
      .maybeSingle();
    setSettings((s as any) ?? null);

    // 2) Asegurar que existan los 7 plan_days (y comidas) sin romper nada
    // (por defecto los ponemos "train" si no existen; luego podrás cambiar day_type desde UI)
    for (const x of week.arr) {
      await ensurePlanDay(x.iso, "train");
    }

    // 3) Leer totales de la semana desde la vista
    const from = week.arr[0].iso;
    const to = week.arr[6].iso;

    const { data: rows, error } = await supabase
      .from("v_day_totals")
      .select("day, day_type, kcal, prot, carb, fat")
      .eq("user_id", user.id)
      .gte("day", from)
      .lte("day", to)
      .order("day", { ascending: true });

    if (error) {
      console.error(error);
      setDays([]);
    } else {
      setDays((rows as any) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  function kcalTargetFor(dayType: "train" | "rest") {
    if (!settings) return 0;
    return dayType === "train" ? settings.kcal_train : settings.kcal_rest;
  }

  const weekTotals = useMemo(() => {
    return days.reduce(
      (acc, d) => ({
        kcal: acc.kcal + (d.kcal ?? 0),
        prot: acc.prot + (d.prot ?? 0),
        carb: acc.carb + (d.carb ?? 0),
        fat: acc.fat + (d.fat ?? 0),
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [days]);

  if (loading) return <div className="card">Cargando semana…</div>;

  return (
    <div className="stack">
      <div className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="h2">Plan semanal</div>
          <div className="muted">
            {week.arr[0].iso} → {week.arr[6].iso}
          </div>
        </div>

        <div className="row gap">
          <button className="btn" onClick={() => setAnchor(addDays(anchor, -7))}>← Semana</button>
          <button className="btn" onClick={() => setAnchor(new Date())}>Hoy</button>
          <button className="btn" onClick={() => setAnchor(addDays(anchor, 7))}>Semana →</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="h3">Totales semana</div>
          <div className="muted">
            {weekTotals.kcal.toFixed(0)} kcal · P {weekTotals.prot.toFixed(0)} · C {weekTotals.carb.toFixed(0)} · G {weekTotals.fat.toFixed(0)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="thead" style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px 120px", gap: 10 }}>
          <div>Día</div>
          <div>Resumen</div>
          <div>Objetivo</div>
          <div></div>
        </div>

        {week.arr.map((w) => {
          const row = days.find((d) => d.day === w.iso) ?? {
            day: w.iso,
            day_type: "train" as const,
            kcal: 0,
            prot: 0,
            carb: 0,
            fat: 0,
          };

          const target = kcalTargetFor(row.day_type);
          const diff = row.kcal - target;

          return (
            <div
              key={w.iso}
              className="trow"
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr 120px 120px",
                gap: 10,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{w.label}</div>
                <div className="muted">{w.iso}</div>
              </div>

              <div>
                <div>
                  <b>{row.kcal.toFixed(0)}</b> kcal{" "}
                  <span className="muted">
                    · P {row.prot.toFixed(0)} · C {row.carb.toFixed(0)} · G {row.fat.toFixed(0)}
                  </span>
                </div>
                <div className="muted">
                  Tipo: {row.day_type === "train" ? "Entreno" : "Descanso"} ·{" "}
                  {diff >= 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0)} kcal
                </div>
              </div>

              <div>
                <div><b>{target}</b> kcal</div>
                <div className="muted">obj. día</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <Link className="btn" href={`/plan-dia/${w.iso}`}>
                  Ver día →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card muted">
        Esta vista es el control semanal. La edición detallada (alimentos, gramos, recetas) se hace dentro de cada día.
      </div>
    </div>
  );
}
