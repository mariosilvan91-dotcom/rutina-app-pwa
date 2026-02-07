"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

interface Plato { id: string; plato: string; comida: string; }
interface Alimento { 
  id: string; 
  Alimento: string; 
  "Ración_normal_g": number | null; 
}
interface Item { plato_item_id: string; alimento: string; grams: number; kcal: number; }

export default function EditorPlatos() {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [foods, setFoods] = useState<Alimento[]>([]);
  const [selectedPlato, setSelectedPlato] = useState<string>("");
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [grams, setGrams] = useState<number>(100); // Valor por defecto inicial
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const { data: p } = await supabase.from("stg_platos").select("*").order("plato");
    const { data: f } = await supabase.from("stg_foods").select("*").order("Alimento");
    if (p) setPlatos(p);
    if (f) setFoods(f);
  }

  useEffect(() => {
    if (selectedPlato) fetchItems();
  }, [selectedPlato]);

  async function fetchItems() {
    const { data } = await supabase.from("v_plato_items_macros").select("*").eq("plato_id", selectedPlato);
    setItems(data || []);
  }

  // --- LA FUNCIÓN CLAVE ---
  const handleFoodSelection = (foodId: string) => {
    setSelectedFood(foodId);
    
    // Buscamos el alimento dentro de nuestro estado 'foods'
    const foodFound = foods.find(f => String(f.id) === String(foodId));
    
    if (foodFound) {
      // Usamos la sintaxis de corchetes por la tilde en la columna
      const racionSugerida = foodFound["Ración_normal_g"];
      
      if (racionSugerida && racionSugerida > 0) {
        setGrams(Number(racionSugerida));
      } else {
        setGrams(100); // Si no hay ración definida, volvemos a 100
      }
    }
  };

  async function addItem() {
    if (!selectedPlato || !selectedFood) return;
    setLoading(true);
    await supabase.from("plato_items").insert({
      plato_id: selectedPlato,
      alimento_id: selectedFood,
      grams: grams,
      order_idx: items.length + 1
    });
    setLoading(false);
    setSelectedFood(""); // Limpiamos para el siguiente ingrediente
    fetchItems();
  }

  async function deleteItem(id: string) {
    await supabase.from("plato_items").delete().eq("id", id);
    fetchItems();
  }

  return (
    <AuthGate>
      <div className="card">
        <h1 className="h1">Configurar Recetas</h1>
        
        <label className="label">1. Selecciona el Plato</label>
        <select className="input" value={selectedPlato} onChange={e => setSelectedPlato(e.target.value)}>
          <option value="">-- Elige un plato --</option>
          {platos.map(p => <option key={p.id} value={p.id}>{p.plato} ({p.comida})</option>)}
        </select>

        {selectedPlato && (
          <div style={{ marginTop: "20px" }}>
            <label className="label">2. Añadir Alimento</label>
            <div style={{ display: "grid", gap: "10px" }}>
              
              {/* SELECT CON TRIGGER DE AUTO-RELLENO */}
              <select 
                className="input" 
                value={selectedFood} 
                onChange={e => handleFoodSelection(e.target.value)}
              >
                <option value="">-- Buscar alimento --</option>
                {foods.map(f => <option key={f.id} value={f.id}>{f.Alimento}</option>)}
              </select>

              <div className="row" style={{ gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <span className="small">Gramos (se ajusta solo):</span>
                  <input 
                    className="input" 
                    type="number" 
                    value={grams} 
                    onChange={e => setGrams(Number(e.target.value))} 
                  />
                </div>
                <button className="btn primary" onClick={addItem} disabled={loading} style={{ alignSelf: "flex-end", height: "45px" }}>
                  Añadir
                </button>
              </div>
            </div>

            <h3 className="h3" style={{ marginTop: "20px" }}>Ingredientes:</h3>
            <div style={{ display: "grid", gap: "5px" }}>
              {items.map(it => (
                <div key={it.plato_item_id} className="row" style={{ justifyContent: "space-between", background: "#222", padding: "10px", borderRadius: "8px" }}>
                  <span>{it.alimento} ({it.grams}g)</span>
                  <button onClick={() => deleteItem(it.plato_item_id)} style={{ background: "none", border: "none", color: "#ff4444", fontSize: "1.2rem" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
