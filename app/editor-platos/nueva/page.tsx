"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

function clean(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

type TipoDia = "entreno" | "descanso";
type Comida = "desayuno" | "comida" | "merienda" | "cena";

export default function NuevaRecetaPage() {
  return (
    <AuthGate>
      <NuevaRecetaInner />
    </AuthGate>
  );
}

function NuevaRecetaInner() {
  const [plato, setPlato] = useState("");

  const [tipoDia, setTipoDia] = useState<TipoDia>("entreno");
  const [comida, setComida] = useState<Comida>("comida");

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

    const base = {
      plato: platoClean,
      tipo_dia: tipoDia,
      comida,
    };

    // intento A: plural ingredientes_1..5
    const payloadPlural: any = {
      ...base,
      ingredientes_1: clean(i1) || null,
      ingredientes_2: clean(i2) || null,
      ingredientes_3: clean(i3) || null,
      ingredientes_4: clean(i4) || null,
      ingredientes_5: clean(i5) || null,
    };

    setLoading(true);

    const { error: e1 } = await supabase.from("stg_platos").insert(payloadPlural);

    if (!e1) {
      setMsg("Receta guardada ✅");
      setLoading(false);
      setPlato("");
      setI1(""); setI2(""); setI3(""); setI4(""); setI5("");
      return;
    }

    // si falló por columnas, reintentar B: singular ingrediente_1..5
    const payloadSingular: any = {
      ...base,
      ingrediente_1: clean(i1) || null,
      ingrediente_2: clean(i2) || null,
      ingrediente_3: clean(i3) || null,
      ingrediente_4: clean(i4) || null,
      ingrediente_5: clean(i5) || null,
    };

    const { error: e2 } = await supabase.from("stg_platos").insert(payloadSingular);

    setLoading(false);

    if (e2) {
      setMsg("Error guardando receta: " + e2.message);
      return;
    }

    setMsg("Receta guardada ✅ (modo singular)");
    setPlato("");
    setI1(""); setI2(""); setI3(""); setI4(""); setI5("");
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h1 className="h1" style={{ margin: 0 }}>Nueva receta</h1>
          <Link className="btn" href="/recetas">← Volver</Link>
        </div>

        <div className="small muted" style={{ marginTop: 8 }}>
          Guarda en <b>stg_platos</b> con tipo_dia + comida (para que luego tu Plan semanal pueda usarlo).
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

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Tipo día</label>
              <select className="input" value={tipoDia} onChange={(e) => setTipoDia(e.target.value as TipoDia)}>
                <option value="entreno">entreno</option>
                <option value="descanso">descanso</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Comida</label>
              <select className="input" value={comida} onChange={(e) => setComida(e.target.value as Comida)}>
                <option value="desayuno">desayuno</option>
                <option value="comida">comida</option>
                <option value="merienda">merienda</option>
                <option value="cena">cena</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h3">Ingredientes (hasta 5)</div>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <Ing label="Ingrediente 1" value={i1} setValue={setI1} />
              <Ing label="Ingrediente 2" value={i2} setValue={setI2} />
              <Ing label="Ingrediente 3" value={i3} setValue={setI3} />
              <Ing label="Ingrediente 4" value={i4} setValue={setI4} />
              <Ing label="Ingrediente 5" value={i5} setValue={setI5} />
            </div>

            <div className="small muted" style={{ marginTop: 8 }}>
              Consejo: escribe el ingrediente exactamente como aparece en <b>foods_base.name</b> para que la calculadora lo encuentre.
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

          {msg && <div className="small" style={{ marginTop: 6 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}

function Ing({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  return (
    <div>
      <label className="small">{label}</label>
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ej: Arroz blanco" />
    </div>
  );
}
