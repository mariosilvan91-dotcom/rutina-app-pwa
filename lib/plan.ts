import { supabase } from "@/lib/supabaseClient";

export type DayType = "train" | "rest";
export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "other";

const DEFAULT_MEALS: { meal_type: MealType; title: string; order_idx: number }[] = [
  { meal_type: "breakfast", title: "Desayuno", order_idx: 1 },
  { meal_type: "lunch", title: "Comida", order_idx: 2 },
  { meal_type: "snack", title: "Merienda", order_idx: 3 },
  { meal_type: "dinner", title: "Cena", order_idx: 4 },
];

// crea plan_day y sus comidas si no existe
export async function ensurePlanDay(dayISO: string, dayType: DayType = "train") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No auth");

  // 1) plan_day
  const { data: pd } = await supabase
    .from("plan_days")
    .select("*")
    .eq("user_id", user.id)
    .eq("day", dayISO)
    .maybeSingle();

  let planDay = pd;

  if (!planDay) {
    const { data: inserted, error } = await supabase
      .from("plan_days")
      .insert({ user_id: user.id, day: dayISO, day_type: dayType })
      .select("*")
      .single();
    if (error) throw error;
    planDay = inserted;
  }

  // 2) comidas (si faltan)
  const { data: meals } = await supabase
    .from("plan_meals")
    .select("*")
    .eq("plan_day_id", planDay.id)
    .order("order_idx", { ascending: true });

  if (!meals || meals.length === 0) {
    const rows = DEFAULT_MEALS.map(m => ({ ...m, plan_day_id: planDay.id }));
    const { error } = await supabase.from("plan_meals").insert(rows);
    if (error) throw error;
  }

  return planDay;
}
