import Dexie, { type Table } from "dexie";

export type LogType = "feed" | "diaper" | "sleep" | "tummy" | "pumping" | "solids" | "note";
export type SyncStatus = "synced" | "pending";

export interface LogEntry {
  id?: number;
  uid: string;
  baby_id?: string | null;
  type: LogType;
  value: string;
  notes?: string | undefined;
  timestamp: number;
  sync_status: SyncStatus;
}

export interface PendingDelete {
  uid: string;
  baby_id: string;
}

class NurseryDB extends Dexie {
  logs!: Table<LogEntry, number>;
  deletions!: Table<PendingDelete, string>;

  constructor() {
    super("nurseryshift");
    this.version(1).stores({ logs: "++id, type, timestamp, sync_status" });
    this.version(2)
      .stores({
        logs: "++id, &uid, baby_id, type, timestamp, sync_status",
        deletions: "&uid",
      })
      .upgrade((tx) =>
        tx
          .table("logs")
          .toCollection()
          .modify((log: LogEntry) => {
            if (!log.uid) log.uid = crypto.randomUUID();
            log.sync_status = "pending";
          }),
      );
  }
}

export const db = new NurseryDB();

type Listener = () => void;
let onLocalChange: Listener | null = null;
export function setLocalChangeListener(fn: Listener | null) {
  onLocalChange = fn;
}

export async function addLog(entry: Omit<LogEntry, "id" | "uid" | "timestamp" | "sync_status" | "baby_id"> & {
  timestamp?: number;
}) {
  const id = await db.logs.add({
    ...entry,
    uid: crypto.randomUUID(),
    baby_id: null,
    timestamp: entry.timestamp ?? Date.now(),
    sync_status: "pending",
  });
  onLocalChange?.();
  return id;
}

export async function deleteLog(log: LogEntry) {
  if (log.id == null) return;
  await db.transaction("rw", db.logs, db.deletions, async () => {
    await db.logs.delete(log.id!);
    if (log.baby_id && log.sync_status === "synced") {
      await db.deletions.put({ uid: log.uid, baby_id: log.baby_id });
    }
  });
  onLocalChange?.();
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
