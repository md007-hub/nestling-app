import { useEffect, useState } from "react";
import { Bell, Share } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { defaultSettings, isIos, isStandalone, loadSettings, notificationsSupported, notify, requestPermission, saveSettings, type ReminderSettings } from "@/lib/reminders";

export function RemindersCard() {
  const [s, setS] = useState<ReminderSettings>(defaultSettings);
  const [perm, setPerm] = useState<string>("default");
  const [iosHint, setIosHint] = useState(false);
  useEffect(() => {
    setS(loadSettings());
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
    setIosHint(isIos() && !isStandalone());
  }, []);

  const update = async (patch: Partial<ReminderSettings>) => {
    const next = { ...s, ...patch };
    const turningOn = Object.values(patch).some((v) => v === true);
    if (turningOn && perm !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") {
        toast.error(p === "unsupported" ? "This browser can't show reminders." : "Notifications are blocked — allow them in your browser settings.");
        return;
      }
    }
    setS(next);
    saveSettings(next);
  };

  const Row = ({ label, sub, k }: { label: string; sub: string; k: "vitaminD" | "feed" | "wake" }) => (
    <label className="flex items-center justify-between gap-3 py-1">
      <span><span className="block font-medium">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
      <Switch checked={s[k]} onCheckedChange={(v) => void update({ [k]: v })} />
    </label>
  );

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Bell className="h-5 w-5" /> Reminders</h2>
      {iosHint && (
        <p className="flex items-start gap-2 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
          <Share className="mt-0.5 h-4 w-4 shrink-0" />
          On iPhone, tap Share then “Add to Home Screen” and open Nestling from there to get reminders.
        </p>
      )}
      <Row k="vitaminD" label="Vitamin D" sub="A daily nudge at your chosen time" />
      {s.vitaminD && <Input type="time" value={s.vitaminDTime} onChange={(e) => void update({ vitaminDTime: e.target.value })} className="h-11 w-36" />}
      <Row k="feed" label="Feed interval" sub={`When it's been ${s.feedHours}h since the last feed`} />
      {s.feed && (
        <div className="flex gap-2">
          {[2, 2.5, 3, 4].map((h) => (
            <Button key={h} size="sm" variant={s.feedHours === h ? "default" : "outline"} onClick={() => void update({ feedHours: h })}>{h}h</Button>
          ))}
        </div>
      )}
      <Row k="wake" label="Wake window" sub="Shortly before the age-based sleep window opens" />
      {perm === "granted" && (
        <Button variant="ghost" size="sm" onClick={() => void notify("Nestling", "Reminders are working.")}>Send a test reminder</Button>
      )}
      <p className="text-xs text-muted-foreground">Reminders are set per phone and arrive while Nestling is open or running in the background.</p>
    </section>
  );
}
