"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Dish = {
  id: string;
  name: string;
  servings: number;
};

type DishItem = {
  id: string;
  dish_id: string;
  food_id: string;
  grams_total: number;
  order_idx: number;
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

type Row = {
  item_id: string;
  food_id: string;
  food_name: string;
  grams: number;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
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

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>("");

  const [dishItems, setDishItems] = useState<DishItem[]>([]);
  const [foodsMap, setFoodsMap] = useState<Record<string, FoodBase>>({}); // food_id -> food
  const [gramsByItem, setGramsByItem] = useState<Record<string, number>>({}); // dish_item_id -> grams

  // 1) Cargar lista de recetas
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data, error } = await supabase
        .from("dishes")
        .select("id,name,servings")
        .order("name", { ascending: true });

      if (error) {
        setMsg("Error cargando recetas: " + error.message);
        setDishes([]);
      } else {
        setDishes((data as Dish[]) ?? []);
      }

      setLoading(false);
    })();
  }, []);

  // 2) Cuando elijo receta, cargar ingredientes + foods_base necesarios
  useEffect(() => {
    if (!selectedDishId) return;

    (async () => {
      setLoading(true);
      setMsg("");

      // dish_items
      const { data: items, error: e1 } = await supabase
        .from("dish_items")
        .select("id,dish_id,food_id,grams_total,order_idx")
        .eq("dish_id", selectedDishId)
        .order("order_idx", { ascending: true });

      if (e1) {
        setMsg("Error cargando ingredientes: " + e1.message);
        setDishItems([]);
        setFoodsMap({});
        setGramsByItem({});
        setLoading(false);
        return;
      }

      const di = (items as DishItem[]) ?? [];
      setDishItems(di);

      // Inicializar gramos editables (por defecto los gramos de receta)
      const initial: Record<string, number> = {};
      di.forEach((x) => (initial[x.id] = n(x.grams_total)));
      setGramsByItem(initial);

      // foods_base de esos ingredientes
      const foodIds = Array.from(new Set(di.map((x) => x.food_id))).filter(Boolean);
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
        setMsg("Error cargando alimentos: " + e2.message);
        setFoodsMap({});
        setLoading(false);
        return;
      }

      const map: Record<string, FoodBase> = {};
      (foods as FoodBase[]).forEach((f) => (map[f.id] = f));
      setFoodsMap(map);

      setLoading(false);
    })();
  }, [selectedDishId]);

  // 3) Construir filas calculadas
  const rows: Row[] = useMemo(() => {
    return dishItems.map((it) => {
      const food = foodsMap[it.food_id];
      const grams = n(gramsByItem[it.id] ?? it.grams_total);

      const kcal = food ? (grams * n(food.kcal_100)) / 100 : 0;
      const prot = food ? (grams * n(food.prot_100)) / 100 : 0;
      const carb = food ? (grams * n(food.carb_100)) / 100 : 0;
      const fat = food ? (grams * n(food.fat_100)) / 100 : 0;

      return {
        item_id: it.id,
        food_id: it.food_id,
        food_name: food?.name ?? "(alimento no encontrado)",
        grams,
        kcal,
        prot,
        carb,
        fat,
      };
    });
  }, [dishItems, foodsMap, gramsByItem]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.kcal,
        prot: acc.prot + r.prot,
        carb: acc.carb + r.carb,
        fat: acc.fat + r.fat,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [rows]);

  const selectedDish = useMemo(() => dishes.find((d) => d.id === selectedDishId) ?? null, [dishes, selectedDishId]);

  // 4) (Opcional) Guardar los gramos en la receta (actualiza dish_items.grams_total)
  async function guardarGramosEnReceta() {
    if (!selectedDishId) return;
    setLoading(true);
    setMsg("");

    const updates = dishItems.map((it) => ({
      id: it.id,
      grams_total: n(gramsByItem[it.id] ?? it.grams_total),
    }));

    const { error } = await supabase.from("dish_items").upsert(updates, { onConflict: "id" });
    if (error) {
      setMsg("Error guardando receta: " + error.message);
    } else {
      setMsg("Receta actualizada ✅");
    }

    setLoading(false);
  }

  return (
    <div className="stack">
      <div className="card">
        <h1 className="h1">Recetas · Calculadora de macros</h1>
        <div className="small muted">
          Elige una receta, ajusta los gramos por ingrediente y verás las macros recalculadas al instante.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label className="small">Receta</label>
          <select className="input" value={selectedDishId} onChange={(e) => setSelectedDishId(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {loading && <div className="small">Cargando…</div>}
          {msg && <div className="small">{msg}</div>}
        </div>
      </div>

      {selectedDishId && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="h2">{selectedDish?.name ?? "Receta"}</div>
              <div className="muted small">Raciones definidas: {selectedDish?.servings ?? 1}</div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              {/* Si no quieres guardar nunca, borra este botón */}
              <button className="btn" onClick={guardarGramosEnReceta} disabled={loading || dishItems.length === 0}>
                Guardar gramos en receta
              </button>
            </div>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="badge">Kcal: {r1(totals.kcal)}</span>
            <span className="badge">P: {r1(totals.prot)} g</span>
            <span className="badge">C: {r1(totals.carb)} g</span>
            <span className="badge">G: {r1(totals.fat)} g</span>
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
                key={r.item_id}
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
                <div>{r.food_name}</div>

                <div>
                  <input
                    className="input"
                    type="number"
                    step="1"
                    value={Number.isFinite(r.grams) ? r.grams : 0}
                    onChange={(e) =>
                      setGramsByItem((prev) => ({
                        ...prev,
                        [r.item_id]: n(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>{r1(r.kcal)}</div>
                <div>{r1(r.prot)}</div>
                <div>{r1(r.carb)}</div>
                <div>{r1(r.fat)}</div>
              </div>
            ))}

            {rows.length === 0 && <div className="muted small" style={{ marginTop: 10 }}>Esta receta no tiene ingredientes.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

