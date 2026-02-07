"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type StgPlatoListRow = { id: string; plato: string };

type StgPlatoDetailRow = {
  id: string;
  plato: string;
  ingrediente_1: string | null;
  ingrediente_2: string | null;
  ingrediente_3: string | null;
  ingrediente_4: string | null;
  ingrediente_5: string | null;
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
  | "ingrediente_1"
  | "ingrediente_2"
  | "ingrediente_3"
  | "ingrediente_4"
  | "ingrediente_5";

type IngredientRow = {
  slot: IngredientSlotKey;
  label: string;
  foodName: string; // texto que viene de stg_platos
  grams: number; // editable (por defecto default_portion_g)
  food?: FoodBase | null; // match en foods_base
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
  { key: "ingrediente_1", label: "Ingrediente 1" },
  { key: "ingrediente_2", label: "Ingrediente 2" },
  { key: "ingrediente_3", label: "Ingrediente 3" },
  { key: "ingrediente_4", label: "Ingrediente 4" },
  { key: "ingrediente_5", label: "Ingrediente 5" },
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

  // 1) lista de recetas desde stg_platos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data, error } = await supabase
        .from("stg_platos")
        .select("id, plato")
        .order("plato", { ascending: true });

      if (error) {
        setMsg("Error cargando recetas: " + error.message);
        setPlatos([]);
      } else {
        const seen = new Set<string>();
        const clean = ((data as any[]) ?? [])
          .filter((x) => x?.id && x?.plato)
          .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
        setPlatos(clean as StgPlatoListRow[]);
      }

      setLoading(false);
    })();
  }, []);

  // 2) al seleccionar receta: leer ingrediente_1..5 y buscar en foods_base
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

      const { data: p, error: e1 } = await supabase
        .from("stg_platos")
        .select("id, plato, ingrediente_1, ingrediente_2, ingrediente_3, ingrediente_4, ingrediente_5")
        .eq("id", selectedPlatoId)
        .maybeSingle();

      if (e1 || !p) {
        setMsg("Error cargando receta: " + (e1?.message ?? "no encontrada"));
        setRows([]);
        setLoading(false);
        return;
      }

      const plato = p as StgPlatoDetailRow;

      // Construir lista de ingredientes desde columnas ingrediente_1..5
      const candidates: { slot: IngredientSlotKey; label: string; foodName: string }[] = [];
      for (const s of SLOTS) {
        const val = (plato as any)[s.key] as string | null;
        if (val && cleanName(val)) {
          candidates.push({ slot: s.key, label: s.label, foodName: cleanName(val) });
        }
      }

      if (candidates.length === 0) {
        setMsg("Esta receta no tiene ingredientes en ingrediente_1..ingrediente_5.");
        setRows([]);
        setLoading(false);
        return;
      }

      // Buscar foods_base por nombre EXACTO + traer default_portion_g
      const names = Array.from(new Set(candidates.map((c) => c.foodName)));
      const { data: foods, error: e2 } = await supabase
        .from("foods_base")
        .select("id, name, kcal_100, prot_100, carb_100, fat_100, default_portion_g")
        .in("name", names);

      if (e2) {
        setMsg("Error cargando foods_base: " + e2.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const mapByName: Record<string, FoodBase> = {};
      (foods as any[]).forEach((f) => (mapByName[f.name] = f as FoodBase));

      // Crear filas editables usando default_portion_g como gramos iniciales (fallback 100)
      const initialRows: IngredientRow[] = candidates.map((c) => {
        const food = mapByName[c.foodName] ?? null;
        const g0 = food?.default_portion_g ?? 100;
        return {
          slot: c.slot,
          label: c.label,
          foodName: c.foodName,
          grams: n(g0),
          food,
        };
      });

      const nf = initialRows.filter((r) => !r.food).map((r) => r.foodName);
      setNotFound(Array.from(new Set(nf)));

      setRows(initialRows);
      setLoading(false);
    })();
  }, [selectedPlatoId]);

  // 3) cálculo
  const calc = useMemo(() => {
    const line = rows.map((r) => {
      const fb = r.food;
      const g = n(r.grams);

      const kcal = fb ? (g * n(fb.kcal_100)) / 100 : 0;
      const prot = fb ? (g * n(fb.prot_100)) / 100 : 0;
      const carb = fb ? (g * n(fb.carb_100)) / 100 : 0;
      const fat = fb ? (g * n(fb.fat_100)) / 100 : 0;

      return { ...r, kcal, prot, carb, fat };
    });

    const total = line.reduce(
      (acc, x) => ({
        kcal: acc.kcal + x.kcal,
        prot: acc.prot + x.prot,
        carb: acc.carb + x.carb,
        fat: acc.fat + x.fat,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );

    return { line, total };
  }, [rows]);

  return (
    <div className="stack">
      <div className="card">
        <h1 className="h1">Recetas · Calculadora de macros</h1>
        <div className="small muted">
          Lee ingredientes desde <b>stg_platos</b> (ingrediente_1..ingrediente_5) y usa <b>foods_base</b> (incluye default_portion_g).
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label className="small">Receta</label>
          <select className="input" value={selectedPlatoId} onChange={(e) => setSelectedPlatoId(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {platos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.plato}
              </option>
            ))}
          </select>

          {loading && <div className="small">Cargando…</div>}
          {msg && <div className="small">{msg}</div>}
        </div>
      </div>

      {selectedPlatoId && rows.length > 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge">Kcal: {r1(calc.total.kcal)}</span>
              <span className="badge">P: {r1(calc.total.prot)} g</span>
              <span className="badge">C: {r1(calc.total.carb)} g</span>
              <span className="badge">G: {r1(calc.total.fat)} g</span>
            </div>

            {notFound.length > 0 && (
              <div className="small color-danger">
                No encontrados en foods_base (el nombre debe coincidir EXACTO): {notFound.join(", ")}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div
              className="thead"
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 120px 90px 90px 90px 90px",
                gap: 10,
              }}
            >
              <div>Slot</div>
              <div>Ingrediente</div>
              <div>Gramos</div>
              <div>Kcal</div>
              <div>P</div>
              <div>C</div>
              <div>G</div>
            </div>

            {calc.line.map((r) => (
              <div
                key={r.slot}
                className="trow"
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr 120px 90px 90px 90px 90px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="muted">{r.label}</div>

                <div>
                  <div>{r.foodName}</div>
                  {!r.food && <div className="small color-danger">No coincide con foods_base.name</div>}
                  {r.food?.default_portion_g != null && (
                    <div className="small muted">Ración normal: {r.food.default_portion_g} g</div>
                  )}
                </div>

                <div>
                  <input
                    className="input"
                    type="number"
                    step="1"
                    value={r.grams}
                    onChange={(e) => {
                      const v = n(e.target.value);
                      setRows((prev) => prev.map((x) => (x.slot === r.slot ? { ...x, grams: v } : x)));
                    }}
                  />
                </div>

                <div>{r1(r.kcal)}</div>
                <div>{r1(r.prot)}</div>
                <div>{r1(r.carb)}</div>
                <div>{r1(r.fat)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

