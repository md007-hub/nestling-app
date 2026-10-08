import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Copy, CreditCard, FileText, Lock, LogOut, Sparkles, Users } from "lucide-react";
import { usePro } from "@/hooks/usePro";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { exportDoctorPdf, exportLogsCsv } from "@/lib/exportPdf";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RemindersCard } from "@/components/RemindersCard";
import { DatePicker } from "@/components/ui/date-picker";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Settings · Nestling" },
      { name: "description", content: "Create a baby profile, invite your partner with a code, and sync logs in real time." },
      { property: "og:title", content: "Settings · Nestling" },
      { property: "og:description", content: "Share your baby's feeds, diapers and sleep with your partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { ready, user, babies, baby, memberCount, selectBaby, refresh, signOut } = useFamily();
  const { isPro, openUpgrade } = usePro();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileGender, setProfileGender] = useState<"boy" | "girl" | "">("");
  const [profileDate, setProfileDate] = useState("");
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [inviteDialog, setInviteDialog] = useState(false);

  // Free accounts include 2 caregivers (primary account + 1 invite).
  const caregiverLimitReached = !isPro && memberCount >= 2;
  const CAREGIVER_LIMIT_COPY =
    "Free accounts include 2 caregivers. Upgrade to Nestling PRO to invite nannies, babysitters, and family members.";

  const showInviteDialog = () => setInviteDialog(true);

  const uploadPhoto = async (file: File | undefined, remove = false) => {
    if (!baby) return;
    if (!remove && (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) { toast.error("Choose an image under 5MB"); return; }
    setSavingProfile(true);
    let path: string | null = null;
    if (!remove && file) {
      path = `${baby.id}/${Date.now()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
      const { error } = await supabase.storage.from("baby-photos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) { setSavingProfile(false); toast.error("Photo upload failed"); return; }
    }
    const { error } = await supabase.from("babies").update({ photo_url: path }).eq("id", baby.id);
    if (!error && baby.photo_url) await supabase.storage.from("baby-photos").remove([baby.photo_url]);
    setSavingProfile(false);
    if (error) toast.error("Could not save photo"); else { toast.success(remove ? "Photo removed" : "Photo updated"); await refresh(); }
  };

  const editBaby = () => {
    if (!baby) return;
    setProfileName(baby.name);
    setProfileGender(baby.gender === "boy" || baby.gender === "girl" ? baby.gender : "");
    setProfileDate(baby.date_kind === "birth" ? baby.birth_date ?? "" : "");
    setEditingBabyId(baby.id);
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!baby || editingBabyId !== baby.id || savingProfile) return;
    const name = profileName.trim();
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!name || name.length > 60 || !profileGender || !/^\d{4}-\d{2}-\d{2}$/.test(profileDate) || profileDate > localToday) {
      toast.error("Enter a name, gender and valid date of birth");
      return;
    }
    setSavingProfile(true);
    try {
      const { data, error } = await supabase.from("babies").update({ name, gender: profileGender, birth_date: profileDate, date_kind: "birth" }).eq("id", baby.id).select("id").single();
      if (error || !data) throw error ?? new Error("Profile could not be saved");
      await refresh();
      setEditingBabyId(null);
      toast.success("Baby profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save baby profile");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!ready) return null;
  if (!user) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-bold">Family sync</h1>
        <p className="mt-2 text-muted-foreground">Sign in to back up your logs and share them with your partner.</p>
        <Button asChild className="mt-5 h-12 w-full text-base"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  const run = async (fn: () => Promise<{ id: string } | null>, ok: string) => {
    setBusy(true);
    try {
      const b = await fn();
      await refresh();
      if (b) selectBaby(b.id);
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };


  const join = () => {
    if (caregiverLimitReached) {
      showInviteDialog();
      return;
    }
    return run(async () => {
      const { data, error } = await supabase.rpc("join_baby", { _code: code });
      if (error) throw new Error(error.message);
      setCode("");
      return data as { id: string };
    }, "Joined! Logs are now shared");
  };

  return (
    <div className="space-y-4">
      {baby && (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active baby</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{baby.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberCount > 1 ? `Synced with partner · ${memberCount} parents` : "Only you so far — share the code below"}
          </p>
          {editingBabyId === baby.id ? (
            <form onSubmit={(event) => void saveProfile(event)} className="mt-5 space-y-4 border-t border-border pt-4">
              <h2 className="font-display text-lg font-bold">Edit baby profile</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-soft active:scale-[0.98]">
                  {baby.photo_url ? "Change photo" : "Add photo (optional)"}
                  <input type="file" accept="image/*" className="sr-only" disabled={savingProfile} onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
                </label>
                {baby.photo_url && <Button type="button" variant="ghost" disabled={savingProfile} onClick={() => void uploadPhoto(undefined, true)}>Remove photo</Button>}
              </div>
              <label className="block text-sm font-semibold">Baby name
                <Input required maxLength={60} value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-1.5 h-12 text-base" />
              </label>
              <div>
                <p className="mb-2 text-sm font-semibold">Gender</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Gender">
                  {(["boy", "girl"] as const).map((gender) => <Button key={gender} type="button" variant={profileGender === gender ? "default" : "outline"} aria-pressed={profileGender === gender} onClick={() => setProfileGender(gender)} className="h-12">{gender === "boy" ? "Boy" : "Girl"}</Button>)}
                </div>
              </div>
              <div><p className="text-sm font-semibold">Date of birth</p><DatePicker label="Date of birth" value={profileDate} onChange={setProfileDate} maxDate={new Date()} /></div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingBabyId(null)} className="h-12 flex-1">Cancel</Button>
                <Button type="submit" disabled={savingProfile} className="h-12 flex-1">{savingProfile ? "Saving…" : "Save profile"}</Button>
              </div>
            </form>
          ) : <Button type="button" variant="outline" onClick={editBaby} className="mt-4 h-11 w-full">Edit baby profile</Button>}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em]">{baby.invite_code}</span>
            <Button
              variant="secondary"
              className="h-11"
              aria-label={caregiverLimitReached ? "Caregiver limit reached — upgrade to invite more" : "Copy invite code"}
              onClick={() => {
                if (caregiverLimitReached) {
                  showInviteDialog();
                  return;
                }
                navigator.clipboard?.writeText(baby.invite_code);
                toast.success("Invite code copied");
              }}
            >
              {caregiverLimitReached ? <Lock /> : <Copy />} {caregiverLimitReached ? "2 of 2" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {caregiverLimitReached
              ? "All 2 free caregiver spots are in use. PRO removes the limit."
              : "Your partner signs in on their phone, opens Family, and enters this code."}
          </p>
          {babies.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {babies.map((b) => (
                <Button key={b.id} variant={b.id === baby.id ? "default" : "secondary"} className="h-10" onClick={() => selectBaby(b.id)}>
                  {b.name}
                </Button>
              ))}
            </div>
          )}
          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Enable Solids Tracking</span>
              <span className="block text-xs text-muted-foreground">Adds a Solids tab to the Feed card. Usually from around 6 months.</span>
            </span>
            <Switch
              checked={baby.solids_enabled}
              onCheckedChange={async (on) => {
                const { error } = await supabase.from("babies").update({ solids_enabled: on }).eq("id", baby.id);
                if (error) { toast.error("Couldn't update setting"); return; }
                await refresh();
                toast.success(on ? "Solids tracking on" : "Solids tracking off");
              }}
            />
          </label>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Track Developmental Milestones</span>
              <span className="block text-xs text-muted-foreground">Shows a Milestones card on the Tracker.</span>
            </span>
            <Switch
              checked={baby.milestones_enabled}
              onCheckedChange={async (on) => {
                const { error } = await supabase.from("babies").update({ milestones_enabled: on }).eq("id", baby.id);
                if (error) { toast.error("Couldn't update setting"); return; }
                await refresh();
                toast.success(on ? "Milestones on" : "Milestones hidden");
              }}
            />
          </label>
        </section>
      )}

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Join with an invite code</h2>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" className="h-12 font-mono text-lg tracking-[0.3em]" />
        <Button disabled={busy || code.trim().length !== 6} onClick={join} className="h-12 w-full text-base">Join baby profile</Button>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">{baby ? "Add another baby" : "Create a baby profile"}</h2>
        <p className="text-sm text-muted-foreground">Name, date of birth or due date, gender and birth weight.</p>
        <Button asChild className="h-12 w-full text-base"><Link to="/onboarding" search={{ add: true }}>Add child</Link></Button>
      </section>

      <RemindersCard />

      <ProSection babyName={baby?.name ?? null} />

      <Button asChild variant="outline" className="h-12 w-full justify-start text-base"><Link to="/tour"><BookOpen /> App Tour / How Nestling Works</Link></Button>

      <Button variant="ghost" className="h-12 w-full text-muted-foreground" onClick={signOut}>
        <LogOut /> Sign out ({user.email})
      </Button>

      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="max-w-sm rounded-3xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Lock className="h-5 w-5 text-primary" /> Caregiver limit reached
            </DialogTitle>
            <DialogDescription className="text-left">{CAREGIVER_LIMIT_COPY}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setInviteDialog(false)}>
              Not now
            </Button>
            <Button
              className="h-12 flex-1"
              onClick={() => {
                setInviteDialog(false);
                openUpgrade(CAREGIVER_LIMIT_COPY);
              }}
            >
              <Sparkles /> Upgrade to PRO
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProSection({ babyName }: { babyName: string | null }) {
  const { isPro, ownSub, openUpgrade, testPro, canTestPro, setTestPro } = usePro();
  const lifetime = ownSub?.price_id === "pro_lifetime";
  const [busy, setBusy] = useState(false);

  const manage = async () => {
    const tab = window.open("", "_blank");
    setBusy(true);
    try {
      const res = await createPortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in res) throw new Error(res.error);
      if (tab) tab.location.href = res.url;
      else window.location.href = res.url;
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : "Couldn't open subscription settings");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!isPro) return openUpgrade("The Doctor PDF export is part of Nestling Pro.");
    try {
      await exportDoctorPdf(babyName);
      toast.success("Report downloaded");
    } catch {
      toast.error("Couldn't create the report");
    }
  };

  const ends = ownSub?.current_period_end ? new Date(ownSub.current_period_end).toLocaleDateString() : null;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Nestling Pro</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {isPro
          ? lifetime
            ? "Lifetime PRO — thank you!"
            : ownSub
            ? ownSub.status === "trialing"
              ? `Free trial active${ends ? ` · first charge ${ends}` : ""}`
              : ownSub.cancel_at_period_end
                ? `Pro until ${ends}`
                : `Pro active${ends ? ` · renews ${ends}` : ""}`
            : testPro
              ? "PRO switched on in test mode."
              : "Pro is shared with you by your partner."
          : "Unlimited Nanny AI, all sleep sounds and doctor-ready reports."}
      </p>

      <Button variant="secondary" onClick={exportPdf} className="h-12 w-full justify-start text-base">
        <FileText /> Doctor PDF export (last 7 days)
        {!isPro && <Lock className="ml-auto text-muted-foreground" />}
      </Button>
      <Button variant="secondary" onClick={() => void exportLogsCsv()} className="h-12 w-full justify-start text-base">
        <FileText /> Export Logs (CSV)
      </Button>

      {!isPro && (
        <Button onClick={() => openUpgrade()} className="h-12 w-full text-base">
          See PRO plans
        </Button>
      )}
      {canTestPro && testPro && (
        <Button variant="ghost" onClick={() => setTestPro(false)} className="h-10 w-full text-xs text-muted-foreground">
          Test mode: switch PRO off
        </Button>
      )}
      {ownSub && !lifetime && (
        <Button variant="outline" disabled={busy} onClick={manage} className="h-12 w-full text-base">
          <CreditCard /> Manage Subscription
        </Button>
      )}
    </section>
  );
}
