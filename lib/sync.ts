import { supabase } from "./supabaseClient";
import { db, type DayLog } from "./db";

export async function queueUpsertDayLog(log: DayLog) {
  await db.queue.add({ type: "upsert_day_log", payload: log, created_at: new Date().toISOString() });
}

export async function syncQueue() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, reason: "no-session" };

  const items = await db.queue.toArray();
  if (items.length === 0) return { ok: true, synced: 0 };

  let synced = 0;

  for (const item of items) {
    if (item.type === "upsert_day_log") {
      const payload = item.payload as DayLog;
      const { error } = await supabase
        .from("day_logs")
        .upsert({
          user_id: session.user.id,
          day: payload.day,
          gym: payload.gym,
          diet_ok: payload.diet_ok,
          water_l: payload.water_l,
          steps: payload.steps,
          sleep_h: payload.sleep_h,
          notes: payload.notes,
          updated_at: payload.updated_at,
        }, { onConflict: "user_id,day" });

      if (!error) {
        await db.queue.delete(item.id!);
        synced += 1;
      }
    }
  }

  return { ok: true, synced };
}
