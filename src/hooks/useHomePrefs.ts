import { useEffect, useState } from "react";

export type HomePrefs = { pumping: boolean; notes: boolean; growth: boolean; milestones: boolean };
const KEY = "nestling-home-prefs";
const DEFAULTS: HomePrefs = { pumping: true, notes: true, growth: true, milestones: true };

function read(): HomePrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

/** Per-device home layout toggles (Edit Home sheet). */
export function useHomePrefs() {
  const [prefs, setPrefs] = useState<HomePrefs>(DEFAULTS);
  useEffect(() => {
    const sync = () => setPrefs(read());
    sync();
    window.addEventListener("nestling-home-prefs", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nestling-home-prefs", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const set = (k: keyof HomePrefs, v: boolean) => {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [k]: v }));
    window.dispatchEvent(new Event("nestling-home-prefs"));
  };
  return [prefs, set] as const;
}

export type ActionKey = "sleep" | "feed" | "diaper" | "pumping" | "tummy" | "notes";
export const ACTION_LABELS: Record<ActionKey, string> = { sleep: "Sleep", feed: "Feed", diaper: "Diaper", pumping: "Pumping", tummy: "Tummy Time", notes: "Notes" };
const ORDER_KEY = "nestling-action-order";
const DEFAULT_ORDER: ActionKey[] = ["sleep", "feed", "diaper", "pumping", "tummy", "notes"];
const ORDER_CLASS = ["order-1", "order-2", "order-3", "order-4", "order-5", "order-6"];

function readOrder(): ActionKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as ActionKey[];
    const valid = saved.filter((k) => DEFAULT_ORDER.includes(k));
    return [...new Set([...valid, ...DEFAULT_ORDER])];
  } catch {
    return DEFAULT_ORDER;
  }
}

/** Per-device order of the home action stack. */
export function useActionOrder() {
  const [order, setOrder] = useState<ActionKey[]>(DEFAULT_ORDER);
  useEffect(() => {
    const sync = () => setOrder(readOrder());
    sync();
    window.addEventListener("nestling-action-order", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nestling-action-order", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const move = (k: ActionKey, dir: -1 | 1) => {
    const cur = readOrder();
    const i = cur.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= cur.length) return;
    const a = cur[i]!; cur[i] = cur[j]!; cur[j] = a;
    localStorage.setItem(ORDER_KEY, JSON.stringify(cur));
    window.dispatchEvent(new Event("nestling-action-order"));
  };
  const orderClass = (k: ActionKey) => ORDER_CLASS[order.indexOf(k)] ?? "order-6";
  return { order, move, orderClass };
}
