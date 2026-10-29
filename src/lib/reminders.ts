
import { db } from "@/lib/db";
import { wakeRangeFor } from "@/lib/wakeWindow";
import type { Baby } from "@/hooks/useFamily";
import { Capacitor } from "@capacitor/core";
import {
  requestNotificationPermissions,
  checkExactAlarmPermission,
  scheduleBabyReminder,
  scheduleNativeReminder,
  cancelNativeReminders,
} from "@/lib/notifications";

export type ReminderSettings = {
  vitaminD: boolean;
  vitaminDTime: string;
  feed: boolean;
  feedHours: number;
  wake: boolean;
};

const KEY = "nestling-reminders";
const SENT = "nestling-reminders-sent";

const IDS = {
  vitaminD: 81001,
  feed: 81002,
  wake: 81003,
};

export const defaultSettings: ReminderSettings = {
  vitaminD: false,
  vitaminDTime: "09:00",
  feed: false,
  feedHours: 3,
  wake: false,
};

export function loadSettings(): ReminderSettings {
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem(KEY) ?? "{}"),
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: ReminderSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

const inPreview = () => {
  try {
    return (
      window.self !== window.top ||
      /id-preview--|lovableproject\.com/.test(location.hostname)
    );
  } catch {
    return true;
  }
};

export const notificationsSupported = () => {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== "undefined" && "Notification" in window;
};

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

async function registration() {
  if (
    Capacitor.isNativePlatform() ||
    !("serviceWorker" in navigator) ||
    inPreview()
  ) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    return existing ?? (await navigator.serviceWorker.register("/notify-sw.js"));
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (Capacitor.isNativePlatform()) {
    const granted = await requestNotificationPermissions();
    return granted ? "granted" : "denied";
  }

  if (!notificationsSupported()) return "unsupported";

  try {
    const p = await Notification.requestPermission();
    if (p === "granted") await registration();
    return p;
  } catch {
    return "denied";
  }
}

export async function notify(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    await scheduleBabyReminder({
      title,
      body,
      secondsFromNow: 1,
    });
    return;
  }

  if (!notificationsSupported() || Notification.permission !== "granted") {
    return;
  }

  const reg = await registration();

  const opts = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: title,
  };

  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}

function sentOnce(id: string) {
  const sent: Record<string, 1> = JSON.parse(
    localStorage.getItem(SENT) ?? "{}",
  );

  if (sent[id]) return true;

  const keys = Object.keys(sent).slice(-50);
  const next: Record<string, 1> = {};

  for (const k of keys) next[k] = 1;

  next[id] = 1;
  localStorage.setItem(SENT, JSON.stringify(next));

  return false;
}

// Serializes every scheduling request, including requests from
// AppShell and the reminder settings screen.
let schedulingQueue: Promise<void> = Promise.resolve();

export function scheduleReminders(baby: Baby | null): Promise<void> {
  const task = schedulingQueue
    .catch(() => {})
    .then(() => performScheduleReminders(baby));

  schedulingQueue = task.catch((error) => {
    console.error("Failed to schedule reminders:", error);
  });

  return task;
}

async function performScheduleReminders(baby: Baby | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const settings = loadSettings();

  // Cancel previous reminders before scheduling updated ones.
  await cancelNativeReminders(Object.values(IDS));

  if (!baby) return;

  const hasEnabledReminder =
    settings.vitaminD || settings.feed || settings.wake;

  if (!hasEnabledReminder) return;

  const permitted = await requestNotificationPermissions();
  if (!permitted) return;

  // Android 12+ can require separate permission for exact alarms.
  // Do not open system settings automatically.
  if (Capacitor.getPlatform() === "android") {
    const exactAllowed = await checkExactAlarmPermission();

    if (!exactAllowed) {
      console.warn(
        "Nestling: Exact alarm permission is not granted. " +
        "Reminder delivery may be delayed or scheduling may fail.",
      );
    }
  }

  const now = Date.now();

  // Daily Vitamin D reminder.
  if (settings.vitaminD) {
    const [hours, minutes] = settings.vitaminDTime
      .split(":")
      .map(Number);

    if (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours! >= 0 &&
      hours! <= 23 &&
      minutes! >= 0 &&
      minutes! <= 59
    ) {
      const at = new Date();
      at.setHours(hours!, minutes!, 0, 0);

      if (at.getTime() <= now) {
        at.setDate(at.getDate() + 1);
      }

      await scheduleNativeReminder({
        id: IDS.vitaminD,
        title: "Vitamin D time",
        body: `Time for ${baby.name}'s Vitamin D drops.`,
        at,
        every: "day",
      });
    }
  }

  const recent = await db.logs
    .where("timestamp")
    .aboveOrEqual(now - 2 * 86400000)
    .sortBy("timestamp");

  // Feed reminder.
  if (settings.feed) {
    const lastFeed = [...recent]
      .reverse()
      .find((log) => log.type === "feed");

    if (lastFeed) {
      const at = new Date(
        lastFeed.timestamp + settings.feedHours * 3600000,
      );

      if (at.getTime() > now) {
        await scheduleNativeReminder({
          id: IDS.feed,
          title: "Feed reminder",
          body: `It's been ${settings.feedHours}h since ${baby.name}'s last feed.`,
          at,
        });
      }
    }
  }

  // Wake-window reminder.
  if (settings.wake) {
    const lastSleep = [...recent]
      .reverse()
      .find((log) => log.type === "sleep");

    const range = wakeRangeFor(
      baby.birth_date,
      baby.date_kind,
    );

    if (lastSleep && range) {
      const at = new Date(
        lastSleep.timestamp + (range.min - 10) * 60000,
      );

      if (at.getTime() > now) {
        await scheduleNativeReminder({
          id: IDS.wake,
          title: "Wind-down time",
          body: `${baby.name}'s sleep window opens soon — start winding down.`,
          at,
        });
      }
    }
  }
}

export async function checkReminders(baby: Baby | null) {
  if (!baby) return;

  // Native notifications are scheduled in advance.
  if (Capacitor.isNativePlatform()) return;

  const s = loadSettings();

  if (!notificationsSupported() || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const name = baby.name;

  if (s.vitaminD) {
    const [h, m] = s.vitaminDTime.split(":").map(Number);
    const due = new Date(now);
    due.setHours(h ?? 9, m ?? 0, 0, 0);

    if (now >= due && !sentOnce(`vd-${now.toDateString()}`)) {
      await notify(
        "Vitamin D time",
        `Time for ${name}'s Vitamin D drops.`,
      );
    }
  }

  const recent = await db.logs
    .where("timestamp")
    .aboveOrEqual(Date.now() - 2 * 86400000)
    .sortBy("timestamp");

  const lastFeed = [...recent]
    .reverse()
    .find((log) => log.type === "feed");

  if (
    s.feed &&
    lastFeed &&
    Date.now() - lastFeed.timestamp >= s.feedHours * 3600000 &&
    !sentOnce(`feed-${lastFeed.uid}`)
  ) {
    await notify(
      "Feed reminder",
      `It's been ${s.feedHours}h since ${name}'s last feed.`,
    );
  }

  const lastSleep = [...recent]
    .reverse()
    .find((log) => log.type === "sleep");

  const range = wakeRangeFor(
    baby.birth_date,
    baby.date_kind,
  );

  if (
    s.wake &&
    lastSleep &&
    range &&
    Date.now() - lastSleep.timestamp >= (range.min - 10) * 60000 &&
    !sentOnce(`wake-${lastSleep.uid}`)
  ) {
    await notify(
      "Wind-down time",
      `${name}'s sleep window opens soon — start winding down.`,
    );
  }
}
