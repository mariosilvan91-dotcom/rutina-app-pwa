"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type StgPlatoListRow = { id: string; plato: string };

type StgPlatoDetailRow = {
  id: string;
  plato: string;
  ingredientes_1: string | null;
  ingredientes_2: string | null;
  ingredientes_3: string | null;
  ingredientes_4: string | null;
  ingredientes_5: string | null;
};

type FoodBase = {
  id: string;
  name: string;
  kcal_100: number;
  prot_100: number;
  carb_100: number;
  fat_100: number;
  default_portion_g: number | null;
};

type IngredientSlotKey =
  | "ingredientes_1"
  | "ingredientes_2"
  | "ingredientes_3"
  | "ingredientes_4"
  | "ingredientes_5";

type IngredientRow = {
  slot: IngredientSlotKey;
  label: string;
  foodName: string;
  grams: number;
  food?: FoodBase | null;
};

function n(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function r1(x: number) {
  return Math.round(x * 10) / 10;
}
function cleanName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

const SLOTS: { key: IngredientSlotKey; label: string }[] = [
  { key: "ingredientes_1", label: "Ingrediente 1" },
  { key: "ingredientes_2", label: "Ingrediente 2" },
  { key: "ingredientes_3", label: "Ingrediente 3" },
  { key: "ingredientes_4", label: "Ingrediente 4" },
  { key: "ingredientes_5", label: "Ingrediente 5" },
];

export default function RecetasPage() {
  return (
    <AuthGate>
      <RecetasInner />
    </AuthGate>
  );
}

function RecetasInner() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [platos, setPlatos] = useState<StgPlatoListRow[]>([]);
  const [selectedPlatoId, setSelectedPlatoId] = useState("");

  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);

  // 🔹 Cargar lista de recetas
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("stg_platos")
        .select("id, plato")
        .order("plato");

      if (error) {
        setMsg(error.message);
        setPlatos([]);
      } else {
        const seen = new Set<string>();
        const clean = (data ?? []).filter(
          (x) => x.id && !seen.has(x.id) && seen.add(x.id)
        );
        setPlatos(clean as StgPlatoListRow[]);
      }
    })();
  }, []);

  // 🔹 Al seleccionar receta
  useEffect(() => {
    if (!selectedPlatoId) {
      setRows([]);
      setNotFound([]);
      return;
    }

    (async () => {
      setLoading(true);
      setMsg("");
      setNotFound([]);

      const { data: p, error } = await supabase
        .from("stg_platos")
        .select(
          "id, plato, ingredientes_1, ingredientes_2, ingredientes_3, ingredientes_4, ingredientes_5"
        )
        .eq("id", selectedPlatoId)
        .maybeSingle();

      if (error || !p) {
        setMsg("Error cargando receta");
        setRows([]);
        setLoading(false);
        return;
      }

      const plato = p as StgPlatoDetailRow;

      const candidates: { slot: IngredientSlotKey; label: string; foodName: string }[] = [];
      for (const s of SLOTS) {
        const val = (plato as any)[s.key];
        if (val && cleanName(val)) {
          candidates.push({
            slot: s.key,
            label: s.label,
            foodName: cleanName(val),
          });
        }
      }

      if (!candidates.length) {
        setMsg("La receta no tiene ingredientes.");
        setRows([]);
        setLoading(false);
        return;
      }

      const names = [...new Set(candidates.map((c) => c.foodName))];

      const { data: foods } = await supabase
        .from("foods_base")
        .select(
          "id, name, kcal_100, prot_100, carb_100, fat_100, default_portion_g"
        )
        .in("name", names);

      const foodMap: Record<string, FoodBase> = {};
      (foods ?? []).forEach((f) => (foodMap[f.name] = f as FoodBase));

      const initialRows: IngredientRow[] = candidates.map((c) => {
        const food = foodMap[c.foodName] ?? null;
        return {
          slot: c.slot,
          label: c.label,
          foodName: c.foodName,
          grams: n(food?.default_portion_g ?? 100),
          food,
        };
      });

      setNotFound(
        initialRows.filter((r) => !r.food).map((r) => r.foodName)
      );

      setRows(initialRows);
      setLoading(false);
    })();
  }, [selectedPlatoId]);

  // 🔹 Cálculo de macros
  const calc = useMemo(() => {
    const line = rows.map((r) => {
      const g = n(r.grams);
      const f = r.food;
      return {
        ...r,
        kcal: f ? (g * f.kcal_100) / 100 : 0,
        prot: f ? (g * f.prot_100) / 100 : 0,
        carb: f ? (g * f.carb_100) / 100 : 0,
        fat: f ? (g * f.fat_100) / 100 : 0,
      };
    });

    const total = line.reduce(
      (a, x) => ({
        kcal: a.kcal + x.kcal,
        prot: a.prot + x.prot,
        carb: a.carb + x.carb,
        fat: a.fat + x.fat,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );

    return { line, total };
  }, [rows]);

  return (
    <div className="stack">
      <div className="card">
        <h1 className="h1">Recetas · Calculadora de macros</h1>

        <select
          className="input"
          value={selectedPlatoId}
          onChange={(e) => setSelectedPlatoId(e.target.value)}
        >
          <option value="">— Seleccionar receta —</option>
          {platos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.plato}
            </option>
          ))}
        </select>

        {msg && <div className="small">{msg}</div>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="badge">Kcal {r1(calc.total.kcal)}</span>
            <span className="badge">P {r1(calc.total.prot)} g</span>
            <span className="badge">C {r1(calc.total.carb)} g</span>
            <span className="badge">G {r1(calc.total.fat)} g</span>
          </div>

          {calc.line.map((r) => (
            <div key={r.slot} className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 140 }}>{r.label}</div>
              <div style={{ flex: 1 }}>{r.foodName}</div>
              <input
                className="input"
                type="number"
                value={r.grams}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((x) =>
                      x.slot === r.slot ? { ...x, grams: n(e.target.value) } : x
                    )
                  )
                }
              />
              <div className="small muted">
                {r1(r.kcal)} kcal
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
