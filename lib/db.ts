import Dexie, { type Table } from "dexie";

export type DayLog = {
  id?: string; // local id
  user_id: string;
  day: string; // YYYY-MM-DD
  gym: boolean | null;
  diet_ok: boolean | null;
  water_l: number | null;
  steps: number | null;
  sleep_h: number | null;
  notes: string | null;
  updated_at: string; // iso
};

export type QueueItem = {
  id?: number;
  type: "upsert_day_log";
  payload: any;
  created_at: string;
};

class AppDB extends Dexie {
  day_logs!: Table<DayLog, string>;
  queue!: Table<QueueItem, number>;

  constructor() {
    super("rutina_app_db");
    this.version(1).stores({
      day_logs: "day, user_id",
      queue: "++id, type, created_at",
    });
  }
}

export const db = new AppDB();
