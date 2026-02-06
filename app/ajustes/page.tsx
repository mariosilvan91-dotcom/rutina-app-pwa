<div className="card">
  <div className="grid-form">

    <div>
      <div className="label">Kcal entreno</div>
      <input
        className="input"
        type="number"
        value={s.kcal_entreno}
        onChange={e => setS({ ...s, kcal_entreno: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">Kcal descanso</div>
      <input
        className="input"
        type="number"
        value={s.kcal_descanso}
        onChange={e => setS({ ...s, kcal_descanso: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">% Prot</div>
      <input
        className="input"
        type="number"
        step="0.01"
        value={s.p_prot}
        onChange={e => setS({ ...s, p_prot: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">% Carb</div>
      <input
        className="input"
        type="number"
        step="0.01"
        value={s.p_carb}
        onChange={e => setS({ ...s, p_carb: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">% Grasa</div>
      <input
        className="input"
        type="number"
        step="0.01"
        value={s.p_grasa}
        onChange={e => setS({ ...s, p_grasa: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">Agua (L)</div>
      <input
        className="input"
        type="number"
        step="0.1"
        value={s.agua_obj_l}
        onChange={e => setS({ ...s, agua_obj_l: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">Pasos</div>
      <input
        className="input"
        type="number"
        value={s.pasos_obj}
        onChange={e => setS({ ...s, pasos_obj: Number(e.target.value) })}
      />
    </div>

    <div>
      <div className="label">Sueño (h)</div>
      <input
        className="input"
        type="number"
        step="0.1"
        value={s.sueno_obj_h}
        onChange={e => setS({ ...s, sueno_obj_h: Number(e.target.value) })}
      />
    </div>

    <div className="row full">
      <button className="btn primary" onClick={save}>Guardar</button>
      {msg && <span className="small">{msg}</span>}
    </div>

  </div>
</div>
