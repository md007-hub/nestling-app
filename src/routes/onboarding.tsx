import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFamily } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (s: Record<string, unknown>): { add?: boolean } => (s["add"] === true || s["add"] === "true" ? { add: true } : {}),
  head: () => ({ meta: [
    { title: "Set up your baby · Nestling" }, { name: "description", content: "Meet Nestling and set up your baby's shared care profile." },
    { property: "og:title", content: "Set up your baby · Nestling" }, { property: "og:description", content: "Start sharing your baby's care with your family." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Onboarding,
});

function Onboarding() {
  const { ready, babiesLoaded, user, baby: activeBaby, refresh, selectBaby } = useFamily();
  const { add } = Route.useSearch();
  const baby = add ? null : activeBaby;
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [dateKind, setDateKind] = useState<"birth" | "due">("birth");
  const [gender, setGender] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && babiesLoaded && user && baby && !busy) navigate({ to: "/", replace: true }); }, [ready, babiesLoaded, user, baby, busy, navigate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !date || !gender) return;
    const kg = weight ? Number(weight) * (unit === "lb" ? 0.45359237 : 1) : null;
    if (kg !== null && (!Number.isFinite(kg) || kg <= 0 || kg > 30)) { toast.error("Enter a valid birth weight"); return; }
    if (dateKind === "birth" && date > new Date().toISOString().slice(0, 10)) { toast.error("A birth date can't be in the future"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_baby", { _name: name.trim() });
      if (error) throw error;
      const { error: updateError } = await supabase.from("babies").update({
        birth_date: date, date_kind: dateKind, gender, birth_weight_kg: kg === null ? null : Math.round(kg * 100) / 100,
      }).eq("id", data.id);
      if (updateError) throw updateError;
      await refresh();
      selectBaby(data.id);
      navigate({ to: "/", replace: true });
      toast.success(`${name.trim()}'s profile is ready`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't save baby profile"); }
    finally { setBusy(false); }
  };

  if (!ready || (user && !babiesLoaded)) return <div className="h-80 animate-pulse bg-muted" />;
  if (!user) return <div className="py-12 text-center"><h1 className="font-display text-2xl font-bold">Let's get started</h1><Button asChild className="mt-5 h-12"><Link to="/auth">Log in or create an account</Link></Button></div>;
  if (baby) return null;

  return <div className="space-y-5 py-5">
    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Your family</p><h1 className="mt-2 font-display text-3xl font-bold">Meet your little one</h1><p className="mt-2 text-sm text-muted-foreground">Create a shared space for their care. You can invite your partner afterward.</p></div>
    <form onSubmit={save} className="space-y-5">
      <label className="block text-sm font-semibold">Baby's name<Input required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="mt-1.5 h-12 text-base" /></label>
      <div><p className="mb-2 text-sm font-semibold">Which date do you know?</p><div className="grid grid-cols-2 gap-2">{(["birth", "due"] as const).map(kind => <Button type="button" key={kind} variant={dateKind === kind ? "default" : "outline"} aria-pressed={dateKind === kind} onClick={() => setDateKind(kind)} className="h-12">{kind === "birth" ? "Date of birth" : "Due date"}</Button>)}</div></div>
      <label className="block text-sm font-semibold">{dateKind === "birth" ? "Date of birth" : "Due date"}<Input aria-label={dateKind === "birth" ? "Date of birth" : "Due date"} type="date" required max={dateKind === "birth" ? new Date().toISOString().slice(0, 10) : undefined} value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 h-12 text-base" /></label>
      <label className="block text-sm font-semibold">Gender<select required value={gender} onChange={e => setGender(e.target.value)} className="mt-1.5 h-12 w-full rounded-md border border-input bg-background px-3 text-base"><option value="">Select</option><option value="girl">Girl</option><option value="boy">Boy</option><option value="other">Another description</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
      <div><label className="block text-sm font-semibold" htmlFor="weight">Birth weight <span className="font-normal text-muted-foreground">(optional)</span></label><div className="mt-1.5 flex gap-2"><Input id="weight" type="number" inputMode="decimal" min="0.1" max={unit === "kg" ? "30" : "66"} step="0.01" value={weight} onFocus={e => e.target.select()} onChange={e => setWeight(e.target.value)} placeholder="0" className="h-12 flex-1 text-base" /><Button type="button" variant="outline" onClick={() => { setWeight(""); setUnit(unit === "kg" ? "lb" : "kg"); }} className="h-12 w-16">{unit}</Button></div></div>
      <Button type="submit" disabled={busy} className="h-12 w-full text-base">{busy ? "Saving…" : "Create baby profile"}<ArrowRight /></Button>
    </form>
    <p className="text-center text-sm text-muted-foreground">Already have an invite? <Link to="/family" className="font-semibold text-primary underline">Join your partner</Link></p>
  </div>;
}