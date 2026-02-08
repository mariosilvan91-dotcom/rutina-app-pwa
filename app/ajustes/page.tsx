"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Goal = "gain" | "cut";

type SettingsRow = {
  user_id: string;

  // EXISTENTES en tu tabla
  kcal_entreno: number;
  kcal_descanso: number;

  // porcentajes en decimal (0.3 = 30%)
  p_prot: number;
  p_carb: number;
  p_grasa: number;

  // NUEVO (añadir columna en Supabase)
  objetivo: Goal | null;

  created_at?: string;
  updated_at?: string;
};

type Tab = "objetivo" | "kcal";

const GOALS: Record<Goal, { label: string; p_prot: number; p_carb: number; p_grasa: number }> = {
  gain: { label: "Ganar músculo", p_prot: 0.3, p_carb: 0.5, p_grasa: 0.2 },
  cut: { label: "Definir", p_prot: 0.4, p_carb: 0.35, p_grasa: 0.15 },
};

function clampNum(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// macros (g) desde kcal + % (decimal)
function gramsFromKcal(kcal: number, p_prot: number, p_carb: number, p_grasa: number) {
  const prot_g = (kcal * p_prot) / 4;
  const carb_g = (kcal * p_carb) / 4;
  const fat_g = (kcal * p_grasa) / 9;
  return { prot_g, carb_g, fat_g };
}

export default function AjustesPage() {
  return (
    <AuthGate>
      <AjustesInner />
    </AuthGate>
  );
}

function AjustesInner() {
  const [tab, setTab] = useState<Tab>("objetivo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [s, setS] = useState<SettingsRow | null>(null);

  // Cargar settings del usuario
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id,kcal_entreno,kcal_descanso,p_prot,p_carb,p_grasa,objetivo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMsg("Error cargando ajustes: " + error.message);
        setLoading(false);
        return;
      }

      // Si no existe fila aún, creamos un estado por defecto (se guardará al darle a Guardar)
      const fallback: SettingsRow = {
        user_id: user.id,
        kcal_entreno: 3000,
        kcal_descanso: 2700,
        p_prot: 0.3,
        p_carb: 0.5,
        p_grasa: 0.2,
        objetivo: "gain",
      };

      const row = (data as any) as SettingsRow | null;

      // Si viene sin objetivo, lo inferimos por % si coincide, si no, gain
      let objetivo: Goal | null = row?.objetivo ?? null;
      const pp = row?.p_prot ?? fallback.p_prot;
      const pc = row?.p_carb ?? fallback.p_carb;
      const pg = row?.p_grasa ?? fallback.p_grasa;

      if (!objetivo) {
        if (pp === GOALS.cut.p_prot && pc === GOALS.cut.p_carb && pg === GOALS.cut.p_grasa) objetivo = "cut";
        else if (pp === GOALS.gain.p_prot && pc === GOALS.gain.p_carb && pg === GOALS.gain.p_grasa) objetivo = "gain";
        else objetivo = "gain";
      }

      setS({
        user_id: user.id,
        kcal_entreno: row?.kcal_entreno ?? fallback.kcal_entreno,
        kcal_descanso: row?.kcal_descanso ?? fallback.kcal_descanso,
        p_prot: row?.p_prot ?? fallback.p_prot,
        p_carb: row?.p_carb ?? fallback.p_carb,
        p_grasa: row?.p_grasa ?? fallback.p_grasa,
        objetivo,
      });

      setLoading(false);
    })();
  }, []);

  const lockedPercents = true; // como pediste: sin opción a modificar

  const trainTargets = useMemo(() => {
    if (!s) return { prot_g: 0, carb_g: 0, fat_g: 0 };
    return gramsFromKcal(s.kcal_entreno, s.p_prot, s.p_carb, s.p_grasa);
  }, [s]);

  const restTargets = useMemo(() => {
    if (!s) return { prot_g: 0, carb_g: 0, fat_g: 0 };
    return gramsFromKcal(s.kcal_descanso, s.p_prot, s.p_carb, s.p_grasa);
  }, [s]);

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg("");

    const payload = {
      user_id: s.user_id,
      kcal_entreno: Math.round(clampNum(s.kcal_entreno, 0, 20000)),
      kcal_descanso: Math.round(clampNum(s.kcal_descanso, 0, 20000)),
      p_prot: s.p_prot,
      p_carb: s.p_carb,
      p_grasa: s.p_grasa,
      objetivo: s.objetivo,
    };

    const { error } = await supabase.from("user_settings").upsert(payload, { onConflict: "user_id" });

    if (error) {
      setMsg("Error guardando: " + error.message);
      setSaving(false);
      return;
    }

    setMsg("Guardado ✅");
    setSaving(false);
  }

  function onGoalChange(goal: Goal) {
    if (!s) return;
    const preset = GOALS[goal];

    setS({
      ...s,
      objetivo: goal,
      p_prot: preset.p_prot,
      p_carb: preset.p_carb,
      p_grasa: preset.p_grasa,
    });
  }

  if (loading) {
    return <div className="card">Cargando ajustes...</div>;
  }

  if (!s) {
    return <div className="card">No se han podido cargar los ajustes.</div>;
  }

  return (
    <div>
      <div className="card">
        <h1 className="h1">Ajustes</h1>

        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className={`btn small ${tab === "objetivo" ? "primary" : ""}`} onClick={() => setTab("objetivo")}>
            Objetivo
          </button>
          <button className={`btn small ${tab === "kcal" ? "primary" : ""}`} onClick={() => setTab("kcal")}>
            Kcal
          </button>

          <div style={{ flex: 1 }} />

          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {msg && (
          <div className="small" style={{ marginTop: 10 }}>
            {msg}
          </div>
        )}
      </div>

      {/* TAB OBJETIVO */}
      {tab === "objetivo" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Objetivo</div>

          <label className="small muted">¿Cuál es tu objetivo?</label>
          <select
            className="input"
            value={s.objetivo ?? ""}
            onChange={(e) => onGoalChange(e.target.value as Goal)}
          >
            <option value="gain">Ganar músculo</option>
            <option value="cut">Definir</option>
          </select>

          <div style={{ height: 12 }} />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small muted">% Prot</label>
              <input className="input" value={s.p_prot} disabled={lockedPercents} readOnly />
              <div className="small muted">({Math.round(s.p_prot * 100)}%)</div>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small muted">% Carb</label>
              <input className="input" value={s.p_carb} disabled={lockedPercents} readOnly />
              <div className="small muted">({Math.round(s.p_carb * 100)}%)</div>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small muted">% Grasa</label>
              <input className="input" value={s.p_grasa} disabled={lockedPercents} readOnly />
              <div className="small muted">({Math.round(s.p_grasa * 100)}%)</div>
            </div>
          </div>

          <div className="small muted" style={{ marginTop: 10 }}>
            Se asignan automáticamente según el objetivo y no se pueden editar.
          </div>
        </div>
      )}

      {/* TAB KCAL + RESUMEN DE GRAMOS */}
      {tab === "kcal" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Calorías y macros diarios</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="small muted">Kcal día entreno</label>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={s.kcal_entreno}
                onChange={(e) => setS({ ...s, kcal_entreno: Number(e.target.value || 0) })}
              />
              <div className="small muted" style={{ marginTop: 6 }}>
                Objetivo entreno: P {trainTargets.prot_g.toFixed(0)}g · C {trainTargets.carb_g.toFixed(0)}g · G{" "}
                {trainTargets.fat_g.toFixed(0)}g
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="small muted">Kcal día descanso</label>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={s.kcal_descanso}
                onChange={(e) => setS({ ...s, kcal_descanso: Number(e.target.value || 0) })}
              />
              <div className="small muted" style={{ marginTop: 6 }}>
                Objetivo descanso: P {restTargets.prot_g.toFixed(0)}g · C {restTargets.carb_g.toFixed(0)}g · G{" "}
                {restTargets.fat_g.toFixed(0)}g
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span className="badge">
              % macros: {Math.round(s.p_prot * 100)}/{Math.round(s.p_carb * 100)}/{Math.round(s.p_grasa * 100)}
            </span>
            <span className="badge">Objetivo: {s.objetivo ? GOALS[s.objetivo].label : "—"}</span>
          </div>

          <div className="small muted" style={{ marginTop: 10 }}>
            Estos gramos son los que usarás luego para autogenerar menús desde <b>stg_platos</b> (sumando macros desde{" "}
            <b>foods</b> y <b>foods_base</b>).
          </div>
        </div>
      )}
    </div>
  );
}
