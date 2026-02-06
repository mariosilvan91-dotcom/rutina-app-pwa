"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";

type PlatoRow = {
  id?: string;
  tipo_dia: "entreno" | "descanso";
  comida: "desayuno" | "comida" | "merienda" | "cena";
  opcion: number | null;
  plato: string;
  proteina?: string | null;
  carbohidrato2?: string | null;
  grasa?: string | null;
  extra?: string | null;
  extra2?: string | null;
  clave?: string | null;
};

type DayPlan = {
  day: string;
  tipo_dia: "entreno" | "descanso";
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

function pickN<T>(arr: T[], n: number) {
  const copy = [...arr];
  // shuffle simple
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function PlanDiaPage() {
  return (
    <AuthGate>
      <PlanDiaInner />
    </AuthGate>
  );
}

function PlanDiaInner() {
  const [userId, setUserId] = useState<string>("");
  const [day, setDay] = useState<string>(todayISO());
  const [tipoDia, setTipoDia] = useState<"entreno" | "descanso">("entreno");
  const [allPlatos, setAllPlatos] = useState<PlatoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Selecciones actuales (editable)
  const [sel, setSel] = useState<DayPlan>({
    day,
    tipo_dia: "entreno",
    desayuno_plato: null,
    comida_plato: null,
    merienda_plato: null,
    cena_plato: null,
  });

  // Obtener user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // Cargar platos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("");
      const { data, error } = await supabase
        .from("stg_platos")
        .select("tipo_dia,comida,opcion,plato,proteina,carbohidrato2,grasa,extra,extra2,clave");

      if (error) setStatus(error.message);
      setAllPlatos((data ?? []) as PlatoRow[]);
      setLoading(false);
    })();
  }, []);

  // Cargar plan guardado del día (si existe)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("day_plan")
        .select("day,tipo_dia,desayuno_plato,comida_plato,merienda_plato,cena_plato")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();

      if (!error && data) {
        setTipoDia((data.tipo_dia as any) ?? "entreno");
        setSel({
          day: String(data.day),
          tipo_dia: (data.tipo_dia as any) ?? "entreno",
          desayuno_plato: data.desayuno_plato ?? null,
          comida_plato: data.comida_plato ?? null,
          merienda_plato: data.merienda_plato ?? null,
          cena_plato: data.cena_plato ?? null,
        });
      } else {
        // reset al cambiar de día
        setSel((prev) => ({ ...prev, day, tipo_dia: tipoDia }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, day]);

  // Listas por comida según tipo_dia
  const opts = useMemo(() => {
    const base = allPlatos.filter((p) => p.tipo_dia === tipoDia);
    const by = (comida: PlatoRow["comida"]) => base.filter((p) => p.comida === comida);

    return {
      desayuno: by("desayuno"),
      comida: by("comida"),
      merienda: by("merienda"),
      cena: by("cena"),
    };
  }, [allPlatos, tipoDia]);

  // Generar automáticamente 5 opciones por comida y escoger 1 por defecto
  const autoOptions = useMemo(() => {
    return {
      desayuno: pickN(opts.desayuno, 5),
      comida: pickN(opts.comida, 5),
      merienda: pickN(opts.merienda, 5),
      cena: pickN(opts.cena, 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDia, allPlatos.length]);

  // Cuando cambie tipoDia o día, si no hay selección, poner la primera opción
  useEffect(() => {
    setSel((prev) => {
      const next = { ...prev, day, tipo_dia: tipoDia };
      if (!next.desayuno_plato && autoOptions.desayuno[0]) next.desayuno_plato = autoOptions.desayuno[0].plato;
      if (!next.comida_plato && autoOptions.comida[0]) next.comida_plato = autoOptions.comida[0].plato;
      if (!next.merienda_plato && autoOptions.merienda[0]) next.merienda_plato = autoOptions.merienda[0].plato;
      if (!next.cena_plato && autoOptions.cena[0]) next.cena_plato = autoOptions.cena[0].plato;
      return next;
    });
  }, [autoOptions, day, tipoDia]);

  async function savePlan() {
    if (!userId) return;
    setStatus("");

    const payload = {
      user_id: userId,
      day: sel.day,
      tipo_dia: sel.tipo_dia,
      desayuno_plato: sel.desayuno_plato,
      comida_plato: sel.comida_plato,
      merienda_plato: sel.merienda_plato,
      cena_plato: sel.cena_plato,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("day_plan")
      .upsert(payload, { onConflict: "user_id,day" });

    setStatus(error ? error.message : "Plan guardado ✅");
  }

  function box(comidaLabel: string, key: "desayuno_plato" | "comida_plato" | "merienda_plato" | "cena_plato", list: PlatoRow[]) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>{comidaLabel}</div>

        <div className="label">Plato elegido</div>
        <select
          className="input"
          value={sel[key] ?? ""}
          onChange={(e) => setSel((p) => ({ ...p, [key]: e.target.value || null }))}
        >
          <option value="">—</option>
          {list.map((p, i) => (
            <option key={`${p.plato}-${i}`} value={p.plato}>
              {p.plato}
            </option>
          ))}
        </select>

        <div className="small" style={{ marginTop: 10 }}>
          (Te mostramos 5 opciones aleatorias. Si quieres, luego añadimos “filtro por macros” y cálculo de gramos.)
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan día</h1>
        <p className="p">Genera un plan según entreno/descanso y te deja modificarlo.</p>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span className="badge">
            Día:&nbsp;<b>{day}</b>
          </span>

          <div className="row" style={{ gap: 10 }}>
            <button className={`btn ${tipoDia === "entreno" ? "primary" : ""}`} onClick={() => setTipoDia("entreno")}>
              Entreno
            </button>
            <button className={`btn ${tipoDia === "descanso" ? "primary" : ""}`} onClick={() => setTipoDia("descanso")}>
              Descanso
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={() => setDay(todayISO())}>Ir a hoy</button>
          <button className="btn primary" onClick={savePlan}>Guardar plan</button>
          {status ? <span className="small" style={{ alignSelf: "center" }}>{status}</span> : null}
        </div>

        {loading ? <div className="small" style={{ marginTop: 10 }}>Cargando platos…</div> : null}
      </div>

      {box("Desayuno", "desayuno_plato", autoOptions.desayuno)}
      {box("Comida", "comida_plato", autoOptions.comida)}
      {box("Merienda", "merienda_plato", autoOptions.merienda)}
      {box("Cena", "cena_plato", autoOptions.cena)}
    </div>
  );
}
