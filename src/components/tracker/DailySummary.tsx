import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Moon, Settings2 } from "lucide-react";
import { db, startOfToday } from "@/lib/db";
import { useFamily } from "@/hooks/useFamily";
import { useHomePrefs, type HomePrefs } from "@/hooks/useHomePrefs";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ACTION_LABELS, useActionOrder } from "@/hooks/useHomePrefs";

function ago(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
function ageLabel(birth?: string | null, kind?: string | null) {
  if (!birth || kind === "due") return null;
  const days = (Date.now() - new Date(`${birth}T12:00:00`).getTime()) / 86400000;
  if (!(days >= 0)) return null;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  const m = Math.floor(days / 30.4375);
  return m < 24 ? `${m}m` : `${Math.floor(m / 12)}y`;
}

const TOGGLES: { key: keyof HomePrefs; label: string }[] = [
  { key: "pumping", label: "Show Pumping" },
  { key: "notes", label: "Show Notes" },
  { key: "growth", label: "Show WHO Growth Curve" },
  { key: "milestones", label: "Show Milestones" },
];

export function DailySummary() {
  const { baby } = useFamily();
  const [prefs, setPref] = useHomePrefs();
  const { order, move } = useActionOrder();
  const [editOpen, setEditOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const logs = useLiveQuery(() => db.logs.where("timestamp").aboveOrEqual(startOfToday() - 86400000).toArray(), [], []);
  const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
  const lastFeed = sorted.find((l) => l.type === "feed");
  const lastSleep = sorted.find((l) => l.type === "sleep");
  const name = baby?.name ?? "Baby";
  const age = ageLabel(baby?.birth_date, baby?.date_kind);

  const [sleepStart, setSleepStart] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      const v = Number(localStorage.getItem("nestling-sleep-start"));
      setSleepStart(v > 0 ? v : null);
    };
    read();
    window.addEventListener("nestling-sleep", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("nestling-sleep", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const asleep = sleepStart != null;
  const parts = [
    asleep ? `Asleep ${ago(now - sleepStart)}` : lastSleep ? `Awake ${ago(now - lastSleep.timestamp)}` : null,
    lastFeed ? `Last fed ${ago(now - lastFeed.timestamp)} ago` : null,
  ].filter(Boolean);
  const subline = parts.length ? parts.join(" • ") : "Ready for the day — awaiting first log";

  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!baby?.photo_url) {
      setPhoto(null);
      return;
    }
    void supabase.storage
      .from("baby-photos")
      .createSignedUrl(baby.photo_url, 3600)
      .then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [baby?.photo_url]);

  return (
    <section
      aria-label="Baby status"
      className="mb-4 flex items-center gap-2 rounded-[2rem] border border-border/50 bg-card py-3 pl-2 pr-2 shadow-soft"
    >
      <span
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-display text-2xl font-bold text-accent-foreground"
        aria-hidden
      >
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-display text-lg font-bold leading-tight">
          <span className="truncate">
            {name}
            {age && <span className="font-semibold text-muted-foreground"> ({age})</span>}
          </span>
          {asleep && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky px-2 py-0.5 text-xs font-semibold text-sky-foreground">
              <Moon className="h-3 w-3" />
              Sleeping
            </span>
          )}
        </p>
        <p className="mt-1 whitespace-normal break-words text-sm leading-relaxed tabular-nums text-muted-foreground">{subline}</p>
      </div>
      <button
        type="button"
        aria-label="Edit Home"
        onClick={() => setEditOpen(true)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground transition active:scale-95 hover:bg-muted"
      >
        <Settings2 className="h-5 w-5" />
      </button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bottom-0 top-auto max-h-[90dvh] overflow-y-auto w-full max-w-lg translate-y-0 rounded-b-none rounded-t-3xl border-border bg-background p-5 pb-8 sm:rounded-t-3xl">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-xl">Edit Home</DialogTitle>
            <DialogDescription>Choose what shows on your home screen. Saved on this phone.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-3xl border border-border/50 bg-card">
            {TOGGLES.map((t) => (
              <li key={t.key}>
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 text-base font-medium">
                  {t.label}
                  <Switch checked={prefs[t.key]} onCheckedChange={(v) => setPref(t.key, v)} />
                </label>
              </li>
            ))}
          </ul>
          <h3 className="mt-2 font-display text-base font-bold">Button order</h3>
          <ol className="divide-y divide-border rounded-3xl border border-border/50 bg-card">
            {order.map((k, i) => (
              <li key={k} className="flex min-h-14 items-center gap-2 px-4">
                <span className="flex-1 text-base font-medium">{ACTION_LABELS[k]}</span>
                <button type="button" aria-label={`Move ${ACTION_LABELS[k]} up`} disabled={i === 0} onClick={() => move(k, -1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 transition active:scale-90 disabled:opacity-30"><ChevronUp className="h-5 w-5" /></button>
                <button type="button" aria-label={`Move ${ACTION_LABELS[k]} down`} disabled={i === order.length - 1} onClick={() => move(k, 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/70 transition active:scale-90 disabled:opacity-30"><ChevronDown className="h-5 w-5" /></button>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </section>
  );
}
