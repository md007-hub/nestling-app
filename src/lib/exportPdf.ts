import { db, type LogEntry } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { latestPercentiles, ordinal, sexOf, type GrowthRow } from "@/lib/growth";
import { labelOf } from "@/lib/milestones";

/** Parses stored durations: "HH:MM:SS", "MM:SS", or plain seconds. Returns seconds or null. */
export function parseDurationSec(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    const parts = s.split(":").map(Number);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const fmtDur = (sec: number) => {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const mlOf = (v: string) => {
  const ml = /(\d+(?:\.\d+)?)\s*ml/i.exec(v);
  if (ml) return Number(ml[1]);
  const oz = /(\d+(?:\.\d+)?)\s*oz/i.exec(v);
  return oz ? Number(oz[1]) * 29.5735 : 0;
};

/** Removes emoji and non-Latin-1 symbols the built-in PDF font cannot render. */
const clean = (t: string) =>
  t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u00B7]/g, "").replace(/\s{2,}/g, " ").trim();

const CATEGORY: Record<string, string> = { feed: "Feed", diaper: "Diaper", sleep: "Sleep", tummy: "Tummy time", pumping: "Pumping", solids: "Solids" };

function details(e: LogEntry) {
  if (e.type === "sleep" || e.type === "tummy") {
    const sec = parseDurationSec(e.notes);
    return `${e.value} · ${sec === null ? "Ongoing" : fmtDur(sec)}`;
  }
  if ((e.type === "feed" || e.type === "pumping") && e.notes) {
    const sec = parseDurationSec(e.notes);
    return sec === null ? e.value : `${e.value} · ${fmtDur(sec)}`;
  }
  return e.notes ? `${e.value} — ${e.notes}` : e.value;
}

