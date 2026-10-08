import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ArrowLeft, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { useHydrated } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";
import { ageInMonths, latestPercentiles, MAX_MONTHS, METRIC_KEY, METRIC_LABEL, ordinal, PERCENTILES, sexOf, valueAt, type GrowthRow, type Metric } from "@/lib/growth";

export const Route = createFileRoute("/growth")({
  head: () => ({
    meta: [
      { title: "Growth & WHO Percentiles — Nestling" },
      { name: "description", content: "Track weight, length and head circumference against WHO growth standards." },
      { property: "og:title", content: "Growth & WHO Percentiles — Nestling" },
      { property: "og:description", content: "Plot your child's growth on WHO percentile curves through age five." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GrowthPage,
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
const field = "h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base tabular-nums";

function GrowthPage() {
  const hydrated = useHydrated();
  const { baby, user } = useFamily();
  const [rows, setRows] = useState<GrowthRow[]>([]);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [head, setHead] = useState("");
  const [wUnit, setWUnit] = useState<"kg" | "lb">("kg");
  const [lUnit, setLUnit] = useState<"cm" | "in">("cm");
  const [metric, setMetric] = useState<Metric>("weight");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!baby) return;
    const { data } = await supabase.from("baby_growth").select("*").eq("baby_id", baby.id).order("measured_on");
    setRows((data ?? []) as GrowthRow[]);
  }, [baby]);
  useEffect(() => { void load(); }, [load]);

  const sex = sexOf(baby?.gender);
  const birth = baby?.birth_date ?? null;
  const badges = latestPercentiles(rows, sex, birth);
  const currentMeasurement = badges.find((badge) => badge.metric === metric);
  const chartMax = MAX_MONTHS[metric];

  const chart = useMemo(() => {
    if (!sex) return null;
    const curves = Array.from({ length: chartMax * 2 + 1 }, (_, i) => {
      const m = i / 2;
      const o: Record<string, number> = { m };
      for (const p of PERCENTILES) {
        const value = valueAt(metric, sex, m, p);
        if (value != null) o[`p${p}`] = Number(value.toFixed(2));
      }
      return o;
    });
    const points = birth
      ? rows.filter((r) => r[METRIC_KEY[metric]] != null).map((r) => ({ m: Number(ageInMonths(birth, r.measured_on).toFixed(2)), baby: Number(r[METRIC_KEY[metric]]) })).filter((p) => p.m >= 0 && p.m <= chartMax)
      : [];
    return { curves, points, latest: points.at(-1) };
  }, [sex, birth, rows, metric, chartMax]);

  const save = async () => {
    if (!baby) return;
    const w = weight ? Number(weight) * (wUnit === "lb" ? 0.453592 : 1) : null;
    const l = length ? Number(length) * (lUnit === "in" ? 2.54 : 1) : null;
    const h = head ? Number(head) * (lUnit === "in" ? 2.54 : 1) : null;
    if (w == null && l == null && h == null) { toast.error("Enter at least one measurement"); return; }
    if ((w != null && !(w > 0 && w < 40)) || (l != null && !(l > 20 && l < 130)) || (h != null && !(h > 20 && h < 70))) { toast.error("One of the values looks out of range"); return; }
    if (!date || date > today()) { toast.error("Pick a date that isn't in the future"); return; }
    setBusy(true);
    const { error } = await supabase.from("baby_growth").insert({
      baby_id: baby.id, measured_on: date,
      weight_kg: w == null ? null : Number(w.toFixed(3)), length_cm: l == null ? null : Number(l.toFixed(1)), head_cm: h == null ? null : Number(h.toFixed(1)),
    });
    setBusy(false);
    if (error) { toast.error("Couldn't save measurement"); return; }
    setWeight(""); setLength(""); setHead("");
    toast.success("Measurement saved");
    void load();
  };

  if (!hydrated) return null;
  if (!user || !baby) return <p className="rounded-3xl bg-card p-6 text-center shadow-soft">Sign in and set up a baby to track growth. <Link to="/" className="font-semibold underline">Back</Link></p>;

  const unitFor = (m: Metric) => (m === "weight" ? "kg" : "cm");
  const ageLabel = (months: number) => {
    const rounded = Math.max(0, Math.round(months));
    if (rounded < 12) return `${rounded} month${rounded === 1 ? "" : "s"}`;
    const years = Math.floor(rounded / 12);
    const remainder = rounded % 12;
    return `${years} year${years === 1 ? "" : "s"}${remainder ? ` ${remainder} month${remainder === 1 ? "" : "s"}` : ""}`;
  };
  const metricWord = metric === "weight" ? "weighs more" : metric === "length" ? "measures longer" : "measures larger";

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"><ArrowLeft className="h-4 w-4" />Tracker</Link>
      <section className="rounded-3xl bg-sage p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-sage-foreground"><Ruler className="h-5 w-5" /></span>
          <h1 className="text-lg font-bold">{baby.name}'s growth</h1>
        </div>
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => <span key={b.metric} className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-soft">{METRIC_LABEL[b.metric]}: {b.pct != null ? `${ordinal(b.pct)} percentile` : `${b.value} ${unitFor(b.metric)}`}</span>)}
          </div>
        ) : <p className="text-sm text-muted-foreground">Add a measurement to see percentiles.</p>}
        {(!sex || !birth) && <p className="mt-2 text-xs text-muted-foreground">Percentiles need a date of birth and a gender of Boy or Girl in the baby profile.</p>}
      </section>

      <section className="space-y-3 rounded-3xl bg-sage/30 p-4 shadow-soft">
        <h2 className="text-base font-bold">Add measurement</h2>
        <label className="flex items-center gap-2 text-sm font-medium">Date<input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
        <div className="flex items-center gap-2"><label htmlFor="g-w" className="w-16 text-sm font-medium">Weight</label><input id="g-w" type="number" inputMode="decimal" step="0.01" placeholder="0" value={weight} onFocus={selectAll} onChange={(e) => setWeight(e.target.value)} className={field} /><Button type="button" variant="outline" onClick={() => { setWeight(""); setWUnit(wUnit === "kg" ? "lb" : "kg"); }} className="h-12 w-16 rounded-full border-sage-foreground/30 bg-sage/40 font-semibold text-sage-foreground">{wUnit}</Button></div>
        <div className="flex items-center gap-2"><label htmlFor="g-l" className="w-16 text-sm font-medium">Length</label><input id="g-l" type="number" inputMode="decimal" step="0.1" placeholder="0" value={length} onFocus={selectAll} onChange={(e) => setLength(e.target.value)} className={field} /><Button type="button" variant="outline" onClick={() => { setLength(""); setHead(""); setLUnit(lUnit === "cm" ? "in" : "cm"); }} className="h-12 w-16 rounded-full border-sage-foreground/30 bg-sage/40 font-semibold text-sage-foreground">{lUnit}</Button></div>
        <div className="flex items-center gap-2"><label htmlFor="g-h" className="w-16 text-sm font-medium">Head</label><input id="g-h" type="number" inputMode="decimal" step="0.1" placeholder="0" value={head} onFocus={selectAll} onChange={(e) => setHead(e.target.value)} className={field} /><span className="flex h-12 w-16 items-center justify-center rounded-full border border-sage-foreground/30 text-sm font-semibold text-sage-foreground">{lUnit}</span></div>
        <Button type="button" disabled={busy} onClick={() => void save()} className="h-14 w-full rounded-2xl bg-sage font-display text-base font-bold text-sage-foreground shadow-soft transition active:scale-[0.97] hover:bg-sage/80">Save measurement</Button>
      </section>

      {chart && (
        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <div className="mb-3 grid grid-cols-3 rounded-full bg-muted p-1" role="group" aria-label="Chart metric">
            {(["weight", "length", "head"] as Metric[]).map((m) => <Button key={m} type="button" variant="ghost" aria-pressed={metric === m} onClick={() => setMetric(m)} className={cn("h-10 rounded-full text-foreground", metric === m && "bg-sage text-sage-foreground hover:bg-sage hover:text-sage-foreground")}>{METRIC_LABEL[m]}</Button>)}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">WHO {sex === "boy" ? "boys" : "girls"} · 3rd, 15th, 50th, 85th, 97th percentiles ({unitFor(metric)} by month, 0–{chartMax})</p>
           {currentMeasurement && (
             <div className="mb-4 rounded-2xl bg-sage/50 p-4" aria-live="polite">
               {currentMeasurement.pct != null ? (
                 <>
                   <p className="font-display text-lg font-bold">{baby.name} is in the ~{Math.round(currentMeasurement.pct)}th percentile ({currentMeasurement.value} {unitFor(metric)}) for {METRIC_LABEL[metric].toLowerCase()}.</p>
                   <p className="mt-1 text-sm text-muted-foreground">{currentMeasurement.pct >= 25 && currentMeasurement.pct <= 75 ? "Right in the healthy middle of the WHO curve" : "Tracking on the WHO growth curve"} — {metricWord} than about {Math.round(currentMeasurement.pct)}% of {sex === "boy" ? "boys" : "girls"} at {ageLabel(ageInMonths(birth!, currentMeasurement.date))}.</p>
                 </>
               ) : (
                 <><p className="font-display text-lg font-bold">{baby.name}'s latest {METRIC_LABEL[metric].toLowerCase()}: {currentMeasurement.value} {unitFor(metric)}</p><p className="mt-1 text-sm text-muted-foreground">{!birth ? "Add a date of birth in Family settings to compare this measurement." : !sex ? "Choose Boy or Girl in Family settings to compare against WHO standards." : ageInMonths(birth, currentMeasurement.date) > chartMax ? `${METRIC_LABEL[metric]} standards in this chart cover up to ${chartMax} months.` : "This measurement was taken before the date of birth, so no percentile can be shown."}</p></>
               )}
               <p className="mt-2 text-xs text-muted-foreground">Measured {currentMeasurement.date} · A single percentile does not determine healthy growth; ask your clinician about any concerns.</p>
             </div>
           )}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="m" type="number" domain={[0, chartMax]} ticks={chartMax === 60 ? [0, 12, 24, 36, 48, 60] : [0, 3, 6, 9, 12, 15, 18, 21, 24]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                {PERCENTILES.map((p) => <Line key={p} data={chart.curves} dataKey={`p${p}`} name={`${ordinal(p)}`} dot={false} strokeWidth={p === 50 ? 2 : 1} stroke={p === 50 ? "var(--sage-foreground)" : "var(--muted-foreground)"} strokeOpacity={p === 50 ? 0.9 : 0.45} isAnimationActive={false} />)}
                <Line data={chart.points} dataKey="baby" name={baby.name} stroke="var(--tummy-foreground)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--tummy-foreground)" }} isAnimationActive={false} />
                {chart.latest && <ReferenceDot x={chart.latest.m} y={chart.latest.baby} r={7} fill="var(--tummy-foreground)" stroke="var(--card)" strokeWidth={3} className="drop-shadow-[0_0_7px_var(--tummy-foreground)]" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <h2 className="mb-2 text-base font-bold">History</h2>
          <ul className="divide-y divide-border">
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-24 shrink-0 font-medium">{r.measured_on}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">{[r.weight_kg != null && `${r.weight_kg} kg`, r.length_cm != null && `${r.length_cm} cm`, r.head_cm != null && `head ${r.head_cm} cm`].filter(Boolean).join(" · ")}</span>
                <Button type="button" variant="ghost" aria-label="Delete measurement" className="h-10 w-10 rounded-full" onClick={async () => { await supabase.from("baby_growth").delete().eq("id", r.id); void load(); }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
