import { WHO_LMS } from "@/lib/whoLms";

export type Metric = "weight" | "length" | "head";
export type Sex = "boy" | "girl";
export const MAX_MONTHS: Record<Metric, number> = { weight: 60, length: 60, head: 24 };
export const PERCENTILES = [3, 15, 50, 85, 97] as const;
const Z: Record<number, number> = { 3: -1.88079, 15: -1.03643, 50: 0, 85: 1.03643, 97: 1.88079 };

export type GrowthRow = { id: string; baby_id: string; measured_on: string; weight_kg: number | null; length_cm: number | null; head_cm: number | null };

export function ageInMonths(birthDate: string, on: string) {
  const b = new Date(`${birthDate}T12:00:00`).getTime();
  const d = new Date(`${on}T12:00:00`).getTime();
  return (d - b) / (86400000 * 30.4375);
}

function lms(metric: Metric, sex: Sex, months: number): [number, number, number] | null {
  const maxMonths = MAX_MONTHS[metric];
  if (!(months >= 0 && months <= maxMonths)) return null;
  const t = WHO_LMS[metric][sex];
  const i = Math.min(t.length - 2, Math.floor(months));
  const f = months - i;
  const a = t[i]!, b = t[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function valueAt(metric: Metric, sex: Sex, months: number, p: number) {
  const v = lms(metric, sex, months);
  if (!v) return null;
  const [L, M, S] = v;
  const z = Z[p]!;
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

function normCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function percentile(metric: Metric, sex: Sex, months: number, x: number) {
  const v = lms(metric, sex, months);
  if (!v || !(x > 0)) return null;
  const [L, M, S] = v;
  const z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
  return Math.max(0.1, Math.min(99.9, normCdf(z) * 100));
}

export const sexOf = (g?: string | null): Sex | null => (g === "boy" ? "boy" : g === "girl" ? "girl" : null);

export function ordinal(n: number) {
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[r % 10] ?? "th";
  return `${r}${s}`;
}

export const METRIC_LABEL: Record<Metric, string> = { weight: "Weight", length: "Length", head: "Head" };
export const METRIC_KEY: Record<Metric, "weight_kg" | "length_cm" | "head_cm"> = { weight: "weight_kg", length: "length_cm", head: "head_cm" };

/** Latest value + percentile per metric, for badges and the PDF. */
export function latestPercentiles(rows: GrowthRow[], sex: Sex | null, birthDate: string | null) {
  return (["weight", "length", "head"] as Metric[]).flatMap((m) => {
    const row = [...rows].sort((a, b) => b.measured_on.localeCompare(a.measured_on)).find((r) => r[METRIC_KEY[m]] != null);
    if (!row) return [];
    const value = Number(row[METRIC_KEY[m]]);
    const pct = sex && birthDate ? percentile(m, sex, ageInMonths(birthDate, row.measured_on), value) : null;
    return [{ metric: m, value, date: row.measured_on, pct }];
  });
}
