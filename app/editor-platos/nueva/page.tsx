"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";

type TipoDia = "entreno" | "descanso";
type Comida = "desayuno" | "comida" | "merienda" | "cena";

type FoodOption = {
  id: string;
  name: string;
  default_portion_g: number | null;
};

function clean(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function NuevaRecetaPage() {
  return (
    <AuthGate>
      <NuevaRecetaInner />
    </AuthGate>
  );
}

function NuevaRecetaInner() {
  const [plato, setPlato] = useState("");

  // Si tu tabla stg_platos NO tiene estas columnas, dímelo y las quito.
  const [tipoDia, setTipoDia] = useState<TipoDia>("entreno");
  const [comida, setComida] = useState<Comida>("comida");

  const [i1, setI1] = useState("");
  const [i2, setI2] = useState("");
  const [i3, setI3] = useState("");
  const [i4, setI4] = useState("");
  const [i5, setI5] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function guardar() {
    setMsg("");
    const platoClean = clean(plato);
    if (!platoClean) {
      setMsg("El nombre del plato es obligatorio.");
      return;
    }

    setLoading(true);

    const payload: any = {
      plato: platoClean,
      tipo_dia: tipoDia,
      comida,
      ingrediente_1: clean(i1) || null,
      ingrediente_2: clean(i2) || null,
      ingrediente_3: clean(i3) || null,
      ingrediente_4: clean(i4) || null,
      ingrediente_5: clean(i5) || null,
    };

    const { error } = await supabase.from("stg_platos").insert(payload);

    setLoading(false);

    if (error) {
      setMsg("Error guardando receta: " + error.message);
      return;
    }

    setMsg("Receta guardada ✅");
    setPlato("");
    setI1("");
    setI2("");
    setI3("");
    setI4("");
    setI5("");
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h1 className="h1" style={{ margin: 0 }}>Nueva receta</h1>
          <Link className="btn" href="/recetas">← Volver</Link>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div>
            <label className="small">Nombre del plato *</label>
            <input
              className="input"
              value={plato}
              onChange={(e) => setPlato(e.target.value)}
              placeholder="Ej: Pollo con arroz y verduras"
            />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Tipo día</label>
              <select className="input" value={tipoDia} onChange={(e) => setTipoDia(e.target.value as TipoDia)}>
                <option value="entreno">entreno</option>
                <option value="descanso">descanso</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Comida</label>
              <select className="input" value={comida} onChange={(e) => setComida(e.target.value as Comida)}>
                <option value="desayuno">desayuno</option>
                <option value="comida">comida</option>
                <option value="merienda">merienda</option>
                <option value="cena">cena</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h3">Ingredientes (autocompletar)</div>

            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <FoodAutocomplete label="Ingrediente 1" value={i1} onChange={setI1} />
              <FoodAutocomplete label="Ingrediente 2" value={i2} onChange={setI2} />
              <FoodAutocomplete label="Ingrediente 3" value={i3} onChange={setI3} />
              <FoodAutocomplete label="Ingrediente 4" value={i4} onChange={setI4} />
              <FoodAutocomplete label="Ingrediente 5" value={i5} onChange={setI5} />
            </div>

            <div className="small muted" style={{ marginTop: 8 }}>
              Escribe y selecciona de la lista para que coincida con <b>foods_base.name</b>.
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn primary" onClick={guardar} disabled={loading}>
              {loading ? "Guardando..." : "Guardar receta"}
            </button>

            <button
              className="btn"
              onClick={() => {
                setPlato("");
                setI1(""); setI2(""); setI3(""); setI4(""); setI5("");
                setMsg("");
              }}
              disabled={loading}
            >
              Limpiar
            </button>
          </div>

          {msg && <div className="small" style={{ marginTop: 6 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}

function FoodAutocomplete({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<FoodOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const debounced = useDebouncedValue(value, 220);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // cerrar si click fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = clean(debounced);
    if (!q) {
      setOpts([]);
      setErr("");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr("");

      // Filtrado rápido por foods_base
      const { data, error } = await supabase
        .from("foods_base")
        .select("id, name, default_portion_g")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(8);

      if (error) {
        setErr(error.message);
        setOpts([]);
      } else {
        setOpts((data as any[]) as FoodOption[]);
      }

      setLoading(false);
    })();
  }, [debounced]);

  const hint = useMemo(() => {
    if (!clean(value)) return "";
    const exact = opts.find((o) => o.name === clean(value));
    if (exact?.default_portion_g != null) return `Ración: ${exact.default_portion_g} g`;
    return "";
  }, [opts, value]);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label className="small">{label}</label>

      <input
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && open && opts.length > 0) {
            e.preventDefault();
            onChange(opts[0].name);
            setOpen(false);
          }
        }}
        placeholder="Empieza a escribir… (ej: Arroz)"
        autoComplete="off"
      />

      <div className="small muted" style={{ marginTop: 4, minHeight: 16 }}>
        {err ? <span className="color-danger">{err}</span> : loading ? "Buscando…" : hint}
      </div>

      {open && (opts.length > 0) && (
        <div
          className="card"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 6,
            padding: 8,
            zIndex: 30,
            background: "#0b1220",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {opts.map((o) => (
            <button
              key={o.id}
              className="btn"
              style={{
                width: "100%",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
              onClick={() => {
                onChange(o.name);
                setOpen(false);
              }}
              type="button"
            >
              <span style={{ textAlign: "left" }}>{o.name}</span>
              <span className="small muted">
                {o.default_portion_g != null ? `${o.default_portion_g} g` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
