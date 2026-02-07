"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Food = {
  id: string;
  name: string;
  kcal_100: number;
  prot_100: number;
  carb_100: number;
  fat_100: number;
  ration_norm: number | null;
};

function clean(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export default function NuevaRecetaPage() {
  return (
    <AuthGate>
      <NuevaRecetaInner />
    </AuthGate>
  );
}

function NuevaRecetaInner() {
  const [ingredient, setIngredient] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [open, setOpen] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const boxRef = useRef<HTMLDivElement | null>(null);

  // cerrar al click fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // buscar foods_base
  useEffect(() => {
    const q = clean(ingredient);
    setAiData(null);
    setMsg("");

    if (!q) {
      setResults([]);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("foods_base")
        .select("id, name, kcal_100, prot_100, carb_100, fat_100, ration_norm")
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(6);

      setResults((data ?? []) as Food[]);
    })();
  }, [ingredient]);

  async function calcWithAI() {
    setAiLoading(true);
    setMsg("");
    setAiData(null);

    try {
      const r = await fetch("/api/ai-macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredient }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error IA");
      setAiData(j);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function saveFood() {
    if (!aiData) return;

    const { error } = await supabase.from("Foods").insert({
      name: aiData.name,
      kcal_100: aiData.kcal_100,
      prot_100: aiData.prot_100,
      carb_100: aiData.carb_100,
      fat_100: aiData.fat_100,
      ration_norm: aiData.ration_norm,
    });

    if (error) {
      setMsg("Error guardando ingrediente: " + error.message);
      return;
    }

    setIngredient(aiData.name);
    setOpen(false);
    setMsg("Ingrediente añadido ✅");
  }

  return (
    <div className="card">
      <h1 className="h1">Nueva receta · Ingrediente</h1>

      <div ref={boxRef} style={{ position: "relative", marginTop: 12 }}>
        <input
          className="input"
          value={ingredient}
          onChange={(e) => {
            setIngredient(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Escribe un ingrediente…"
        />

        {open && (
          <div
            className="card"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              marginTop: 6,
              zIndex: 20,
            }}
          >
            {results.length > 0 ? (
              results.map((f) => (
                <div key={f.id} className="small">
                  {f.name} · {f.kcal_100} kcal/100g
                </div>
              ))
            ) : (
              <div className="stack">
                <div className="small muted">
                  No existe el ingrediente en la base.
                </div>

                <button
                  className="btn"
                  onClick={calcWithAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? "Calculando…" : "Calcular macros con IA"}
                </button>

                {aiData && (
                  <div className="card">
                    <div className="small">
                      <b>{aiData.name}</b>
                    </div>
                    <div className="small">
                      {aiData.kcal_100} kcal · P {aiData.prot_100} · C{" "}
                      {aiData.carb_100} · G {aiData.fat_100}
                    </div>
                    <div className="small">
                      Ración sugerida: {aiData.ration_norm} g
                    </div>

                    <button className="btn primary" onClick={saveFood}>
                      Añadir a ingredientes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
