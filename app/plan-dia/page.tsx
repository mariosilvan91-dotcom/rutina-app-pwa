"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

// --- DEFINICIÓN DE TIPOS ---
type TipoDia = "entreno" | "descanso";
type ComidaKey = "desayuno" | "comida" | "merienda" | "cena";

type PlatoRow = {
  tipo_dia: TipoDia;
  comida: ComidaKey;
  plato: string;
};

type WeekDayPlan = {
  day: string;
  tipo_dia: TipoDia;
  desayuno_plato: string | null;
  comida_plato: string | null;
  merienda_plato: string | null;
  cena_plato: string | null;
};

// ✅ Tipado alineado con v_plato_items_macros (vista actual)
type PlatoItemMacro = {
  plato_id: string;
  plato_nombre: string;
  tipo_item: string;
  ingrediente_raw: string;
  alimento_nombre: string;
  g: number | null;
  kcal: number | null;
  proteinas_g: number | null;
  carbs_g: number | null;
  grasas_g: number | null;
};

const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"];

// --- FUNCIONES AUXILIARES ---
function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pickOne<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function r1(n: number | string | null | undefined): number {
  const x = Number(n || 0);
  return Math.round(x * 10) / 10;
}

// --- COMPONENTE PRINCIPAL ---
export default function PlanDiaPage() {
  return (
    <AuthGate>
      <PlanSemanalInner />
    </AuthGate>
  );
}

