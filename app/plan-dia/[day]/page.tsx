"use client";

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

type PlanMeal = { id: string; meal_type: string; title: string; order_idx: number };
type Entry = {
  entry_id: string;
  plan_meal_id: string;
  entry_type: "food" | "dish";
  item_name: string;
  grams: number | null;
  servings: number | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  order_idx: number;
};

export default function PlanDiaDayPage({ params }: { params: { day: string } }) {
  return (
    <AuthGate>
      <Inner day={params.day} />
    </AuthGate>
  );
}

function Inner({ day }: { day: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [planDayType, setPlanDayType] = useState<"train" | "rest">("train");
  const [meals, setMeals] = useState<PlanMeal[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    // Asegura estructura del día (y comidas)
    const pd = await ensurePlanDay(day, "train");
    setPlanDayType(pd.day_type);

    // Settings
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: s } = await supabase
      .from("user_settings")
      .select("kcal_train,kcal_rest,prot_g,carb_g,fat_g")
      .eq("user_id", user.id)
      .maybeSingle();
    setSettings((s as any) ?? null);

    // Meals
    const { data: m } = await supabase
      .from("plan_meals")
      .select("*")
      .eq("plan_day_id", pd.id)
      .order("order_idx", { ascending: true });
    setMeals((m as any) ?? []);

    // Entries with macros (view)
    const mealIds = (m ?? []).map((x: any) => x.id);
    if (mealIds.length) {
      const { data: e } = await supabase
        .from("v_meal_entries_nutrition")
        .select("*")
        .in("plan_meal_id", mealIds)
        .order("order_idx", { ascending: true });
      setEntries((e as any) ?? []);
    } else {
      setEntries([]);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [day]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, x) => ({
        kcal: acc.kcal + (x.kcal ?? 0),
        prot: acc.prot + (x.prot ?? 0),
        carb: acc.carb + (x.carb ?? 0),
        fat: acc.fat + (x.fat ?? 0),
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [entries]);

  const targets = useMemo(() => {
    const kcal = settings
      ? (planDayType === "train" ? settings.kcal_train : settings.kcal_rest)
      : 0;
    return {
      kcal,
      prot: settings?.prot_g ?? null,
      carb: settings?.carb_g ?? null,
      fat: settings?.fat_g ?? null,
    };
  }, [settings, planDayType]);

  if (loading) return <div className="card">Cargando…</div>;

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <div>
            <div className="h2">{day}</div>
            <div className="muted">Tipo: {planDayType === "train" ? "Entreno" : "Descanso"}</div>
          </div>
          <div className="right">
            <div><b>{totals.kcal.toFixed(0)}</b> / {targets.kcal} kcal</div>
            <div className="muted">
              P {totals.prot.toFixed(0)}{targets.prot ? `/${targets.prot}` : ""} ·
              C {totals.carb.toFixed(0)}{targets.carb ? `/${targets.carb}` : ""} ·
              G {totals.fat.toFixed(0)}{targets.fat ? `/${targets.fat}` : ""}
            </div>
          </div>
        </div>
      </div>

      {meals.map((meal) => {
        const mealEntries = entries.filter(e => e.plan_meal_id === meal.id);
        const mealTotals = mealEntries.reduce(
          (acc, x) => ({
            kcal: acc.kcal + (x.kcal ?? 0),
            prot: acc.prot + (x.prot ?? 0),
            carb: acc.carb + (x.carb ?? 0),
            fat: acc.fat + (x.fat ?? 0),
          }),
          { kcal: 0, prot: 0, carb: 0, fat: 0 }
        );

        return (
          <div key={meal.id} className="card">
            <div className="row">
              <div className="h3">{meal.title}</div>
              <div className="muted">
                {mealTotals.kcal.toFixed(0)} kcal · P {mealTotals.prot.toFixed(0)} · C {mealTotals.carb.toFixed(0)} · G {mealTotals.fat.toFixed(0)}
              </div>
            </div>

            <div className="table">
              <div className="thead">
                <div>Item</div><div>Qty</div><div>Kcal</div><div>P</div><div>C</div><div>G</div>
              </div>
              {mealEntries.map((e) => (
                <div key={e.entry_id} className="trow">
                  <div>{e.item_name}</div>
                  <div>{e.entry_type === "food" ? `${e.grams} g` : `${e.servings} r`}</div>
                  <div>{e.kcal.toFixed(0)}</div>
                  <div>{e.prot.toFixed(1)}</div>
                  <div>{e.carb.toFixed(1)}</div>
                  <div>{e.fat.toFixed(1)}</div>
                </div>
              ))}
              {mealEntries.length === 0 && <div className="muted">Sin entradas</div>}
            </div>

            <div className="row gap">
              <button className="btn" onClick={() => alert("Abrir modal añadir alimento")}>+ Alimento</button>
              <button className="btn" onClick={() => alert("Abrir modal añadir receta")}>+ Receta</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
