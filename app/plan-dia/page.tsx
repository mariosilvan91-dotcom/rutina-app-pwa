"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type Plato = {
  tipo_dia: "entreno" | "descanso";
  comida: "desayuno" | "comida" | "merienda" | "cena";
  plato: string;
};

type WeekDayPlan = {
  day: string; // YYYY-MM-DD
  tipo_dia: "entreno" | "descanso";
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

type PlatoItemMacro = {
  plato_item_id: string;
  plato_id: string;
  order_idx: number;
  grams: number;
  notes: string | null;
  alimento_id: string;
  alimento: string;
  tipo: string | null;
  kcal: number;
  prot_g: number;
  carbs_g: number;
  grasas_g: number;
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

function r1(n: any) {
  const x = Number(n || 0);
  return Math.round(x * 10) / 10;
}

type MealKey = "desayuno" | "comida" | "merienda" | "cena";

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

  // Estado del “desplegable detalle” por día+comida
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [detailError, setDetailError] = useState<Record<string, string>>({});
  const [detailItems, setDetailItems] = useState<Record<string, PlatoItemMacro[]>>({});

  function detailKey(day: string, meal: MealKey) {
    return `${day}__${meal}`;
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // Cargar platos desde stg_platos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("");
      const { data, error } = await supabase
        .from("stg_platos")
        .select("tipo_dia,comida,plato");

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
      const to = ymd(
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
      );

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

  async function toggleDetalle(day: string, meal: MealKey, platoName: string | null) {
    const k = detailKey(day, meal);

    // toggle UI
    setOpenDetail((prev) => ({ ...prev, [k]: !prev[k] }));

    // si lo estamos cerrando, no hace falta cargar
    if (openDetail[k]) return;

    // si ya tenemos data, no recargamos
    if (detailItems[k]?.length) return;

    // si no hay plato, mostramos error friendly
    if (!platoName) {
      setDetailError((prev) => ({ ...prev, [k]: "No hay plato seleccionado." }));
      setDetailItems((prev) => ({ ...prev, [k]: [] }));
      return;
    }

    setDetailLoading((prev) => ({ ...prev, [k]: true }));
    setDetailError((prev) => ({ ...prev, [k]: "" }));

    try {
      // 1) buscar el id del plato por nombre (stg_platos debe tener id)
      const { data: pData, error: pErr } = await supabase
        .from("stg_platos")
        .select("id,plato")
        .eq("plato", platoName)
        .limit(1)
        .maybeSingle();

      if (pErr) throw pErr;

      const pid = (pData as any)?.id as string | undefined;
      if (!pid) {
        throw new Error("No encuentro el ID del plato. Revisa que stg_platos tenga columna id (uuid).");
      }

      // 2) ingredientes + macros desde la vista
      const { data: items, error: iErr } = await supabase
        .from("v_plato_items_macros")
        .select("*")
        .eq("plato_id", pid)
        .order("order_idx", { ascending: true });

      if (iErr) throw iErr;

      setDetailItems((prev) => ({ ...prev, [k]: (items ?? []) as any }));
    } catch (e: any) {
      setDetailError((prev) => ({ ...prev, [k]: e?.message ?? "Error cargando detalle" }));
      setDetailItems((prev) => ({ ...prev, [k]: [] }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [k]: false }));
    }
  }

  function totals(items: PlatoItemMacro[]) {
    let kcal = 0,
      p = 0,
      c = 0,
      f = 0;
    for (const x of items) {
      kcal += Number(x.kcal || 0);
      p += Number(x.prot_g || 0);
      c += Number(x.carbs_g || 0);
      f += Number(x.grasas_g || 0);
    }
    return { kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(f) };
  }

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan semanal</h1>
        <p className="p">Edita tu semana completa. Cada comida tiene botón “Detalle” con ingredientes y macros.</p>

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

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Editar días</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {rows.map((r, idx) => {
            const d = weekDays[idx];
            const label = `${DOW_ES[idx]} ${d.getDate()}`;

            return (
              <div key={r.day} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <span className="badge">{r.day}</span>
                </div>

                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <button className={`btn ${r.tipo_dia === "entreno" ? "primary" : ""}`} onClick={() => setRow(idx, { tipo_dia: "entreno" })}>
                    Entreno
                  </button>
                  <button className={`btn ${r.tipo_dia === "descanso" ? "primary" : ""}`} onClick={() => setRow(idx, { tipo_dia: "descanso" })}>
                    Descanso
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 12 }}>
                  <MealSelect
                    day={r.day}
                    meal="desayuno"
                    label="Desayuno"
                    tipoDia={r.tipo_dia}
                    value={r.desayuno_plato}
                    onChange={(v) => setRow(idx, { desayuno_plato: v })}
                    platos={options.by(r.tipo_dia, "desayuno").map((p) => p.plato)}
                    openDetail={openDetail}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    detailItems={detailItems}
                    onToggleDetalle={toggleDetalle}
                    totalsFn={totals}
                  />

                  <MealSelect
                    day={r.day}
                    meal="comida"
                    label="Comida"
                    tipoDia={r.tipo_dia}
                    value={r.comida_plato}
                    onChange={(v) => setRow(idx, { comida_plato: v })}
                    platos={options.by(r.tipo_dia, "comida").map((p) => p.plato)}
                    openDetail={openDetail}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    detailItems={detailItems}
                    onToggleDetalle={toggleDetalle}
                    totalsFn={totals}
                  />

                  <MealSelect
                    day={r.day}
                    meal="merienda"
                    label="Merienda"
                    tipoDia={r.tipo_dia}
                    value={r.merienda_plato}
                    onChange={(v) => setRow(idx, { merienda_plato: v })}
                    platos={options.by(r.tipo_dia, "merienda").map((p) => p.plato)}
                    openDetail={openDetail}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    detailItems={detailItems}
                    onToggleDetalle={toggleDetalle}
                    totalsFn={totals}
                  />

                  <MealSelect
                    day={r.day}
                    meal="cena"
                    label="Cena"
                    tipoDia={r.tipo_dia}
                    value={r.cena_plato}
                    onChange={(v) => setRow(idx, { cena_plato: v })}
                    platos={options.by(r.tipo_dia, "cena").map((p) => p.plato)}
                    openDetail={openDetail}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    detailItems={detailItems}
                    onToggleDetalle={toggleDetalle}
                    totalsFn={totals}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MealSelect(props: {
  day: string;
  meal: MealKey;
  label: string;
  tipoDia: "entreno" | "descanso";
  value: string | null;
  onChange: (v: string | null) => void;
  platos: string[];

  openDetail: Record<string, boolean>;
  detailLoading: Record<string, boolean>;
  detailError: Record<string, string>;
  detailItems: Record<string, PlatoItemMacro[]>;
  onToggleDetalle: (day: string, meal: MealKey, platoName: string | null) => void;
  totalsFn: (items: PlatoItemMacro[]) => { kcal: number; p: number; c: number; f: number };
}) {
  const k = `${props.day}__${props.meal}`;
  const isOpen = !!props.openDetail[k];
  const isLoading = !!props.detailLoading[k];
  const err = props.detailError[k] || "";
  const items = props.detailItems[k] || [];
  const t = props.totalsFn(items);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="label" style={{ marginBottom: 0 }}>{props.label}</div>
        <button
          className="btn"
          type="button"
          onClick={() => props.onToggleDetalle(props.day, props.meal, props.value)}
          style={{ padding: "8px 10px", borderRadius: 12 }}
        >
          {isOpen ? "Ocultar" : "Detalle"}
        </button>
      </div>

      <select className="input" value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value || null)}>
        <option value="">—</option>
        {props.platos.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* PANEL DESPLEGABLE */}
      {isOpen ? (
        <div className="card" style={{ marginTop: 10, background: "rgba(255,255,255,.03)" }}>
          {isLoading ? <div className="small">Cargando detalle…</div> : null}

          {!isLoading && err ? (
            <div className="small" style={{ color: "var(--danger)" }}>
              {err}
            </div>
          ) : null}

          {!isLoading && !err ? (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="badge">Kcal <b>{t.kcal}</b></span>
                <span className="badge">Prot <b>{t.p}g</b></span>
                <span className="badge">Carbs <b>{t.c}g</b></span>
                <span className="badge">Grasa <b>{t.f}g</b></span>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {items.map((x) => (
                  <div key={x.plato_item_id} className="card" style={{ padding: 10, background: "rgba(255,255,255,.02)" }}>
                    <div style={{ fontWeight: 800 }}>
                      {x.order_idx}. {x.alimento} <span className="small">({x.grams} g)</span>
                    </div>
                    <div className="small" style={{ marginTop: 4, lineHeight: 1.45 }}>
                      Kcal <b>{x.kcal}</b> · Prot <b>{x.prot_g}g</b> · Carbs <b>{x.carbs_g}g</b> · Grasa <b>{x.grasas_g}g</b>
                      {x.notes ? <div style={{ marginTop: 6 }}>Nota: {x.notes}</div> : null}
                    </div>
                  </div>
                ))}

                {!items.length ? (
                  <div className="small">
                    Este plato no tiene ingredientes aún en <b>plato_items</b>.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
