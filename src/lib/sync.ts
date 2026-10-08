import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { db, type LogEntry, type LogType } from "@/lib/db";

type Row = {
  id: string;
  baby_id: string;
  type: string;
  value: string;
  notes: string | null;
  ts: number;
};

const PULL_WINDOW_MS = 30 * 24 * 3600_000;

async function upsertLocal(row: Row) {
  const existing = await db.logs.where("uid").equals(row.id).first();
  const next: LogEntry = {
    uid: row.id,
    baby_id: row.baby_id,
    type: row.type as LogType,
    value: row.value,
    notes: row.notes ?? undefined,
    timestamp: Number(row.ts),
    sync_status: "synced",
  };
  if (existing?.id != null) await db.logs.update(existing.id, next);
  else await db.logs.add(next);
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(babyId: string): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce(babyId);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(babyId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  // Drop cached logs that belong to a different baby profile.
  await db.logs.filter((l) => !!l.baby_id && l.baby_id !== babyId).delete();

  // Push deletions.
  const dels = await db.deletions.toArray();
  for (const d of dels) {
    const { error } = await supabase.from("baby_logs").delete().eq("id", d.uid);
    if (!error) await db.deletions.delete(d.uid);
  }

  // Push pending (including logs made before signing in).
  const pending = await db.logs.where("sync_status").equals("pending").toArray();
  if (pending.length) {
    const rows = pending.map((l) => ({
      id: l.uid,
      baby_id: babyId,
      type: l.type,
      value: l.value,
      notes: l.notes ?? null,
      ts: l.timestamp,
    }));
    const { error } = await supabase.from("baby_logs").upsert(rows);
    if (error) throw error;
    await db.transaction("rw", db.logs, async () => {
      for (const l of pending) await db.logs.update(l.id!, { sync_status: "synced", baby_id: babyId });
    });
  }

  // Pull recent history.
  const { data, error } = await supabase
    .from("baby_logs")
    .select("id, baby_id, type, value, notes, ts")
    .eq("baby_id", babyId)
    .gte("ts", Date.now() - PULL_WINDOW_MS);
  if (error) throw error;
  const remoteIds = new Set((data ?? []).map((r) => r.id));
  for (const row of data ?? []) await upsertLocal(row as Row);
  // Remove synced local rows deleted elsewhere.
  await db.logs
    .filter((l) => l.sync_status === "synced" && l.baby_id === babyId && l.timestamp >= Date.now() - PULL_WINDOW_MS && !remoteIds.has(l.uid))
    .delete();
}

export function subscribeBaby(babyId: string): RealtimeChannel {
  return supabase
    .channel(`baby-logs-${babyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "baby_logs", filter: `baby_id=eq.${babyId}` },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as Partial<Row>;
          if (old.id) await db.logs.where("uid").equals(old.id).delete();
        } else {
          await upsertLocal(payload.new as Row);
        }
      },
    )
    .subscribe();
}
