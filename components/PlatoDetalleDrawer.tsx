"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = {
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

function r1(n: number) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

export function PlatoDetalleDrawer({
  platoId,
  platoNombre,
  open,
  onClose,
}: {
  platoId: string | null;
  platoNombre?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !platoId) return;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error } = await supabase
          .from("v_plato_items_macros")
          .select("*")
          .eq("plato_id", platoId)
          .order("order_idx", { ascending: true });

        if (error) throw error;
        setRows((data ?? []) as any);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando detalle del plato");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, platoId]);

  const totals = useMemo(() => {
    let kcal = 0, p = 0, c = 0, f = 0;
    for (const x of rows) {
      kcal += Number(x.kcal || 0);
      p += Number(x.prot_g || 0);
      c += Number(x.carbs_g || 0);
      f += Number(x.grasas_g || 0);
    }
    return { kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(f) };
  }, [rows]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: 12,
        zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            🍽️ {platoNombre || "Detalle del plato"}
          </div>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>

        {loading ? <div className="small" style={{ marginTop: 12 }}>Cargando…</div> : null}

        {error ? (
          <div className="card" style={{ marginTop: 12, borderColor: "rgba(239,68,68,.55)" }}>
            <div style={{ fontWeight: 900, color: "#ef4444" }}>Error</div>
            <div className="small">{error}</div>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="card" style={{ marginTop: 12, background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Totales</div>
              <div className="row">
                <span className="badge">Kcal <b>{totals.kcal}</b></span>
                <span className="badge">Prot <b>{totals.p}g</b></span>
                <span className="badge">Carbs <b>{totals.c}g</b></span>
                <span className="badge">Grasa <b>{totals.f}g</b></span>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {rows.map((x) => (
                <div key={x.plato_item_id} className="card" style={{ background: "rgba(255,255,255,.03)" }}>
                  <div style={{ fontWeight: 900 }}>
                    {x.order_idx}. {x.alimento}{" "}
                    <span className="small">({x.grams} g)</span>
                  </div>
                  <div className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    Kcal <b>{x.kcal}</b> · Prot <b>{x.prot_g}g</b> · Carbs <b>{x.carbs_g}g</b> · Grasa <b>{x.grasas_g}g</b>
                    {x.notes ? <div style={{ marginTop: 6 }}>Nota: {x.notes}</div> : null}
                  </div>
                </div>
              ))}
              {!rows.length ? <div className="small">Este plato aún no tiene ingredientes cargados.</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
