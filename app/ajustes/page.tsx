"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

export default function AjustesPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Estado para los campos del formulario
  const [s, setS] = useState({
    kcal_entreno: 0,
    kcal_descanso: 0,
    p_prot: 0,
    p_carb: 0,
    p_grasa: 0,
    agua_obj_l: 0,
    pasos_obj: 0,
    sueno_obj_h: 0,
  });

  // 1. Obtener el usuario al cargar
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchSettings(data.user.id);
      }
    });
  }, []);

  // 2. Cargar ajustes desde la base de datos
  async function fetchSettings(uid: string) {
    const { data, error } = await supabase
      .from("user_settings") // Asegúrate de que tu tabla se llame así
      .select("*")
      .eq("user_id", uid)
      .single();

    if (data) {
      setS({
        kcal_entreno: data.kcal_entreno || 0,
        kcal_descanso: data.kcal_descanso || 0,
        p_prot: data.p_prot || 0,
        p_carb: data.p_carb || 0,
        p_grasa: data.p_grasa || 0,
        agua_obj_l: data.agua_obj_l || 0,
        pasos_obj: data.pasos_obj || 0,
        sueno_obj_h: data.sueno_obj_h || 0,
      });
    }
  }

  // 3. Función para guardar
  async function save() {
    if (!userId) return;
    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      ...s,
      updated_at: new Date().toISOString(),
    });

    setLoading(false);
    setMsg(error ? "Error al guardar" : "Ajustes guardados ✅");
  }

  return (
    <AuthGate>
      <div className="card">
        <h1 className="h1">Mis Ajustes</h1>
        <div className="grid-form" style={{ display: "grid", gap: "15px", marginTop: "15px" }}>
          
          <div>
            <div className="label">Kcal entreno</div>
            <input
              className="input"
              type="number"
              value={s.kcal_entreno}
              onChange={(e) => setS({ ...s, kcal_entreno: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">Kcal descanso</div>
            <input
              className="input"
              type="number"
              value={s.kcal_descanso}
              onChange={(e) => setS({ ...s, kcal_descanso: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">% Prot</div>
            <input
              className="input"
              type="number"
              step="0.01"
              value={s.p_prot}
              onChange={(e) => setS({ ...s, p_prot: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">% Carb</div>
            <input
              className="input"
              type="number"
              step="0.01"
              value={s.p_carb}
              onChange={(e) => setS({ ...s, p_carb: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">% Grasa</div>
            <input
              className="input"
              type="number"
              step="0.01"
              value={s.p_grasa}
              onChange={(e) => setS({ ...s, p_grasa: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">Agua (L)</div>
            <input
              className="input"
              type="number"
              step="0.1"
              value={s.agua_obj_l}
              onChange={(e) => setS({ ...s, agua_obj_l: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">Pasos</div>
            <input
              className="input"
              type="number"
              value={s.pasos_obj}
              onChange={(e) => setS({ ...s, pasos_obj: Number(e.target.value) })}
            />
          </div>

          <div>
            <div className="label">Sueño (h)</div>
            <input
              className="input"
              type="number"
              step="0.1"
              value={s.sueno_obj_h}
              onChange={(e) => setS({ ...s, sueno_obj_h: Number(e.target.value) })}
            />
          </div>

          <div className="row full" style={{ marginTop: "10px" }}>
            <button className="btn primary" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
            {msg && <div style={{ marginTop: "10px", fontSize: "0.9em" }}>{msg}</div>}
          </div>

        </div>
      </div>
    </AuthGate>
  );
}
