"use client";

import { AuthGate } from "@/components/AuthGate";

export default function PlanDiaPage() {
  return (
    <AuthGate>
      <div className="grid">
        <div className="card" style={{gridColumn:"span 12"}}>
          <h1 className="h1">Plan día</h1>
          <p className="p">
            En esta primera versión hemos priorizado: Login + HOY (offline) + listas de alimentos/platos + ajustes.
            El “Plan día” con cálculo de gramos lo añadimos en el siguiente paso (ya con tus platos e ingredientes).
          </p>
        </div>
      </div>
    </AuthGate>
  );
}
