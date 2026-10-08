import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { BRACKETS, CATEGORIES, bracketForAge, keyOf } from "@/lib/milestones";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/milestones")({
  head: () => ({
    meta: [
      { title: "Developmental Milestones · Nestling" },
      { name: "description", content: "Track CDC/AAP developmental milestones by age, with dates and notes shared between parents." },
      { property: "og:title", content: "Developmental Milestones · Nestling" },
      { property: "og:description", content: "Celebrate and record your baby's milestones from newborn to 3 years." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MilestonesPage,
});

type Row = { milestone_key: string; achieved_at: string; note: string | null };

function MilestonesPage() {
  const { baby } = useFamily();
  const [tab, setTab] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<Record<string, Row>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!baby) return;
    setTab(bracketForAge(baby.birth_date, baby.date_kind));
    void supabase.from("baby_milestones").select("milestone_key, achieved_at, note").eq("baby_id", baby.id).then(({ data }) => {
      setDone(Object.fromEntries((data ?? []).map((r) => [r.milestone_key, r])));
    });
  }, [baby?.id, baby?.birth_date, baby?.date_kind]);

  useEffect(() => {
    const row = tabsRef.current;
    const selected = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !selected) return;
    const left = selected.offsetLeft - row.offsetLeft - (row.clientWidth - selected.clientWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [tab]);

  if (!baby || !tab) return <div className="h-80 animate-pulse rounded-3xl bg-muted/60" />;
  const bracket = BRACKETS.find((b) => b.id === tab)!;

  const toggle = async (key: string) => {
    if (done[key]) {
      const prev = done[key];
      setDone(({ [key]: _, ...rest }) => rest);
      if (noteFor === key) setNoteFor(null);
      const { error } = await supabase.from("baby_milestones").delete().eq("baby_id", baby.id).eq("milestone_key", key);
      if (error) { setDone((d) => ({ ...d, [key]: prev })); toast.error("Couldn't update milestone"); }
      return;
    }
    const row: Row = { milestone_key: key, achieved_at: new Date().toISOString(), note: null };
    setDone((d) => ({ ...d, [key]: row }));
    setNoteFor(key); setNote("");
    const { error } = await supabase.from("baby_milestones").insert({ baby_id: baby.id, ...row });
    if (error) { setDone(({ [key]: _, ...rest }) => rest); toast.error("Couldn't save milestone"); }
  };

  const saveNote = async (key: string) => {
    const text = note.trim().slice(0, 200) || null;
    const { error } = await supabase.from("baby_milestones").update({ note: text }).eq("baby_id", baby.id).eq("milestone_key", key);
    if (error) { toast.error("Couldn't save note"); return; }
    setDone((d) => ({ ...d, [key]: { ...d[key]!, note: text } }));
    setNoteFor(null);
  };

  const total = CATEGORIES.reduce((s, c) => s + bracket.items[c.key].length, 0);
  const count = CATEGORIES.reduce((s, c) => s + bracket.items[c.key].filter((_, i) => done[keyOf(bracket.id, c.key, i)]).length, 0);

  return (
    <div className="space-y-4 pb-28">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"><ChevronLeft className="h-4 w-4" />Tracker</Link>
      <header>
        <h1 className="font-display text-2xl font-bold">Developmental Milestones</h1>
        <p className="text-sm text-muted-foreground">Tap to mark what {baby.name} can do. Every baby develops at their own pace.</p>
      </header>
      <div ref={tabsRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-4 py-1 touch-pan-x" role="tablist" aria-label="Milestone age groups">
        {BRACKETS.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === tab} onClick={() => setTab(b.id)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-soft tap-card", b.id === tab ? "bg-peach text-peach-foreground ring-2 ring-peach-foreground/20" : "bg-card")}>{b.label}</button>
        ))}
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{count} of {total} achieved</p>
      {CATEGORIES.map((c) => (
        <section key={c.key} className="rounded-[2rem] bg-card p-4 shadow-soft">
          <h2 className="mb-2 font-display text-lg font-bold">{c.label}</h2>
          <ul className="space-y-2">
            {bracket.items[c.key].map((label, i) => {
              const key = keyOf(bracket.id, c.key, i);
              const row = done[key];
              return (
                <li key={key}>
                  <button type="button" aria-pressed={!!row} onClick={() => void toggle(key)} className={cn("flex min-h-14 w-full items-center gap-3 rounded-3xl px-3 py-2.5 text-left tap-card transition active:scale-[0.98]", row ? "bg-peach" : "bg-muted/50")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition", row ? "border-peach-foreground/30 bg-card text-peach-foreground shadow-soft" : "border-border bg-card")}>{row && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{label}</span>
                      {row && <span className="block text-xs text-muted-foreground">Achieved {new Date(row.achieved_at).toLocaleDateString()}{row.note ? ` · ${row.note}` : ""}</span>}
                    </span>
                  </button>
                  {row && noteFor !== key && <button type="button" onClick={() => { setNoteFor(key); setNote(row.note ?? ""); }} className="ml-12 mt-1 text-xs font-semibold text-muted-foreground underline">{row.note ? "Edit note" : "Add note"}</button>}
                  {row && noteFor === key && (
                    <div className="mt-2 flex gap-2 pl-12">
                      <input autoFocus maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm" />
                      <button type="button" onClick={() => void saveNote(key)} className="rounded-full bg-peach px-4 text-sm font-bold text-peach-foreground transition active:scale-95">Save</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Based on CDC/AAP guidance. If you have concerns, talk to your pediatrician.</p>
    </div>
  );
}
