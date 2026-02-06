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

function r1(n: number) {
  return Math.round((Number(n) || 0) * 10) / 10;
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

  // Drawer detalle plato
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPlatoName, setDrawerPlatoName] = useState<string | null>(null);
  const [drawerPlatoId, setDrawerPlatoId] = useState<string | null>(null);
  const [drawerItems, setDrawerItems] = useState<PlatoItemMacro[]>([]);
  const [drawerError, setDrawerError] = useState<string>("");
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  // Cargar platos desde stg_platos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setStatus("");
      const { data, error } = await supabase.from("stg_platos").select("tipo_dia,comida,plato");

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
    const a = s.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    const b = e.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    return `${a} — ${b}`;
  }, [weekStartISO]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetalle(platoName: string | null) {
    // ✅ DEBUG visible
    alert("Ver detalle: " + (platoName ?? "VACÍO"));

    setDrawerOpen(true);
    setDrawerPlatoName(platoName ?? "Sin plato");
    setDrawerPlatoId(null);
    setDrawerItems([]);
    setDrawerError("");
    setDrawerLoading(true);

    if (!platoName) {
      setDrawerError("No has seleccionado ningún plato.");
      setDrawerLoading(false);
      return;
    }

    try {
      // 1) Buscar ID del plato por nombre (requiere stg_platos.id)
      const { data: pData, error: pErr } = await supabase
        .from("stg_platos")
        .select("id,plato")
        .eq("plato", platoName)
        .limit(1)
        .maybeSingle();

      if (pErr) throw pErr;

      const pid = (pData as any)?.id as string | undefined;

      if (!pid) {
        setDrawerError("No encuentro el ID del plato. Revisa que stg_platos tenga columna id (uuid).");
        setDrawerLoading(false);
        return;
      }

      setDrawerPlatoId(pid);

      // 2) Ingredientes + macros desde la vista
      const { data: items, error: iErr } = await supabase
        .from("v_plato_items_macros")
        .select("*")
        .eq("plato_id", pid)
        .order("order_idx", { ascending: true });

      if (iErr) throw iErr;

      setDrawerItems((items ?? []) as any);
    } catch (e: any) {
      setDrawerError(e?.message ?? "Error cargando detalle del plato");
    } finally {
      setDrawerLoading(false);
    }
  }

  const drawerTotals = useMemo(() => {
    let kcal = 0,
      p = 0,
      c = 0,
      f = 0;
    for (const x of drawerItems) {
      kcal += Number(x.kcal || 0);
      p += Number(x.prot_g || 0);
      c += Number(x.carbs_g || 0);
      f += Number(x.grasas_g || 0);
    }
    return { kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(f) };
  }, [drawerItems]);

  return (
    <div>
      <div className="card">
        <h1 className="h1">Plan semanal</h1>
        <p className="p">Edita tu semana completa y se verá en “Hoy” automáticamente.</p>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <button className="btn" onClick={() => shiftWeek(-1)}>
            ←
          </button>
          <span className="badge">
            <b>{title}</b>
          </span>
          <button className="btn" onClick={() => shiftWeek(1)}>
            →
          </button>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={() => setAnchor(new Date())}>
            Ir a hoy
          </button>
          <button className="btn" onClick={autogenerarSemana}>
            Autogenerar semana
          </button>
          <button className="btn primary" onClick={guardarSemana}>
            Guardar semana
          </button>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
                  <SelectPlato
                    label="Desayuno"
                    value={r.desayuno_plato}
                    onChange={(v) => setRow(idx, { desayuno_plato: v })}
                    onView={() => openDetalle(r.desayuno_plato)}
                    platos={options.by(r.tipo_dia, "desayuno").map((p) => p.plato)}
                  />
                  <SelectPlato
                    label="Comida"
                    value={r.comida_plato}
                    onChange={(v) => setRow(idx, { comida_plato: v })}
                    onView={() => openDetalle(r.comida_plato)}
                    platos={options.by(r.tipo_dia, "comida").map((p) => p.plato)}
                  />
                  <SelectPlato
                    label="Merienda"
                    value={r.merienda_plato}
                    onChange={(v) => setRow(idx, { merienda_plato: v })}
                    onView={() => openDetalle(r.merienda_plato)}
                    platos={options.by(r.tipo_dia, "merienda").map((p) => p.plato)}
                  />
                  <SelectPlato
                    label="Cena"
                    value={r.cena_plato}
                    onChange={(v) => setRow(idx, { cena_plato: v })}
                    onView={() => openDetalle(r.cena_plato)}
                    platos={options.by(r.tipo_dia, "cena").map((p) => p.plato)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DRAWER DETALLE PLATO */}
      {drawerOpen ? (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
            zIndex: 90,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 720, maxHeight: "80vh", overflow: "auto" }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>🍽️ {drawerPlatoName ?? "Detalle del plato"}</div>
              <button className="btn" onClick={() => setDrawerOpen(false)}>
                Cerrar
              </button>
            </div>

            {drawerLoading ? <div className="small" style={{ marginTop: 12 }}>Cargando…</div> : null}

            {drawerError ? (
              <div className="card" style={{ marginTop: 12, borderColor: "rgba(239,68,68,.55)" }}>
                <div style={{ fontWeight: 900, color: "#ef4444" }}>Error</div>
                <div className="small">{drawerError}</div>
              </div>
            ) : null}

            {!drawerLoading && !drawerError ? (
              <>
                <div className="card" style={{ marginTop: 12, background: "rgba(255,255,255,.03)" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Totales</div>
                  <div className="row">
                    <span className="badge">
                      Kcal <b>{drawerTotals.kcal}</b>
                    </span>
                    <span className="badge">
                      Prot <b>{drawerTotals.p}g</b>
                    </span>
                    <span className="badge">
                      Carbs <b>{drawerTotals.c}g</b>
                    </span>
                    <span className="badge">
                      Grasa <b>{drawerTotals.f}g</b>
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {drawerItems.map((x) => (
                    <div key={x.plato_item_id} className="card" style={{ background: "rgba(255,255,255,.03)" }}>
                      <div style={{ fontWeight: 900 }}>
                        {x.order_idx}. {x.alimento} <span className="small">({x.grams} g)</span>
                      </div>
                      <div className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>
                        Kcal <b>{x.kcal}</b> · Prot <b>{x.prot_g}g</b> · Carbs <b>{x.carbs_g}g</b> · Grasa{" "}
                        <b>{x.grasas_g}g</b>
                        {x.notes ? <div style={{ marginTop: 6 }}>Nota: {x.notes}</div> : null}
                      </div>
                    </div>
                  ))}
                  {!drawerItems.length ? (
                    <div className="small">Este plato aún no tiene ingredientes cargados en plato_items.</div>
                  ) : null}
                </div>

                <div className="small" style={{ marginTop: 12 }}>
                  Consejo: si ves “sin ingredientes”, hay que cargar `plato_items` (ingredientes + gramos) para ese plato.
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectPlato({
  label,
  value,
  onChange,
  onView,
  platos,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  onView: () => void;
  platos: string[];
}) {
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="label">{label}</div>

        {/* ✅ Visible siempre */}
        <button className="btn" type="button" onClick={onView} style={{ padding: "8px 10px", borderRadius: 12 }}>
          Ver detalle
        </button>
      </div>

      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {platos.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
        Seleccionado: <b>{value ?? "—"}</b>
      </div>
    </div>
  );
}