/** Builds a doctor-friendly PDF of the last `days` days of logs and downloads it. */
export async function exportDoctorPdf(babyName: string | null, days = 7) {
  const { jsPDF } = await import("jspdf");
  const since = Date.now() - days * 86400000;
  const logs = await db.logs.where("timestamp").above(since).sortBy("timestamp");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(30);
  doc.text(`Care report${babyName ? ` - ${clean(babyName)}` : ""}`, M, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(`Period: ${new Date(since).toLocaleDateString()} – ${new Date().toLocaleDateString()}`, M, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - M, y, { align: "right" });
  y += 22;

  // Summary card
  const feeds = logs.filter((l) => l.type === "feed");
  const ml = Math.round(feeds.reduce((s, l) => s + mlOf(l.value), 0));
  const sleepSec = logs.filter((l) => l.type === "sleep").reduce((s, l) => s + (parseDurationSec(l.notes) ?? 0), 0);
  const diapers = logs.filter((l) => l.type === "diaper");
  const count = (k: string) => diapers.filter((d) => d.value.toLowerCase().startsWith(k)).length;
  let growthMain = "Not recorded";
  let growthSub = "Add measurements in Growth";
  try {
    const babyId = localStorage.getItem("nestling-baby-id");
    if (babyId) {
      const [{ data: b }, { data: g }] = await Promise.all([
        supabase.from("babies").select("gender, birth_date").eq("id", babyId).maybeSingle(),
        supabase.from("baby_growth").select("*").eq("baby_id", babyId),
      ]);
      const latest = latestPercentiles((g ?? []) as GrowthRow[], sexOf(b?.gender), b?.birth_date ?? null);
      const w = latest.find((l) => l.metric === "weight") ?? latest[0];
      if (w) {
        const unit = { weight: "kg", length: "cm", head: "cm" } as const;
        growthMain = `${w.value} ${unit[w.metric]}${w.pct != null ? ` (${ordinal(w.pct)})` : ""}`;
        growthSub = latest.filter((l) => l !== w).map((l) => `${l.metric === "head" ? "Head" : "Length"} ${l.value}${unit[l.metric]}${l.pct != null ? ` ${ordinal(l.pct)}` : ""}`).join(" / ") || `${w.metric} on ${w.date}`;
      }
    }
  } catch { /* growth is optional */ }

  const cells: [string, string, string][] = [
    ["Feeds", `${feeds.length} feeds (${(feeds.length / days).toFixed(1)}/day)`, ml ? `${ml} ml (${(ml / 29.5735).toFixed(1)} oz)` : "No bottle volume"],
    ["Sleep", fmtDur(sleepSec), `Avg ${fmtDur(Math.round(sleepSec / days))} per 24h · ${logs.filter((l) => l.type === "sleep").length} sleeps`],
    ["Diapers", `${diapers.length} total (${(diapers.length / days).toFixed(1)}/day)`, `Wet ${count("wet")} / Poop ${count("dirty") + count("poop")} / Mixed ${count("both") + count("mixed")}`],
    ["Growth & percentile", growthMain, growthSub],
  ];
  const gap = 10;
  const cw = (W - 2 * M - gap) / 2;
  const cardH = 58;
  cells.forEach(([label, main, sub], i) => {
    const x = M + (i % 2) * (cw + gap);
    const cy = y + Math.floor(i / 2) * (cardH + gap);
    doc.setFillColor(245, 243, 238).setDrawColor(225).roundedRect(x, cy, cw, cardH, 6, 6, "FD");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120).text(label.toUpperCase(), x + 12, cy + 16);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(30).text(doc.splitTextToSize(clean(main), cw - 24)[0] as string, x + 12, cy + 34);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90).text(doc.splitTextToSize(clean(sub), cw - 24)[0] as string, x + 12, cy + 48);
  });
  y += cardH * 2 + gap + 24;

  // Recent milestones
  try {
    const babyId = localStorage.getItem("nestling-baby-id");
    if (babyId) {
      const { data: ms } = await supabase.from("baby_milestones").select("milestone_key, achieved_at, note").eq("baby_id", babyId).order("achieved_at", { ascending: false }).limit(8);
      if (ms?.length) {
        doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30).text("Recent Milestones Achieved", M, y);
        y += 16;
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
        for (const m of ms) {
          const label = labelOf(m.milestone_key);
          if (!label) continue;
          const line = `${new Date(m.achieved_at).toLocaleDateString()}  -  ${label}${m.note ? ` (${m.note})` : ""}`;
          const lines = doc.splitTextToSize(clean(line), W - 2 * M) as string[];
          doc.text(lines, M, y);
          y += lines.length * 12;
        }
        y += 16;
      }
    }
  } catch { /* milestones are optional */ }

  // Table
  const cols = [
    { label: "Time", x: M + 8, w: 60 },
    { label: "Category", x: M + 78, w: 70 },
    { label: "Details", x: M + 158, w: W - 2 * M - 158 - 90 },
    { label: "Logged by", x: W - M - 70, w: 62 },
  ];
  const rowH = 20;
  const tableHeader = () => {
    doc.setFillColor(55, 65, 81).rect(M, y, W - 2 * M, rowH, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255);
    cols.forEach((c) => doc.text(c.label, c.x, y + 13.5));
    y += rowH;
  };
  const ensure = (need: number, withHeader: boolean) => {
    if (y + need > H - 56) {
      doc.addPage();
      y = 56;
      if (withHeader) tableHeader();
    }
  };

  if (!logs.length) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90).text("No entries logged in this period.", M, y);
  }

  const byDay = new Map<string, LogEntry[]>();
  for (const l of logs) {
    const k = new Date(l.timestamp).toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  }

  for (const [day, entries] of [...byDay.entries()].reverse()) {
    ensure(rowH * 3 + 22, false);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30).text(day, M, y + 10);
    y += 18;
    tableHeader();
    entries.forEach((e, i) => {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
      const row = [
        new Date(e.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        CATEGORY[e.type] ?? e.type,
        details(e),
        "Parent",
      ].map((t, ci) => doc.splitTextToSize(clean(t), cols[ci]!.w) as string[]);
      const h = Math.max(rowH, 8 + Math.max(...row.map((r) => r.length)) * 11);
      ensure(h, true);
      if (i % 2 === 0) doc.setFillColor(248, 247, 244).rect(M, y, W - 2 * M, h, "F");
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
      row.forEach((lines, ci) => doc.text(lines, cols[ci]!.x, y + 13.5, { lineHeightFactor: 1.2 }));
      y += h;
    });
    doc.setDrawColor(220).line(M, y, W - M, y);
    y += 20;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text("Parent-logged data from Nestling. Not a medical record.", M, H - 28);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 28, { align: "right" });
  }

  doc.save(`nestling-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Downloads every local log as a CSV. Sleep rows include start and end ISO times (start = end - duration). */
export async function exportLogsCsv() {
  const logs = await db.logs.orderBy("timestamp").toArray();
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["type", "value", "notes", "start_iso", "end_iso", "duration_minutes", "summary_date"].join(",")];
  for (const l of logs) {
    const sec = l.type === "sleep" || l.type === "tummy" || l.type === "pumping" || l.type === "feed" ? parseDurationSec(l.notes) : null;
    const end = new Date(l.timestamp);
    const start = sec ? new Date(l.timestamp - sec * 1000) : null;
    rows.push([l.type, l.value, l.notes, start?.toISOString() ?? "", end.toISOString(), sec ? Math.round(sec / 60) : "", end.toLocaleDateString("en-CA")].map(esc).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nestling-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
