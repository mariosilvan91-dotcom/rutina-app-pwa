"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type StgPlato = {
  id: string;
  plato: string;
};

type PlatoItemMacro = {
  plato_item_id: string;
  plato_id: string;
  order_idx: number;
  grams: number;
  notes: string | null;
  alimento_id: string;
  alimento: string;
  tipo: string | null;
  // estos campos son los macros calculados con los gramos "base" de la receta
  kcal: number;
  prot_g: number;
  carbs_g: number;
  grasas_g: number;
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

function n(x: any) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function r1(x: number) {
  return Math.round(x * 10) / 10;
}

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

  const [platos, setPlatos] = useState<StgPlato[]>([]);
  const [selectedPlatoId, setSelectedPlatoId] = useState<string>("");

  const [items, setItems] = useState<PlatoItemMacro[]>([]);
  const [foodsMap, setFoodsMap] = useState<Record<string, FoodBase>>({});
  const [gramsByItem, setGramsByItem] = useState<Record<string, number>>({});

  // 1) Cargar lista de platos desde stg_platos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      // OJO: stg_platos puede tener duplicados por tipo_dia/comida.
      // Si "plato" es único, esto vale. Si no, usamos distinct por plato.
      const { data, error } = await supabase
        .from("stg_platos")
        .select("id, plato")
        .order("plato", { ascending: true });

      if (error) {
        setMsg("Error cargando platos: " + error.message);
        setPlatos([]);
      } else {
        // dedupe por id (por si acaso)
        const seen = new Set<string>();
        const clean = ((data as any[]) ?? [])
          .filter((x) => x?.id && x?.plato)
          .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
        setPlatos(clean as StgPlato[]);
      }

      setLoading(false);
    })();
  }, []);

  const selectedPlatoName = useMemo(() => {
    return platos.find((p) => p.id === selectedPlatoId)?.plato ?? "";
  }, [platos, selectedPlatoId]);

  // 2) Al elegir un plato: cargar ingredientes + foods_base de esos ingredientes
  useEffect(() => {
    if (!selectedPlatoId) {
      setItems([]);
      setFoodsMap({});
      setGramsByItem({});
      return;
    }

    (async () => {
      setLoading(true);
      setMsg("");

      const { data: its, error: e1 } = await supabase
        .from("v_plato_items_macros")
        .select("*")
        .eq("plato_id", selectedPlatoId)
        .order("order_idx", { ascending: true });

      if (e1) {
        setMsg("Error cargando ingredientes: " + e1.message);
        setItems([]);
        setFoodsMap({});
        setGramsByItem({});
        setLoading(false);
        return;
      }

      const list = ((its as PlatoItemMacro[]) ?? []).map((x: any) => ({
        ...x,
        grams: n(x.grams),
        kcal: n(x.kcal),
        prot_g: n(x.prot_g),
        carbs_g: n(x.carbs_g),
        grasas_g: n(x.grasas_g),
      }));

      setItems(list);

      // init gramos editables
      const gb: Record<string, number> = {};
      list.forEach((x) => (gb[x.plato_item_id] = n(x.grams)));
      setGramsByItem(gb);

      // foods_base para recalcular (por alimento_id)
      const foodIds = Array.from(new Set(list.map((x) => x.alimento_id))).filter(Boolean);
      if (foodIds.length === 0) {
        setFoodsMap({});
        setLoading(false);
        return;
      }

      const { data: foods, error: e2 } = await supabase
        .from("foods_base")
        .select("id,name,kcal_100,prot_100,carb_100,fat_100,default_portion_g")
        .in("id", foodIds);

      if (e2) {
        setMsg("Error cargando foods_base: " + e2.message);
        setFoodsMap({});
        setLoading(false);
        return;
      }

      const map: Record<string, FoodBase> = {};
      (foods as any[]).forEach((f) => (map[f.id] = f as FoodBase));
      setFoodsMap(map);

      setLoading(false);
    })();
  }, [selectedPlatoId]);

  // 3) Filas calculadas con gramos editables
  const rows = useMemo(() => {
    return items.map((it) => {
      const grams = n(gramsByItem[it.plato_item_id] ?? it.grams);
      const fb = foodsMap[it.alimento_id];

      const kcal = fb ? (grams * n(fb.kcal_100)) / 100 : 0;
      const prot = fb ? (grams * n(fb.prot_100)) / 100 : 0;
      const carb = fb ? (grams * n(fb.carb_100)) / 100 : 0;
      const fat = fb ? (grams * n(fb.fat_100)) / 100 : 0;

      return {
        ...it,
        grams_calc: grams,
        kcal_calc: kcal,
        prot_calc: prot,
        carb_calc: carb,
        fat_calc: fat,
        food_found: !!fb,
      };
    });
  }, [items, gramsByItem, foodsMap]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal_calc,
        prot: acc.prot + r.prot_calc,
        carb: acc.carb + r.carb_calc,
        fat: acc.fat + r.fat_calc,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [rows]);

  return (
    <div className="stack">
      <div className="card">
        <h1 className="h1">Recetas · Calculadora de macros</h1>
        <div className="small muted">
          Platos desde <b>stg_platos</b>. Ingredientes desde <b>v_plato_items_macros</b>. Recalcula con <b>foods_base</b>.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label className="small">Plato</label>
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

      {selectedPlatoId && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="h2">{selectedPlatoName || "Plato"}</div>
              <div className="muted small">Ajusta gramos por ingrediente para recalcular macros.</div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge">Kcal: {r1(totals.kcal)}</span>
              <span className="badge">P: {r1(totals.prot)} g</span>
              <span className="badge">C: {r1(totals.carb)} g</span>
              <span className="badge">G: {r1(totals.fat)} g</span>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div
              className="thead"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 90px 90px 90px 90px",
                gap: 10,
              }}
            >
              <div>Ingrediente</div>
              <div>Gramos</div>
              <div>Kcal</div>
              <div>P</div>
              <div>C</div>
              <div>G</div>
            </div>

            {rows.map((r) => (
              <div
                key={r.plato_item_id}
                className="trow"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 90px 90px 90px 90px",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div>
                  {r.alimento}
                  {!r.food_found && <div className="small color-danger">No encontrado en foods_base</div>}
                </div>

                <div>
                  <input
                    className="input"
                    type="number"
                    step="1"
                    value={Number.isFinite(r.grams_calc) ? r.grams_calc : 0}
                    onChange={(e) =>
                      setGramsByItem((prev) => ({
                        ...prev,
                        [r.plato_item_id]: n(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>{r1(r.kcal_calc)}</div>
                <div>{r1(r.prot_calc)}</div>
                <div>{r1(r.carb_calc)}</div>
                <div>{r1(r.fat_calc)}</div>
              </div>
            ))}

            {rows.length === 0 && (
              <div className="muted small" style={{ marginTop: 10 }}>
                Este plato no tiene ingredientes (o la vista no devuelve filas).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
