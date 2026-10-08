import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ruler, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { useHomePrefs } from "@/hooks/useHomePrefs";
import { latestPercentiles, ordinal, sexOf, type GrowthRow } from "@/lib/growth";
import { BRACKETS, bracketForAge } from "@/lib/milestones";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
        <path d="M2 26 Q30 22 50 16 T98 6" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
      </svg>
    );
  }
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * 96, 28 - ((v - min) / span) * 24] as const);
  const lastPt = pts[pts.length - 1]!;
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill="currentColor" />
    </svg>
  );
}

export function Insights() {
  const { baby } = useFamily();
  const [prefs] = useHomePrefs();
  const [rows, setRows] = useState<GrowthRow[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const showGrowth = prefs.growth;
  const showMilestones = prefs.milestones && !!baby?.milestones_enabled;

  useEffect(() => {
    if (!baby) return;
    if (showGrowth)
      void supabase.from("baby_growth").select("*").eq("baby_id", baby.id).order("measured_on").then(({ data }) => setRows((data ?? []) as GrowthRow[]));
    if (showMilestones)
      void supabase.from("baby_milestones").select("milestone_key").eq("baby_id", baby.id).then(({ data }) => setKeys((data ?? []).map((d) => d.milestone_key)));
  }, [baby, showGrowth, showMilestones]);

  if (!baby || (!showGrowth && !showMilestones)) return null;
  const weight = latestPercentiles(rows, sexOf(baby.gender), baby.date_kind === "due" ? null : baby.birth_date).find((p) => p.metric === "weight");
  const bracket = BRACKETS.find((b) => b.id === bracketForAge(baby.birth_date, baby.date_kind))!;
  const total = Object.values(bracket.items).flat().length;
  const done = keys.filter((k) => k.startsWith(`${bracket.id}:`)).length;

  return (
    <div className={showGrowth && showMilestones ? "mt-4 grid grid-cols-2 gap-3" : "mt-4"}>
      {showGrowth && (
        <Link to="/growth" className="flex flex-col gap-2 rounded-3xl border border-sage-foreground/10 bg-sage p-4 text-sage-foreground shadow-soft transition hover:-translate-y-0.5 active:scale-[0.98]">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-80"><Ruler className="h-3.5 w-3.5" />WHO Growth Curve</span>
          <span className="font-display text-xl font-bold tabular-nums">{weight ? `${weight.value} kg` : "Add weight"}</span>
          <span className="text-xs font-medium opacity-80">{weight?.pct != null ? `${ordinal(weight.pct)} percentile` : "Tap to log a measurement"}</span>
          <Sparkline values={rows.filter((r) => r.weight_kg != null).map((r) => Number(r.weight_kg))} />
        </Link>
      )}
      {showMilestones && (
        <Link to="/milestones" className="flex flex-col gap-2 rounded-3xl border border-peach-foreground/10 bg-peach p-4 text-peach-foreground shadow-soft transition hover:-translate-y-0.5 active:scale-[0.98]">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-80"><Star className="h-3.5 w-3.5" />Development Milestones</span>
          <span className="font-display text-xl font-bold tabular-nums">{done} of {total}</span>
          <span className="text-xs font-medium opacity-80">completed · {bracket.label}</span>
          <span className="flex h-8 items-center gap-1" aria-hidden>
            {Array.from({ length: Math.min(total, 7) }, (_, i) => (
              <span key={i} className="flex flex-1 items-center gap-1">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i < Math.round((done / total) * Math.min(total, 7)) ? "bg-current" : "border-2 border-current opacity-40"}`} />
                {i < Math.min(total, 7) - 1 && <span className="h-0.5 flex-1 rounded bg-current opacity-25" />}
              </span>
            ))}
          </span>
        </Link>
      )}
    </div>
  );
}
