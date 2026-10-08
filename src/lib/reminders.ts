// Device-local reminders (Vitamin D, feed interval, wake window) shown as notifications.
import { db } from "@/lib/db";
import { wakeRangeFor } from "@/lib/wakeWindow";
import type { Baby } from "@/hooks/useFamily";

export type ReminderSettings = {
  vitaminD: boolean;
  vitaminDTime: string; // "HH:MM"
  feed: boolean;
  feedHours: number;
  wake: boolean;
};
const KEY = "nestling-reminders";
const SENT = "nestling-reminders-sent";
export const defaultSettings: ReminderSettings = { vitaminD: false, vitaminDTime: "09:00", feed: false, feedHours: 3, wake: false };

export function loadSettings(): ReminderSettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return defaultSettings; }
}
export function saveSettings(s: ReminderSettings) { localStorage.setItem(KEY, JSON.stringify(s)); }

const inPreview = () => {
  try { return window.self !== window.top || /id-preview--|lovableproject\.com/.test(location.hostname); } catch { return true; }
};

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registration() {
  if (!("serviceWorker" in navigator) || inPreview()) return null;
  try {
    // Reuse the offline worker (it imports the notification handlers) instead of replacing it.
    const existing = await navigator.serviceWorker.getRegistration("/");
    return existing ?? (await navigator.serviceWorker.register("/notify-sw.js"));
  } catch { return null; }
}

export async function requestPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  const p = await Notification.requestPermission();
  if (p === "granted") await registration();
  return p;
}

export async function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await registration();
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: title };
  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}

function sentOnce(id: string) {
  const sent: Record<string, 1> = JSON.parse(localStorage.getItem(SENT) ?? "{}");
  if (sent[id]) return true;
  const keys = Object.keys(sent).slice(-50);
  const next: Record<string, 1> = {};
  for (const k of keys) next[k] = 1;
  next[id] = 1;
  localStorage.setItem(SENT, JSON.stringify(next));
  return false;
}

export async function checkReminders(baby: Baby | null) {
  const s = loadSettings();
  if (!baby || Notification.permission !== "granted") return;
  const now = new Date();
  const name = baby.name;
  if (s.vitaminD) {
    const [h, m] = s.vitaminDTime.split(":").map(Number);
    const due = new Date(now); due.setHours(h ?? 9, m ?? 0, 0, 0);
    if (now >= due && !sentOnce(`vd-${now.toDateString()}`)) await notify("Vitamin D time", `Time for ${name}'s Vitamin D drops.`);
  }
  const recent = await db.logs.where("timestamp").aboveOrEqual(Date.now() - 2 * 86400000).sortBy("timestamp");
  const lastFeed = [...recent].reverse().find((l) => l.type === "feed");
  if (s.feed && lastFeed && Date.now() - lastFeed.timestamp >= s.feedHours * 3600000 && !sentOnce(`feed-${lastFeed.uid}`)) {
    await notify("Feed reminder", `It's been ${s.feedHours}h since ${name}'s last feed.`);
  }
  const lastSleep = [...recent].reverse().find((l) => l.type === "sleep");
  const range = wakeRangeFor(baby.birth_date, baby.date_kind);
  if (s.wake && lastSleep && range && Date.now() - lastSleep.timestamp >= (range.min - 10) * 60000 && !sentOnce(`wake-${lastSleep.uid}`)) {
    await notify("Wind-down time", `${name}'s sleep window opens soon — start winding down.`);
  }
}
