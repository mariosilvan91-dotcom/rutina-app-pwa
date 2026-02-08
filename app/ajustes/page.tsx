"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Goal = "gain" | "cut";
type Tab = "objetivo" | "kcal" | "agua" | "pasos" | "sueno";

type SettingsRow = {
  user_id: string;

  // kcal existentes (los tuyos)
  kcal_entreno: number;
  kcal_descanso: number;

  // % macros existentes (en decimal: 0.3 = 30%)
  p_prot: number;
  p_carb: number;
  p_grasa: number;

  // otros objetivos (ya los tenías en tu app)
  agua_obj_l: number;
  pasos_obj: number;
  sueno_obj_h: number;

  // nuevo
  objetivo: Goal | null;
};

const GOALS: Record<Goal, { label: string; p_prot: number; p_carb: number; p_grasa: number }> = {
  gain: { label: "Ganar músculo", p_prot: 0.3, p_carb: 0.5, p_grasa: 0.2 },
  cut: { label: "Definir", p_prot: 0.4, p_carb: 0.35, p_grasa: 0.15 },
};

function clampNum(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

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

  // Cargar ajustes
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

      // IMPORTANTE: selecciona columnas reales existentes + objetivo
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id,kcal_entreno,kcal_descanso,p_prot,p_carb,p_grasa,agua_obj_l,pasos_obj,sueno_obj_h,objetivo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMsg("Error cargando ajustes: " + error.message);
        setLoading(false);
        return;
      }

      // Defaults razonables
      const fallback: SettingsRow = {
        user_id: user.id,
        kcal_entreno: 3000,
        kcal_descanso: 2700,
        p_prot: 0.3,
        p_carb: 0.5,
        p_grasa: 0.2,
        agua_obj_l: 2.5,
        pasos_obj: 8000,
        sueno_obj_h: 7.5,
        objetivo: "gain",
      };

      const row = (data as any) as Partial<SettingsRow> | null;

      // Si no viene objetivo, lo inferimos por % si coincide
      let objetivo: Goal | null = (row?.objetivo as any) ?? null;
      const pp = row?.p_prot ?? fallback.p_prot;
      const pc = row?.p_carb ?? fallback.p_carb;
      const pg = row?.p_grasa ?? fallback.p_grasa;

      if (!objetivo) {
        if (pp === GOALS.cut.p_prot && pc === GOALS.cut.p_carb && pg === GOALS.cut.p_grasa) objetivo = "cut";
        else if (pp === GOALS.gain.p_prot && pc === GOALS.gain.p_carb && pg === GOALS.gain.p_grasa) objetivo = "gain";
        else objetivo = "gain";
      }

      // Si existe fila, cargamos; si no, usamos fallback (y se guardará al darle Guardar)
      setS({
        user_id: user.id,
        kcal_entreno: row?.kcal_entreno ?? fallback.kcal_entreno,
        kcal_descanso: row?.kcal_descanso ?? fallback.kcal_descanso,
        p_prot: row?.p_prot ?? fallback.p_prot,
        p_carb: row?.p_carb ?? fallback.p_carb,
        p_grasa: row?.p_grasa ?? fallback.p_grasa,
        agua_obj_l: row?.agua_obj_l ?? fallback.agua_obj_l,
        pasos_obj: row?.pasos_obj ?? fallback.pasos_obj,
        sueno_obj_h: row?.sueno_obj_h ?? fallback.sueno_obj_h,
        objetivo,
      });

      setLoading(false);
    })();
  }, []);

  const lockedPercents = true; // como pediste: sin opción de modificar

  const trainTargets = useMemo(() => {
    if (!s) return { prot_g: 0, carb_g: 0, fat_g: 0 };
    return gramsFromKcal(s.kcal_entreno, s.p_prot, s.p_carb, s.p_grasa);
  }, [s]);

  const restTargets = useMemo(() => {
    if (!s) return { prot_g: 0, carb_g: 0, fat_g: 0 };
    return gramsFromKcal(s.kcal_descanso, s.p_prot, s.p_carb, s.p_grasa);
  }, [s]);

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

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg("");

    const payload = {
      user_id: s.user_id,

      kcal_entreno: Math.round(clampNum(s.kcal_entreno, 0, 20000)),
      kcal_descanso: Math.round(clampNum(s.kcal_descanso, 0, 20000)),

      // % macros (bloqueados pero se guardan)
      p_prot: s.p_prot,
      p_carb: s.p_carb,
      p_grasa: s.p_grasa,

      // hábitos
      agua_obj_l: Number(clampNum(s.agua_obj_l, 0, 20).toFixed(2)),
      pasos_obj: Math.round(clampNum(s.pasos_obj, 0, 50000)),
      sueno_obj_h: Number(clampNum(s.sueno_obj_h, 0, 16).toFixed(2)),

      // nuevo
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
            Calorías
          </button>
          <button className={`btn small ${tab === "agua" ? "primary" : ""}`} onClick={() => setTab("agua")}>
            Agua
          </button>
          <button className={`btn small ${tab === "pasos" ? "primary" : ""}`} onClick={() => setTab("pasos")}>
            Pasos
          </button>
          <button className={`btn small ${tab === "sueno" ? "primary" : ""}`} onClick={() => setTab("sueno")}>
            Sueño
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

          <label className="small muted">Selecciona tu objetivo</label>
          <select className="input" value={s.objetivo ?? "gain"} onChange={(e) => onGoalChange(e.target.value as Goal)}>
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
            Los porcentajes se asignan automáticamente según el objetivo y no se pueden editar.
          </div>
        </div>
      )}

      {/* TAB KCAL */}
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
                Objetivo entreno: <b>P {trainTargets.prot_g.toFixed(0)}g</b> · <b>C {trainTargets.carb_g.toFixed(0)}g</b>{" "}
                · <b>G {trainTargets.fat_g.toFixed(0)}g</b>
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
                Objetivo descanso: <b>P {restTargets.prot_g.toFixed(0)}g</b> · <b>C {restTargets.carb_g.toFixed(0)}g</b>{" "}
                · <b>G {restTargets.fat_g.toFixed(0)}g</b>
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span className="badge">
              % macros: {Math.round(s.p_prot * 100)}/{Math.round(s.p_carb * 100)}/{Math.round(s.p_grasa * 100)}
            </span>
            <span className="badge">Objetivo: {s.objetivo ? GOALS[s.objetivo].label : "—"}</span>
          </div>
        </div>
      )}

      {/* TAB AGUA */}
      {tab === "agua" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Agua</div>

          <label className="small muted">Objetivo diario (litros)</label>
          <input
            className="input"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={s.agua_obj_l}
            onChange={(e) => setS({ ...s, agua_obj_l: Number(e.target.value || 0) })}
          />

          <div className="small muted" style={{ marginTop: 10 }}>
            Recomendación práctica: 2.0–3.5 L/día según actividad y calor.
          </div>
        </div>
      )}

      {/* TAB PASOS */}
      {tab === "pasos" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Pasos</div>

          <label className="small muted">Objetivo diario (pasos)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={s.pasos_obj}
            onChange={(e) => setS({ ...s, pasos_obj: Number(e.target.value || 0) })}
          />

          <div className="small muted" style={{ marginTop: 10 }}>
            Si quieres “mínimo viable”: 7.000–10.000 pasos/día.
          </div>
        </div>
      )}

      {/* TAB SUEÑO */}
      {tab === "sueno" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Sueño</div>

          <label className="small muted">Objetivo diario (horas)</label>
          <input
            className="input"
            type="number"
            step="0.25"
            inputMode="decimal"
            value={s.sueno_obj_h}
            onChange={(e) => setS({ ...s, sueno_obj_h: Number(e.target.value || 0) })}
          />

          <div className="small muted" style={{ marginTop: 10 }}>
            Ideal para progreso muscular: 7–9h. Lo importante es la consistencia.
          </div>
        </div>
      )}
    </div>
  );
}
