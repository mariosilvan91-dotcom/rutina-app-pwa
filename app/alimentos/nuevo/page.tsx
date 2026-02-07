"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

export default function NuevoIngredientePage() {
  return (
    <AuthGate>
      <NuevoIngredienteInner />
    </AuthGate>
  );
}

function NuevoIngredienteInner() {
  const params = useSearchParams();
  const router = useRouter();

  const [name, setName] = useState(params.get("name") ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [macros, setMacros] = useState<null | {
    kcal_100: number;
    prot_100: number;
    carb_100: number;
    fat_100: number;
    ration_norm: number;
  }>(null);

  async function calcWithAI() {
    if (!name.trim()) return;

    setLoading(true);
    setMsg("");
    setMacros(null);

    try {
      const r = await fetch("/api/ai-macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error IA");

      setMacros(j);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveIngredient() {
    if (!macros) return;

    setSaving(true);
    setMsg("");

    const { error } = await supabase.from("Foods").insert({
      name: name.trim(),
      kcal_100: macros.kcal_100,
      prot_100: macros.prot_100,
      carb_100: macros.carb_100,
      fat_100: macros.fat_100,
      ration_norm: macros.ration_norm,
    });

    setSaving(false);

    if (error) {
      setMsg("Error guardando ingrediente: " + error.message);
      return;
    }

    // volver a la receta
    router.back();
  }

  return (
    <div className="card">
      <h1 className="h1">Nuevo ingrediente</h1>

      <label className="small">Nombre</label>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej: Salsa curry"
      />

      <button
        className="btn"
        onClick={calcWithAI}
        disabled={loading}
        style={{ marginTop: 10 }}
      >
        {loading ? "Calculando..." : "Calcular macros con IA"}
      </button>

      {macros && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="small"><b>Macros por 100g</b></div>
          <div className="small">
            Kcal: {macros.kcal_100} · P {macros.prot_100} · C {macros.carb_100} · G {macros.fat_100}
          </div>
          <div className="small">
            Ración normal sugerida: {macros.ration_norm} g
          </div>

          <button
            className="btn primary"
            onClick={saveIngredient}
            disabled={saving}
            style={{ marginTop: 10 }}
          >
            {saving ? "Guardando..." : "Guardar en ingredientes"}
          </button>
        </div>
      )}

      {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
