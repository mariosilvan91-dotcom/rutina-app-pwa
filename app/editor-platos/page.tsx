"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type StgPlatoListRow = { id: string; plato: string };

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

  // lista de recetas
  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("stg_platos")
        .select("id, plato")
        .order("plato", { ascending: true });

      if (error) {
        setMsg("Error cargando recetas: " + error.message);
        setPlatos([]);
        return;
      }

      // dedupe por id
      const seen = new Set<string>();
      const clean = ((data as any[]) ?? []).filter(
        (x) => x?.id && x?.plato && !seen.has(String(x.id)) && seen.add(String(x.id))
      );
      setPlatos(clean as StgPlatoListRow[]);
    })();
  }, []);

  // cargar receta + ingredientes (con fallback plural/singular)
  useEffect(() => {
    if (!selectedPlatoId) {
      setRows([]);
      setNotFound([]);
      setMsg("");
      return;
    }

    (async () => {
      setLoading(true);
      setMsg("");
      setRows([]);
      setNotFound([]);

      // Intento 1: plural ingredientes_1..5
      const selPlural =
        "id, plato, ingredientes_1, ingredientes_2, ingredientes_3, ingredientes_4, ingredientes_5";
      const { data: p1, error: e1 } = await supabase
        .from("stg_platos")
        .select(selPlural)
        .eq("id", selectedPlatoId)
        .maybeSingle();

      let platoRow: any = null;
      let mode: "plural" | "singular" = "plural";

      if (e1) {
        // Intento 2: singular ingrediente_1..5 (por si realmente se llamaban así)
        const selSingular =
          "id, plato, ingrediente_1, ingrediente_2, ingrediente_3, ingrediente_4, ingrediente_5";
        const { data: p2, error: e2 } = await supabase
          .from("stg_platos")
          .select(selSingular)
          .eq("id", selectedPlatoId)
          .maybeSingle();

        if (e2 || !p2) {
          setMsg("Error cargando receta: " + (e2?.message ?? e1.message));
          setLoading(false);
          return;
        }

        platoRow = p2;
        mode = "singular";
      } else {
        if (!p1) {
          setMsg("Receta no encontrada.");
          setLoading(false);
          return;
        }
        platoRow = p1;
      }

      // construir candidatos
      const candidates: { slot: IngredientSlotKey; label: string; foodName: string }[] = [];

      for (let i = 1; i <= 5; i++) {
        const label = `Ingrediente ${i}`;
        const slot = (`ingredientes_${i}` as IngredientSlotKey);

        const colName = mode === "plural" ? `ingredientes_${i}` : `ingrediente_${i}`;
        const val = cleanName(String(platoRow[colName] ?? "")) || "";

        if (val) candidates.push({ slot, label, foodName: val });
      }

      if (!candidates.length) {
        setMsg("La receta no tiene ingredientes.");
        setLoading(false);
        return;
      }

      // buscar foods_base por name exacto y traer default_portion_g
      const names = Array.from(new Set(candidates.map((c) => c.foodName)));
      const { data: foods, error: ef } = await supabase
        .from("foods_base")
        .select("id, name, kcal_100, prot_100, carb_100, fat_100, default_portion_g")
        .in("name", names);

      if (ef) {
        setMsg("Error foods_base: " + ef.message);
        setLoading(false);
        return;
      }

      const foodMap: Record<string, FoodBase> = {};
      (foods as any[] ?? []).forEach((f) => (foodMap[f.name] = f as FoodBase));

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

      setNotFound(initialRows.filter((r) => !r.food).map((r) => r.foodName));
      setRows(initialRows);
      setLoading(false);
    })();
  }, [selectedPlatoId]);

  const calc = useMemo(() => {
    const line = rows.map((r) => {
      const g = n(r.grams);
      const f = r.food;
      return {
        ...r,
        kcal: f ? (g * n(f.kcal_100)) / 100 : 0,
        prot: f ? (g * n(f.prot_100)) / 100 : 0,
        carb: f ? (g * n(f.carb_100)) / 100 : 0,
        fat: f ? (g * n(f.fat_100)) / 100 : 0,
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h1 className="h1" style={{ margin: 0 }}>Recetas · Calculadora de macros</h1>

          <Link className="btn primary" href="/recetas/nueva">
            + Nueva receta
          </Link>
        </div>

        <div style={{ marginTop: 12 }}>
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

          {loading && <div className="small" style={{ marginTop: 8 }}>Cargando…</div>}
          {msg && <div className="small" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="badge">Kcal {r1(calc.total.kcal)}</span>
            <span className="badge">P {r1(calc.total.prot)} g</span>
            <span className="badge">C {r1(calc.total.carb)} g</span>
            <span className="badge">G {r1(calc.total.fat)} g</span>
          </div>

          {notFound.length > 0 && (
            <div className="small color-danger" style={{ marginTop: 10 }}>
              No encontrados en foods_base (deben coincidir exacto): {notFound.join(", ")}
            </div>
          )}

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
              <div className="small muted">{r1(r.kcal)} kcal</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
