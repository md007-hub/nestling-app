// Typical awake-time ranges by age (general guidance, not medical advice).
const TABLE: Array<[maxWeeks: number, min: number, max: number, label: string]> = [
  [4, 35, 60, "0–4 weeks"],
  [12, 60, 90, "1–3 months"],
  [20, 75, 120, "3–5 months"],
  [30, 120, 180, "5–7 months"],
  [43, 150, 210, "7–10 months"],
  [56, 180, 240, "10–13 months"],
  [78, 240, 330, "13–18 months"],
  [9999, 300, 360, "18+ months"],
];

export type WakeRange = { min: number; max: number; label: string };

export function wakeRangeFor(birthDate: string | null | undefined, dateKind?: string): WakeRange | null {
  if (!birthDate || dateKind === "due") return null;
  const weeks = (Date.now() - new Date(`${birthDate}T12:00:00`).getTime()) / (7 * 86400000);
  if (!Number.isFinite(weeks) || weeks < 0) return null;
  const row = TABLE.find((r) => weeks < r[0])!;
  return { min: row[1], max: row[2], label: row[3] };
}

export type WakeStatus = "early" | "soon" | "now" | "over";
export function wakeStatus(awakeMin: number, r: WakeRange): WakeStatus {
  if (awakeMin < r.min - 15) return "early";
  if (awakeMin < r.min) return "soon";
  if (awakeMin <= r.max) return "now";
  return "over";
}
