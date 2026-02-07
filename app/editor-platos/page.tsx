"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

// 1. Actualizamos la interfaz para incluir la ración normal
interface Plato { id: string; plato: string; comida: string; tipo_dia: string; }
interface Alimento { 
  id: string; 
  Alimento: string; 
  "Kcal/100g": number; 
  "Ración_normal_g": number | null; // <--- Nueva columna
}
interface Item { plato_item_id: string; alimento: string; grams: number; kcal: number; }

export default function EditorPlatos() {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [foods, setFoods] = useState<Alimento[]>([]);
  const [selectedPlato, setSelectedPlato] = useState<string>("");
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [grams, setGrams] = useState<number>(100);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const { data: p } = await supabase.from("stg_platos").select("*").order("plato");
    
    // 2. Traemos explícitamente la columna de ración normal
    const { data: f } = await supabase.from("stg_foods")
      .select('id, Alimento, "Kcal/100g", Ración_normal_g')
      .order("Alimento");
      
    if (p) setPlatos(p);
    if (f) setFoods(f);
  }

  useEffect(() => {
    if (selectedPlato) fetchItems();
  }, [selectedPlato]);

  async function fetchItems() {
    const { data } = await supabase
      .from("v_plato_items_macros")
      .select("*")
      .eq("plato_id", selectedPlato);
    setItems(data || []);
  }

  // 3. Función para manejar el cambio de alimento y poner la ración por defecto
  function handleFoodChange(foodId: string) {
    setSelectedFood(foodId);
    
    // Buscamos el objeto del alimento seleccionado
    const food = foods.find(f => f.id === foodId);
    
    // Si existe y tiene una ración normal configurada, actualizamos los gramos
    if (food && food.Ración_normal_g) {
      setGrams(food.Ración_normal_g);
    }
  }

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
    fetchItems();
  }

  async function deleteItem(id: string) {
    // Usamos plato_item_id para borrar la fila correcta
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
              {/* Cambiamos el onChange por nuestra nueva función */}
              <select className="input" value={selectedFood} onChange={e => handleFoodChange(e.target.value)}>
                <option value="">-- Buscar alimento --</option>
                {foods.map(f => <option key={f.id} value={f.id}>{f.Alimento}</option>)}
              </select>
              
              <div className="row" style={{ gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <span className="small">Gramos:</span>
                  <input 
                    className="input" 
                    type="number" 
                    value={grams} 
                    onChange={e => setGrams(Number(e.target.value))} 
                  />
                </div>
                <button 
                  className="btn primary" 
                  onClick={addItem} 
                  disabled={loading}
                  style={{ alignSelf: "flex-end", height: "45px" }}
                >
                  Añadir
                </button>
              </div>
            </div>

            <h3 className="h3" style={{ marginTop: "20px" }}>Ingredientes actuales:</h3>
            <div style={{ display: "grid", gap: "5px" }}>
              {items.map(it => (
                <div key={it.plato_item_id} className="row" style={{ justifyContent: "space-between", background: "#222", padding: "10px", borderRadius: "8px" }}>
                  <span>{it.alimento} ({it.grams}g) - {Math.round(it.kcal)} kcal</span>
                  <button onClick={() => deleteItem(it.plato_item_id)} style={{ background: "none", border: "none", color: "#ff4444", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
