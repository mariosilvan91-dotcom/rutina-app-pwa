"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Recipe = { id: string; name: string; day_type: string; meal: string; option_number: number | null; };

export default function PlatosPage() {
  return (
    <AuthGate>
      <PlatosInner />
    </AuthGate>
  );
}

function PlatosInner() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("recipes")
        .select("id,name,day_type,meal,option_number")
        .eq("user_id", user.id)
        .order("meal", { ascending: true });
      setRecipes((data ?? []) as any);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recipes;
    return recipes.filter(r => r.name.toLowerCase().includes(s) || r.meal.toLowerCase().includes(s) || r.day_type.toLowerCase().includes(s));
  }, [recipes, q]);

  return (
    <div className="grid">
      <div className="card" style={{gridColumn:"span 12"}}>
        <h1 className="h1">Platos</h1>
        <p className="p">Lista de platos importados. (Edición avanzada la añadimos en el siguiente ajuste.)</p>
        <div style={{marginTop:10}}>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar plato..." />
        </div>
      </div>

      <div className="card" style={{gridColumn:"span 12"}}>
        <table className="table">
          <thead>
            <tr><th>Plato</th><th>Tipo día</th><th>Comida</th><th>Opción</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.day_type}</td>
                <td>{r.meal}</td>
                <td>{r.option_number ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small" style={{marginTop:8}}>Total: {filtered.length}</p>
      </div>
    </div>
  );
}
