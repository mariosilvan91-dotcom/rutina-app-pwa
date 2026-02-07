"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

/**
 * app/editor-platos/page.tsx
 * ✅ FIX: columnas con tilde en select() -> usar comillas dobles o alias
 * Aquí uso ALIAS para evitar tildes en TypeScript: "Ración_normal_g":racion_normal_g
 */

// --- TIPOS ---
type TipoDia = "entreno" | "descanso";
type ComidaKey = "desayuno" | "comida" | "merienda" | "cena";

type Plato = {
  id: string;
  plato: string;
  tipo_dia: TipoDia;
  comida: ComidaKey;
  proteina: string | null;
  carbohidrato2: string | null;
  grasa: string | null;
  extra: string | null;
  extra2: string | null;
};

type Alimento = {
  id: string;
  Alimento: string;
  racion_normal_g: number | null; // ✅ alias
};

export default function EditorPlatosPage() {
  return (
    <AuthGate>
      <EditorPlatosInner />
    </AuthGate>
  );
}

function EditorPlatosInner() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [platos, setPlatos] = useState<Plato[]>([]);
  const [foods, setFoods] = useState<Alimento[]>([]);

  const [selectedPlatoId, setSelectedPlatoId] = useState<string>("");

  const selectedPlato = useMemo(
    () => platos.find((p) => p.id === selectedPlatoId) || null,
    [platos, selectedPlatoId]
  );

  async function loadAll() {
    setLoading(true);
    setStatus("");

    try {
      // --- 1) PLATOS ---
      const { data: p, error: pErr } = await supabase
        .from("stg_platos")
        .select("id, plato, tipo_dia, comida, proteina, carbohidrato2, grasa, extra, extra2")
        .order("plato", { ascending: true });

      if (pErr) throw pErr;

      // --- 2) FOODS ---
      // ✅ Columna con tilde: "Ración_normal_g" -> comillas + alias
      const { data: f, error: fErr } = await supabase
        .from("stg_foods")
        .select('id, "Alimento", "Ración_normal_g":racion_normal_g')
        .order("Alimento", { ascending: true });

      if (fErr) throw fErr;

      if (p) setPlatos(p as Plato[]);
      if (f) setFoods(f as Alimento[]);

      if (!selectedPlatoId && p?.length) setSelectedPlatoId(p[0].id);

      setStatus("Datos cargados ✅");
    } catch (e: any) {
      setStatus("Error: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchSelected(patch: Partial<Plato>) {
    if (!selectedPlato) return;
    setPlatos((prev) => prev.map((x) => (x.id === selectedPlato.id ? { ...x, ...patch } : x)));
  }

  async function saveSelected() {
    if (!selectedPlato) return;
    setLoading(true);
    setStatus("");

    try {
      const payload = {
        id: selectedPlato.id,
        plato: selectedPlato.plato,
        tipo_dia: selectedPlato.tipo_dia,
        comida: selectedPlato.comida,
        proteina: selectedPlato.proteina,
        carbohidrato2: selectedPlato.carbohidrato2,
        grasa: selectedPlato.grasa,
        extra: selectedPlato.extra,
        extra2: selectedPlato.extra2,
      };

      const { error } = await supabase.from("stg_platos").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      setStatus("Guardado ✅");
    } catch (e: any) {
      setStatus("Error: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <h1 className="h1">Editor de platos</h1>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={loadAll} disabled={loading}>
            Recargar
          </button>
          <button className="btn primary" onClick={saveSelected} disabled={loading || !selectedPlato}>
            Guardar
          </button>
        </div>
        {status && (
          <div className="small" style={{ marginTop: 8 }}>
            {status}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <div style={{ minWidth: 260 }}>
            <div className="small" style={{ marginBottom: 6, fontWeight: 800 }}>
              Plato
            </div>
            <select
              className="input"
              value={selectedPlatoId}
              onChange={(e) => setSelectedPlatoId(e.target.value)}
              disabled={loading}
            >
              {platos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plato}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <div className="small" style={{ marginBottom: 6, fontWeight: 800 }}>
              Nombre
            </div>
            <input
              className="input"
              value={selectedPlato?.plato ?? ""}
              onChange={(e) => patchSelected({ plato: e.target.value })}
              disabled={!selectedPlato || loading}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="small" style={{ marginBottom: 6, fontWeight: 800 }}>
              Tipo día
            </div>
            <select
              className="input"
              value={selectedPlato?.tipo_dia ?? "entreno"}
              onChange={(e) => patchSelected({ tipo_dia: e.target.value as TipoDia })}
              disabled={!selectedPlato || loading}
            >
              <option value="entreno">entreno</option>
              <option value="descanso">descanso</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <div className="small" style={{ marginBottom: 6, fontWeight: 800 }}>
              Comida
            </div>
            <select
              className="input"
              value={selectedPlato?.comida ?? "desayuno"}
              onChange={(e) => patchSelected({ comida: e.target.value as ComidaKey })}
              disabled={!selectedPlato || loading}
            >
              <option value="desayuno">desayuno</option>
              <option value="comida">comida</option>
              <option value="merienda">merienda</option>
              <option value="cena">cena</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <Field
            label="Proteína"
            value={selectedPlato?.proteina ?? ""}
            onChange={(v) => patchSelected({ proteina: v })}
            disabled={!selectedPlato || loading}
          />
          <Field
            label="Carbohidrato2"
            value={selectedPlato?.carbohidrato2 ?? ""}
            onChange={(v) => patchSelected({ carbohidrato2: v })}
            disabled={!selectedPlato || loading}
          />
          <Field
            label="Grasa"
            value={selectedPlato?.grasa ?? ""}
            onChange={(v) => patchSelected({ grasa: v })}
            disabled={!selectedPlato || loading}
          />
          <Field
            label="Extra"
            value={selectedPlato?.extra ?? ""}
            onChange={(v) => patchSelected({ extra: v })}
            disabled={!selectedPlato || loading}
          />
          <Field
            label="Extra2"
            value={selectedPlato?.extra2 ?? ""}
            onChange={(v) => patchSelected({ extra2: v })}
            disabled={!selectedPlato || loading}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="h2">stg_foods</h2>
        <div className="small" style={{ marginBottom: 8 }}>
          Alimentos: <b>{foods.length}</b>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          {foods.slice(0, 50).map((f) => (
            <div
              key={f.id}
              className="row"
              style={{
                justifyContent: "space-between",
                borderBottom: "1px solid #333",
                padding: "6px 0",
              }}
            >
              <div style={{ fontWeight: 800 }}>{f.Alimento}</div>
              <div className="badge">{f.racion_normal_g ?? "—"} g</div>
            </div>
          ))}
        </div>

        {foods.length > 50 && (
          <div className="small" style={{ marginTop: 8 }}>
            … y {foods.length - 50} más
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="small" style={{ marginBottom: 6, fontWeight: 800 }}>
        {label}
      </div>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        placeholder={`Ej: ${label}`}
      />
    </div>
  );
}
