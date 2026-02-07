"use client";

import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

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
  const [plato, setPlato] = useState("");
  const [i1, setI1] = useState("");
  const [i2, setI2] = useState("");
  const [i3, setI3] = useState("");
  const [i4, setI4] = useState("");
  const [i5, setI5] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function guardar() {
    setMsg("");
    const platoClean = clean(plato);
    if (!platoClean) {
      setMsg("El nombre del plato es obligatorio.");
      return;
    }

    const payload: any = {
      plato: platoClean,
      ingredientes_1: clean(i1) || null,
      ingredientes_2: clean(i2) || null,
      ingredientes_3: clean(i3) || null,
      ingredientes_4: clean(i4) || null,
      ingredientes_5: clean(i5) || null,
    };

    setLoading(true);

    const { error } = await supabase.from("stg_platos").insert(payload);

    setLoading(false);

    if (error) {
      setMsg("Error guardando receta: " + error.message);
      return;
    }

    setMsg("Receta guardada ✅");

    // limpiar formulario
    setPlato("");
    setI1("");
    setI2("");
    setI3("");
    setI4("");
    setI5("");
  }

  return (
    <div className="stack">
      <div className="card">
        <h1 className="h1">Nueva receta</h1>
        <div className="small muted">
          Crea un plato y guarda hasta 5 ingredientes en <b>stg_platos</b>.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div>
            <label className="small">Nombre del plato *</label>
            <input
              className="input"
              value={plato}
              onChange={(e) => setPlato(e.target.value)}
              placeholder="Ej: Pollo con arroz y verduras"
            />
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h3">Ingredientes</div>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <InputIng label="Ingrediente 1" value={i1} setValue={setI1} />
              <InputIng label="Ingrediente 2" value={i2} setValue={setI2} />
              <InputIng label="Ingrediente 3" value={i3} setValue={setI3} />
              <InputIng label="Ingrediente 4" value={i4} setValue={setI4} />
              <InputIng label="Ingrediente 5" value={i5} setValue={setI5} />
            </div>

            <div className="small muted" style={{ marginTop: 8 }}>
              Consejo: escribe el ingrediente exactamente como aparece en <b>foods_base.name</b> para que la calculadora encuentre los macros.
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn primary" onClick={guardar} disabled={loading}>
              {loading ? "Guardando..." : "Guardar receta"}
            </button>

            <button
              className="btn"
              onClick={() => {
                setPlato("");
                setI1(""); setI2(""); setI3(""); setI4(""); setI5("");
                setMsg("");
              }}
              disabled={loading}
            >
              Limpiar
            </button>
          </div>

          {msg && <div className="small">{msg}</div>}
        </div>
      </div>
    </div>
  );
}

function InputIng({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div>
      <label className="small">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ej: Pechuga de pollo"
      />
    </div>
  );
}
