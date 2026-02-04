"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Food = {
  id: string;
  name: string;
  type: string;
  kcal_100: number;
  prot_100: number;
  carb_100: number;
  fat_100: number;
  ration_norm: number | null;
};

export default function AlimentosPage() {
  return (
    <AuthGate>
      <AlimentosInner />
    </AuthGate>
  );
}

function AlimentosInner() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("foods")
        .select("id,name,type,kcal_100,prot_100,carb_100,fat_100,ration_norm")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      setFoods((data ?? []) as any);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return foods;
    return foods.filter(f => f.name.toLowerCase().includes(s) || f.type.toLowerCase().includes(s));
  }, [foods, q]);

  return (
    <div className="grid">
      <div className="card" style={{gridColumn:"span 12"}}>
        <h1 className="h1">Alimentos</h1>
        <p className="p">Tus 151 alimentos importados desde Excel.</p>
        <div style={{marginTop:10}}>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar (nombre o tipo)..." />
        </div>
      </div>

      <div className="card" style={{gridColumn:"span 12"}}>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th><th>Tipo</th><th>kcal/100</th><th>Prot</th><th>Carb</th><th>Grasa</th><th>Ración</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(f => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.type}</td>
                <td>{f.kcal_100}</td>
                <td>{f.prot_100}</td>
                <td>{f.carb_100}</td>
                <td>{f.fat_100}</td>
                <td>{f.ration_norm ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small" style={{marginTop:8}}>Mostrando {Math.min(filtered.length, 200)} de {filtered.length}.</p>
      </div>
    </div>
  );
}
