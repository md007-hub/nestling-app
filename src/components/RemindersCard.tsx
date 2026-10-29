
import { useCallback, useEffect, useState } from "react";
import { Bell, Share, Settings2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/hooks/useFamily";
import {
  defaultSettings,
  isIos,
  isStandalone,
  loadSettings,
  notificationsSupported,
  notify,
  requestPermission,
  saveSettings,
  scheduleReminders,
  type ReminderSettings,
} from "@/lib/reminders";

export function RemindersCard() {
  const { baby } = useFamily();

  const [s, setS] = useState<ReminderSettings>(defaultSettings);
  const [perm, setPerm] = useState<string>("default");
  const [exactAlarm, setExactAlarm] = useState<string>("unknown");
  const [iosHint, setIosHint] = useState(false);

  const isAndroid =
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android";

  const checkPermissions = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.checkPermissions();
        setPerm(result.display);
      } catch {
        setPerm("unsupported");
      }

      if (Capacitor.getPlatform() === "android") {
        try {
          const result =
            await LocalNotifications.checkExactNotificationSetting();
          setExactAlarm(result.exact_alarm);
        } catch (error) {
          console.error("Exact alarm permission check failed:", error);
          setExactAlarm("unknown");
        }
      }
    } else {
      setPerm(
        notificationsSupported()
          ? Notification.permission
          : "unsupported",
      );
    }
  }, []);

  useEffect(() => {
    setS(loadSettings());

    setIosHint(
      !Capacitor.isNativePlatform() &&
      typeof window !== "undefined" &&
      isIos() &&
      !isStandalone(),
    );

    void checkPermissions();

    const onResume = () => {
      void checkPermissions();
    };

    document.addEventListener("visibilitychange", onResume);

    return () => {
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [checkPermissions]);

  const update = async (patch: Partial<ReminderSettings>) => {
    const next = { ...s, ...patch };
    const turningOn = Object.values(patch).some((v) => v === true);

    if (turningOn && perm !== "granted") {
      const p = await requestPermission();
      setPerm(p);

      if (p !== "granted") {
        toast.error(
          p === "unsupported"
            ? "This device can't show reminders."
            : "Notifications are blocked. Allow them in your device settings.",
        );
        return;
      }
    }

    setS(next);
    saveSettings(next);

    if (Capacitor.isNativePlatform()) {
      try {
        await scheduleReminders(baby);
      } catch (error) {
        console.error("Reminder scheduling failed:", error);
        toast.error("Could not update scheduled reminders.");
      }
    }
  };

  const openExactAlarmSettings = async () => {
    try {
      await LocalNotifications.changeExactNotificationSetting();
      await checkPermissions();

      if (baby) {
        await scheduleReminders(baby);
      }
    } catch (error) {
      console.error("Failed to open exact alarm settings:", error);
      toast.error("Could not open Android alarm settings.");
    }
  };

  const Row = ({
    label,
    sub,
    k,
  }: {
    label: string;
    sub: string;
    k: "vitaminD" | "feed" | "wake";
  }) => (
    <label className="flex items-center justify-between gap-3 py-1">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      <Switch
        checked={s[k]}
        onCheckedChange={(v) => void update({ [k]: v })}
      />
    </label>
  );

  const hasEnabledReminder = s.vitaminD || s.feed || s.wake;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Bell className="h-5 w-5" /> Reminders
      </h2>

      {iosHint && (
        <p className="flex items-start gap-2 rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
          <Share className="mt-0.5 h-4 w-4 shrink-0" />
          On iPhone, tap Share then "Add to Home Screen" and open
          Nestling from there to get reminders.
        </p>
      )}

      <Row
        k="vitaminD"
        label="Vitamin D"
        sub="A daily nudge at your chosen time"
      />

      {s.vitaminD && (
        <Input
          type="time"
          value={s.vitaminDTime}
          onChange={(e) =>
            void update({ vitaminDTime: e.target.value })
          }
          className="h-11 w-36"
        />
      )}

      <Row
        k="feed"
        label="Feed interval"
        sub={`When it's been ${s.feedHours}h since the last feed`}
      />

      {s.feed && (
        <div className="flex gap-2">
          {[2, 2.5, 3, 4].map((h) => (
            <Button
              key={h}
              size="sm"
              variant={s.feedHours === h ? "default" : "outline"}
              onClick={() => void update({ feedHours: h })}
            >
              {h}h
            </Button>
          ))}
        </div>
      )}

      <Row
        k="wake"
        label="Wake window"
        sub="Shortly before the age-based sleep window opens"
      />

      {isAndroid &&
        hasEnabledReminder &&
        exactAlarm === "denied" && (
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/50 p-3">
            <p className="text-sm font-semibold">
              Allow precise reminders
            </p>
            <p className="text-xs text-muted-foreground">
              Android needs additional alarm permission to deliver
              reminders reliably at their scheduled times, including
              when your phone is locked.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openExactAlarmSettings()}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Open Android alarm settings
            </Button>
          </div>
        )}

      {perm === "granted" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void notify("Nestling", "Reminders are working.")
          }
        >
          Send a test reminder
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        On Android, scheduled reminders can arrive even when Nestling
        is closed. Delivery timing depends on device permissions and
        battery settings.
      </p>
    </section>
  );
}