function PlanSemanalInner() {
  const [userId, setUserId] = useState<string>("");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");

  const weekStart = useMemo(() => startOfWeekMonday(anchor), [anchor]);
  const weekStartISO = useMemo(() => ymd(weekStart), [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const [platos, setPlatos] = useState<PlatoRow[]>([]);
  const [rows, setRows] = useState<WeekDayPlan[]>([]);

  // Estado del detalle de comidas
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [detailError, setDetailError] = useState<Record<string, string>>({});
  const [detailItems, setDetailItems] = useState<Record<string, PlatoItemMacro[]>>({});

  function dk(day: string, meal: ComidaKey) {
    return `${day}__${meal}`;
  }

  // Obtener Usuario
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // Cargar Catálogo de Platos
  useEffect(() => {
    async function loadPlatos() {
      const { data, error } = await supabase
        .from("stg_platos")
        .select("tipo_dia, comida, plato");

      if (error) {
        setStatus("Error platos: " + error.message);
        return;
      }
      if (data) setPlatos(data as PlatoRow[]);
    }
    loadPlatos();
  }, []);

  // Cargar Plan de la Semana
  useEffect(() => {
    if (!userId) return;

    async function loadWeekPlan() {
      setLoading(true);
      const from = ymd(weekStart);
      const toDate = new Date(weekStart);
      toDate.setDate(toDate.getDate() + 6);
      const to = ymd(toDate);

      const { data, error } = await supabase
        .from("week_plan_days")
        .select("day, tipo_dia, desayuno_plato, comida_plato, merienda_plato, cena_plato")
        .eq("user_id", userId)
        .gte("day", from)
        .lte("day", to)
        .order("day", { ascending: true });

      if (error) {
        setStatus("Error plan: " + error.message);
        setLoading(false);
        return;
      }

      const m = new Map<string, any>();
      (data ?? []).forEach((r) => m.set(String(r.day), r));

      const merged: WeekDayPlan[] = weekDays.map((d) => {
        const iso = ymd(d);
        const r = m.get(iso);
        return {
          day: iso,
          tipo_dia: (r?.tipo_dia as TipoDia) ?? "entreno",
          desayuno_plato: r?.desayuno_plato ?? null,
          comida_plato: r?.comida_plato ?? null,
          merienda_plato: r?.merienda_plato ?? null,
          cena_plato: r?.cena_plato ?? null,
        };
      });

      setRows(merged);
      setLoading(false);
    }
    loadWeekPlan();
  }, [userId, weekStartISO, weekDays]);

  function by(tipo: TipoDia, comida: ComidaKey) {
    return platos.filter((p) => p.tipo_dia === tipo && p.comida === comida);
  }

  function setRow(idx: number, patch: Partial<WeekDayPlan>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function autogenerarSemana() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        desayuno_plato: pickOne(by(r.tipo_dia, "desayuno"))?.plato ?? r.desayuno_plato,
        comida_plato: pickOne(by(r.tipo_dia, "comida"))?.plato ?? r.comida_plato,
        merienda_plato: pickOne(by(r.tipo_dia, "merienda"))?.plato ?? r.merienda_plato,
        cena_plato: pickOne(by(r.tipo_dia, "cena"))?.plato ?? r.cena_plato,
      }))
    );
    setStatus("Semana autogenerada ✅");
  }

  async function guardarSemana() {
    if (!userId) return;
    setLoading(true);
    const payload = rows.map((r) => ({
      user_id: userId,
      day: r.day,
      week_start: weekStartISO,
      tipo_dia: r.tipo_dia,
      desayuno_plato: r.desayuno_plato,
      comida_plato: r.comida_plato,
      merienda_plato: r.merienda_plato,
      cena_plato: r.cena_plato,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("week_plan_days").upsert(payload, { onConflict: "user_id,day" });
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
    return `${s.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — ${e.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`;
  }, [weekStart]);

  // ✅ ahora pasamos también tipoDia para poder filtrar el plato correctamente
  async function toggleDetalle(day: string, meal: ComidaKey, tipoDia: TipoDia, platoName: string | null) {
    const key = dk(day, meal);
    const currentlyOpen = !!openDetail[key];
    setOpenDetail((prev) => ({ ...prev, [key]: !currentlyOpen }));

    if (currentlyOpen || detailItems[key]?.length || !platoName) return;

    setDetailLoading((prev) => ({ ...prev, [key]: true }));
    setDetailError((prev) => ({ ...prev, [key]: "" }));

    try {
      // ✅ importante: si hay platos repetidos por nombre, filtramos también por tipo_dia y comida
      const { data: pData, error: pErr } = await supabase
        .from("stg_platos")
        .select("id")
        .eq("plato", platoName)
        .eq("tipo_dia", tipoDia)
        .eq("comida", meal)
        .maybeSingle();

      if (pErr) throw pErr;
      if (!pData?.id) throw new Error("Plato no encontrado");

      const { data: items, error: itemsErr } = await supabase
        .from("v_plato_items_macros")
        .select("*")
        .eq("plato_id", pData.id);

      if (itemsErr) throw itemsErr;

      setDetailItems((prev) => ({ ...prev, [key]: (items as PlatoItemMacro[]) ?? [] }));
    } catch (e: any) {
      setDetailError((prev) => ({ ...prev, [key]: e.message ?? String(e) }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan semanal</h1>
        <div className="row" style={{ justifyContent: "space-between", margin: "15px 0" }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>←</button>
          <span className="badge"><b>{title}</b></span>
          <button className="btn" onClick={() => shiftWeek(1)}>→</button>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setAnchor(new Date())}>Hoy</button>
          <button className="btn" onClick={autogenerarSemana}>Autogenerar</button>
          <button className="btn primary" onClick={guardarSemana} disabled={loading}>Guardar</button>
        </div>
        {status && <div className="small" style={{ marginTop: 10 }}>{status}</div>}
      </div>

      <div style={{ display: "grid", gap: 15, marginTop: 15 }}>
        {rows.map((r, idx) => (
          <div key={r.day} className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 900 }}>{DOW_ES[idx]} {new Date(r.day).getDate()}</div>
              <div className="row" style={{ gap: 5 }}>
                <button
                  className={`btn small ${r.tipo_dia === "entreno" ? "primary" : ""}`}
                  onClick={() => setRow(idx, { tipo_dia: "entreno" })}
                >E</button>
                <button
                  className={`btn small ${r.tipo_dia === "descanso" ? "primary" : ""}`}
                  onClick={() => setRow(idx, { tipo_dia: "descanso" })}
                >D</button>
              </div>
            </div>

            {(["desayuno", "comida", "merienda", "cena"] as ComidaKey[]).map((m) => (
              <MealBlock
                key={m}
                label={m}
                value={r[`${m}_plato` as keyof WeekDayPlan] as string | null}
                platos={by(r.tipo_dia, m).map((p) => p.plato)}
                onChange={(v: string | null) => setRow(idx, { [`${m}_plato`]: v } as any)}
                isOpen={!!openDetail[dk(r.day, m)]}
                isLoading={!!detailLoading[dk(r.day, m)]}
                items={detailItems[dk(r.day, m)] || []}
                error={detailError[dk(r.day, m)]}
                onToggle={() => toggleDetalle(r.day, m, r.tipo_dia, r[`${m}_plato` as keyof WeekDayPlan] as string | null)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MealBlock({
  label,
  value,
  platos,
  onChange,
  isOpen,
  isLoading,
  items,
  error,
  onToggle,
}: {
  label: string;
  value: string | null;
  platos: string[];
  onChange: (v: string | null) => void;
  isOpen: boolean;
  isLoading: boolean;
  items: PlatoItemMacro[];
  error?: string;
  onToggle: () => void;
}) {
  const totals = useMemo(() => {
    return items.reduce(
      (acc, curr) => ({
        kcal: acc.kcal + (curr.kcal || 0),
        p: acc.p + (curr.proteinas_g || 0),
        c: acc.c + (curr.carbs_g || 0),
        f: acc.f + (curr.grasas_g || 0),
      }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
  }, [items]);

  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="small" style={{ textTransform: "capitalize", fontWeight: "bold" }}>{label}</span>
        <button className="btn small" onClick={onToggle} style={{ fontSize: 10 }}>
          {isOpen ? "Ocultar" : "Detalle"}
        </button>
      </div>

      <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Seleccionar —</option>
        {platos.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {isOpen && (
        <div className="card" style={{ background: "rgba(255,255,255,0.05)", marginTop: 5, padding: 8 }}>
          {isLoading ? (
            <div className="small">Cargando...</div>
          ) : error ? (
            <div className="small color-danger">{error}</div>
          ) : !items.length ? (
            <div className="small">Este plato no tiene ingredientes (o no casan con stg_foods).</div>
          ) : (
            <>
              <div className="row" style={{ gap: 5, marginBottom: 8 }}>
                <span className="badge">K: {r1(totals.kcal)}</span>
                <span className="badge">P: {r1(totals.p)}</span>
                <span className="badge">C: {r1(totals.c)}</span>
                <span className="badge">G: {r1(totals.f)}</span>
              </div>

              {items.map((it, idx) => (
                <div
                  key={`${it.plato_id}__${it.tipo_item}__${idx}`}
                  className="small"
                  style={{ borderBottom: "1px solid #333", padding: "6px 0" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{it.alimento_nombre}</div>
                    <div className="badge">{it.g ?? "—"}g</div>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <span className="badge">K: {r1(it.kcal)}</span>
                    <span className="badge">P: {r1(it.proteinas_g)}</span>
                    <span className="badge">C: {r1(it.carbs_g)}</span>
                    <span className="badge">G: {r1(it.grasas_g)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
