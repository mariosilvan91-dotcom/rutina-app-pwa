"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";

type Plato = {
  id: string;
  tipo_dia: "entreno" | "descanso";
  comida: "desayuno" | "comida" | "merienda" | "cena";
  plato: string;

  // ✅ ingredientes en columnas
  ingrediente_1: string | null;
  ingrediente_2: string | null;
  ingrediente_3: string | null;
  ingrediente_4: string | null;
  ingrediente_5: string | null;
};

type WeekDayPlan = {
  day: string; // YYYY-MM-DD
  tipo_dia: "entreno" | "descanso";
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

type UserSettings = {
  kcal_entreno: number | null;
  kcal_descanso: number | null;
  p_prot: number | null; // decimal (0.3 = 30%)
  p_carb: number | null; // decimal (0.5 = 50%)
  p_grasa: number | null; // decimal (0.2 = 20%)
};

type FoodRow = {
  // ⚠️ CAMBIA "name" si tu columna se llama diferente (ej. "alimento", "food", "Alimento")
  name: string;
  prot_100: number | null;
  carb_100: number | null;
  fat_100: number | null;
  ration_norm: number | null; // gramos
};

type DishMacros = {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
};

function ymd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"];

function pickOne(arr: Plato[]) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function calcMacroTargets(kcal: number, p_prot: number, p_carb: number, p_grasa: number) {
  const prot_g = (kcal * p_prot) / 4;
  const carb_g = (kcal * p_carb) / 4;
  const grasa_g = (kcal * p_grasa) / 9;
  return { prot_g, carb_g, grasa_g };
}

export default function PlanDiaPage() {
  return (
    <AuthGate>
      <PlanSemanalInner />
    </AuthGate>
  );
}

function PlanSemanalInner() {
  const [userId, setUserId] = useState("");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const weekStart = useMemo(() => startOfWeekMonday(anchor), [anchor]);
  const weekStartISO = useMemo(() => ymd(weekStart), [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const [platos, setPlatos] = useState<Plato[]>([]);
  const [rows, setRows] = useState<WeekDayPlan[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return {
          day: ymd(d),
          tipo_dia: "entreno",
          desayuno_plato: null,
          comida_plato: null,
          merienda_plato: null,
          cena_plato: null,
        };
      })
  );

  const [settings, setSettings] = useState<UserSettings | null>(null);

  // ✅ NUEVO: macros calculadas por receta (plato)
  const [dishMacrosById, setDishMacrosById] = useState<Record<string, DishMacros>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // cargar settings (kcal + % macros)
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from("user_settings")
        .select("kcal_entreno,kcal_descanso,p_prot,p_carb,p_grasa")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        setStatus((prev) => (prev ? prev + " · " : "") + "Error settings: " + error.message);
        return;
      }

      setSettings((data as any) ?? null);
    })();
  }, []);

  // Cargar platos desde stg_platos (ahora con ingredientes_1..5)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("");
      const { data, error } = await supabase
        .from("stg_platos")
        .select("id,tipo_dia,comida,plato,ingrediente_1,ingrediente_2,ingrediente_3,ingrediente_4,ingrediente_5");

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
      setPlatos((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  // Cargar semana guardada
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setStatus("");

      const from = ymd(weekStart);
      const to = ymd(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));

      const { data, error } = await supabase
        .from("week_plan_days")
        .select("day,tipo_dia,desayuno_plato,comida_plato,merienda_plato,cena_plato")
        .eq("user_id", userId)
        .gte("day", from)
        .lte("day", to)
        .order("day", { ascending: true });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const base: WeekDayPlan[] = weekDays.map((d) => ({
        day: ymd(d),
        tipo_dia: "entreno",
        desayuno_plato: null,
        comida_plato: null,
        merienda_plato: null,
        cena_plato: null,
      }));

      const map = new Map<string, any>();
      (data ?? []).forEach((r: any) => map.set(String(r.day), r));

      const merged = base.map((b) => {
        const r = map.get(b.day);
        if (!r) return b;
        return {
          day: b.day,
          tipo_dia: (r.tipo_dia ?? "entreno") as any,
          desayuno_plato: r.desayuno_plato ?? null,
          comida_plato: r.comida_plato ?? null,
          merienda_plato: r.merienda_plato ?? null,
          cena_plato: r.cena_plato ?? null,
        };
      });

      setRows(merged);
      setLoading(false);
    })();
  }, [userId, weekStartISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => {
    const by = (tipo: "entreno" | "descanso", comida: Plato["comida"]) =>
      platos.filter((p) => p.tipo_dia === tipo && p.comida === comida);
    return { by };
  }, [platos]);

  const platoIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of platos) {
      if (!m.has(p.plato)) m.set(p.plato, p.id);
    }
    return m;
  }, [platos]);

  const platoById = useMemo(() => {
    const m = new Map<string, Plato>();
    for (const p of platos) m.set(p.id, p);
    return m;
  }, [platos]);

  function setRow(idx: number, patch: Partial<WeekDayPlan>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function autogenerarSemana() {
    setRows((prev) =>
      prev.map((r) => {
        const d = r.tipo_dia;
        const des = pickOne(options.by(d, "desayuno"))?.plato ?? r.desayuno_plato;
        const com = pickOne(options.by(d, "comida"))?.plato ?? r.comida_plato;
        const mer = pickOne(options.by(d, "merienda"))?.plato ?? r.merienda_plato;
        const cen = pickOne(options.by(d, "cena"))?.plato ?? r.cena_plato;
        return { ...r, desayuno_plato: des, comida_plato: com, merienda_plato: mer, cena_plato: cen };
      })
    );
    setStatus("Semana autogenerada ✅ (puedes ajustar a mano)");
  }

  async function guardarSemana() {
    if (!userId) return;
    setLoading(true);
    setStatus("");

    const payload = rows.map((r) => ({
      user_id: userId,
      week_start: weekStartISO,
      day: r.day,
      tipo_dia: r.tipo_dia,
      desayuno_plato: r.desayuno_plato,
      comida_plato: r.comida_plato,
      merienda_plato: r.merienda_plato,
      cena_plato: r.cena_plato,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("week_plan_days")
      .upsert(payload, { onConflict: "user_id,day" });

    setLoading(false);
    setStatus(error ? error.message : "Semana guardada ✅");
  }

  function shiftWeek(delta: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  }

  const title = useMemo(() => {
    const s = weekStart;
    const e = new Date(weekStart);
    e.setDate(weekStart.getDate() + 6);
    const a = s.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    const b = e.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    return `${a} — ${b}`;
  }, [weekStartISO]); // eslint-disable-line react-hooks/exhaustive-deps

  function targetsFor(tipo_dia: "entreno" | "descanso") {
    const kcal_entreno = settings?.kcal_entreno ?? 0;
    const kcal_descanso = settings?.kcal_descanso ?? 0;
    const p_prot = settings?.p_prot ?? 0;
    const p_carb = settings?.p_carb ?? 0;
    const p_grasa = settings?.p_grasa ?? 0;

    const kcal = tipo_dia === "entreno" ? kcal_entreno : kcal_descanso;
    if (!kcal || !p_prot || !p_carb || !p_grasa) return { kcal: 0, prot_g: 0, carb_g: 0, grasa_g: 0 };

    const m = calcMacroTargets(kcal, p_prot, p_carb, p_grasa);
    return { kcal, ...m };
  }

  // ✅ NUEVO: calcular macros de todas las recetas usando ingrediente_1..5 + foods (prot_100/carb_100/fat_100) y foods.ration_norm
  useEffect(() => {
    (async () => {
      if (!platos.length) return;

      // 1) ingredientes únicos usados por cualquier receta
      const ingSet = new Set<string>();
      for (const p of platos) {
        const list = [p.ingrediente_1, p.ingrediente_2, p.ingrediente_3, p.ingrediente_4, p.ingrediente_5];
        list.forEach((x) => {
          const v = (x ?? "").trim();
          if (v) ingSet.add(v);
        });
      }
      const ingredients = Array.from(ingSet);
      if (!ingredients.length) {
        setDishMacrosById({});
        return;
      }

      // 2) cargar foods de esos ingredientes
      // ⚠️ Si tu columna de nombre NO es "name", cámbiala aquí:
      const { data: foods, error } = await supabase
        .from("foods")
        .select("name,prot_100,carb_100,fat_100,default_ration_g")
        .in("name", ingredients);

      if (error) {
        setStatus((prev) => (prev ? prev + " · " : "") + "Error foods: " + error.message);
        return;
      }

      const foodByName = new Map<string, FoodRow>();
      (foods ?? []).forEach((f: any) => foodByName.set(String(f.name).trim(), f as FoodRow));

      // 3) sumar macros por receta
      const acc: Record<string, DishMacros> = {};

      for (const p of platos) {
        let prot = 0;
        let carb = 0;
        let fat = 0;

        const list = [p.ingrediente_1, p.ingrediente_2, p.ingrediente_3, p.ingrediente_4, p.ingrediente_5]
          .map((x) => (x ?? "").trim())
          .filter(Boolean);

        for (const ing of list) {
          const f = foodByName.get(ing);
          if (!f) continue;

          const grams = Number(f.ration_norm ?? 0); // gramos por defecto del ingrediente
          if (!grams) continue;

          const factor = grams / 100.0;
          prot += factor * Number(f.prot_100 ?? 0);
          carb += factor * Number(f.carb_100 ?? 0);
          fat += factor * Number(f.fat_100 ?? 0);
        }

        const kcal = prot * 4 + carb * 4 + fat * 9;
        acc[p.id] = { kcal, prot, carb, fat };
      }

      setDishMacrosById(acc);
    })();
  }, [platos]);

  function dishMacrosForName(platoName: string | null): DishMacros | null {
    if (!platoName) return null;
    const id = platoIdByName.get(platoName);
    if (!id) return null;
    return dishMacrosById[id] ?? null;
  }

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan semanal</h1>
        <p className="p">Edita tu semana completa y se verá en “Hoy” automáticamente.</p>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>←</button>
          <span className="badge"><b>{title}</b></span>
          <button className="btn" onClick={() => shiftWeek(1)}>→</button>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={() => setAnchor(new Date())}>Ir a hoy</button>
          <button className="btn" onClick={autogenerarSemana}>Autogenerar semana</button>
          <button className="btn primary" onClick={guardarSemana}>Guardar semana</button>
        </div>

        {loading ? <div className="small" style={{ marginTop: 10 }}>Cargando…</div> : null}
        {status ? <div className="small" style={{ marginTop: 10 }}>{status}</div> : null}
      </div>

      {/* Editor semana */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Editar días</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {rows.map((r, idx) => {
            const d = weekDays[idx];
            const label = `${DOW_ES[idx]} ${d.getDate()}`;
            const t = targetsFor(r.tipo_dia);

            return (
              <div key={r.day} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <span className="badge">{r.day}</span>
                </div>

                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <button
                    className={`btn ${r.tipo_dia === "entreno" ? "primary" : ""}`}
                    onClick={() => setRow(idx, { tipo_dia: "entreno" })}
                  >
                    Entreno
                  </button>
                  <button
                    className={`btn ${r.tipo_dia === "descanso" ? "primary" : ""}`}
                    onClick={() => setRow(idx, { tipo_dia: "descanso" })}
                  >
                    Descanso
                  </button>
                </div>

                <div className="small muted" style={{ marginTop: 10 }}>
                  Obj: <b>{t.kcal ? Math.round(t.kcal) : "—"}</b> kcal · P <b>{t.kcal ? Math.round(t.prot_g) : "—"}</b>g · C{" "}
                  <b>{t.kcal ? Math.round(t.carb_g) : "—"}</b>g · G <b>{t.kcal ? Math.round(t.grasa_g) : "—"}</b>g
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <SelectPlato
                      label="Desayuno"
                      value={r.desayuno_plato}
                      onChange={(v) => setRow(idx, { desayuno_plato: v })}
                      platos={options.by(r.tipo_dia, "desayuno").map((p) => p.plato)}
                    />
                    {(() => {
                      const m = dishMacrosForName(r.desayuno_plato);
                      if (!m) return null;
                      return (
                        <div className="small muted" style={{ marginTop: 6 }}>
                          Receta: <b>{Math.round(m.kcal)}</b> kcal · P <b>{Math.round(m.prot)}</b> · C{" "}
                          <b>{Math.round(m.carb)}</b> · G <b>{Math.round(m.fat)}</b>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <SelectPlato
                      label="Comida"
                      value={r.comida_plato}
                      onChange={(v) => setRow(idx, { comida_plato: v })}
                      platos={options.by(r.tipo_dia, "comida").map((p) => p.plato)}
                    />
                    {(() => {
                      const m = dishMacrosForName(r.comida_plato);
                      if (!m) return null;
                      return (
                        <div className="small muted" style={{ marginTop: 6 }}>
                          Receta: <b>{Math.round(m.kcal)}</b> kcal · P <b>{Math.round(m.prot)}</b> · C{" "}
                          <b>{Math.round(m.carb)}</b> · G <b>{Math.round(m.fat)}</b>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <SelectPlato
                      label="Merienda"
                      value={r.merienda_plato}
                      onChange={(v) => setRow(idx, { merienda_plato: v })}
                      platos={options.by(r.tipo_dia, "merienda").map((p) => p.plato)}
                    />
                    {(() => {
                      const m = dishMacrosForName(r.merienda_plato);
                      if (!m) return null;
                      return (
                        <div className="small muted" style={{ marginTop: 6 }}>
                          Receta: <b>{Math.round(m.kcal)}</b> kcal · P <b>{Math.round(m.prot)}</b> · C{" "}
                          <b>{Math.round(m.carb)}</b> · G <b>{Math.round(m.fat)}</b>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <SelectPlato
                      label="Cena"
                      value={r.cena_plato}
                      onChange={(v) => setRow(idx, { cena_plato: v })}
                      platos={options.by(r.tipo_dia, "cena").map((p) => p.plato)}
                    />
                    {(() => {
                      const m = dishMacrosForName(r.cena_plato);
                      if (!m) return null;
                      return (
                        <div className="small muted" style={{ marginTop: 6 }}>
                          Receta: <b>{Math.round(m.kcal)}</b> kcal · P <b>{Math.round(m.prot)}</b> · C{" "}
                          <b>{Math.round(m.carb)}</b> · G <b>{Math.round(m.fat)}</b>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SelectPlato({
  label,
  value,
  onChange,
  platos,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  platos: string[];
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {platos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
