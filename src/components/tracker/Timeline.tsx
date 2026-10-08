import { useLiveQuery } from "dexie-react-hooks";
import { Baby, CloudSun, Droplets, Milk, MoonStar, StickyNote, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, deleteLog, startOfToday, type LogEntry } from "@/lib/db";
import { useFamily } from "@/hooks/useFamily";
import { cn } from "@/lib/utils";

function DiaperIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18v3a9 9 0 0 1-18 0V6Z" />
      <path d="M3 9c2.5 0 4 1.5 4.5 4M21 9c-2.5 0-4 1.5-4.5 4" />
      <path d="M9 6v2M15 6v2" />
    </svg>
  );
}

const meta = {
  feed: { icon: Milk, className: "bg-feed text-feed-foreground" },
  diaper: { icon: DiaperIcon, className: "bg-diaper text-diaper-foreground" },
  sleep: { icon: MoonStar, className: "bg-sleep text-sleep-foreground" },
  tummy: { icon: Baby, className: "bg-tummy text-tummy-foreground" },
  pumping: { icon: Droplets, className: "bg-feed text-feed-foreground" },
  solids: { icon: UtensilsCrossed, className: "bg-tummy text-tummy-foreground" },
  note: { icon: StickyNote, className: "bg-rose text-rose-foreground" },
} as const;

function secs(v?: string) {
  if (!v) return 0;
  const p = v.split(":").map(Number);
  return p.some((n) => !Number.isFinite(n)) ? 0 : p.reduce((t, n) => t * 60 + n, 0);
}
// Activity start time: duration-based entries are stored at their end time.
function startTs(log: LogEntry) {
  return log.type === "sleep" || log.type === "tummy" || log.type === "pumping" || log.value.startsWith("Breastfeed")
    ? log.timestamp - secs(log.notes) * 1000
    : log.timestamp;
}

function time(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function Timeline() {
  const { baby } = useFamily();
  const logs = useLiveQuery(
    () => db.logs.where("timestamp").aboveOrEqual(startOfToday()).toArray().then((l) => l.sort((a, b) => startTs(b) - startTs(a))),
    [],
    [] as LogEntry[],
  );

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-bold">Today</h2>
      {logs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Nothing logged yet today. Tap a button above to start.
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const { className } = meta[log.type];
            const Icon = log.type === "sleep" && log.value === "Nap" ? CloudSun : meta[log.type].icon;
            return (
              <li
                key={log.id}
                className="flex items-center gap-3 rounded-3xl bg-card p-3 shadow-soft"
              >
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", className)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{log.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {startTs(log) !== log.timestamp ? `${time(startTs(log))}–${time(log.timestamp)}` : time(log.timestamp)}
                    {log.notes ? ` · ${log.notes}` : ""}
                    {log.sync_status === "pending" && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-offline" title="Waiting to sync">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-offline" />
                        pending sync
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                   variant="ghost"
                  aria-label="Delete entry"
                  onClick={() => deleteLog(log)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
