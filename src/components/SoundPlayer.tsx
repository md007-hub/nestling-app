import { useEffect, useState } from "react";
import { AudioLines, CloudRain, Lock, Pause, Play, Volume1, Volume2, Waves, Music2, Wind, Fan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePro } from "@/hooks/usePro";
import {
  type NoiseType,
  setMinutes,
  setVolume,
  toggle,
  useSoundEngine,
} from "@/lib/soundEngine";

const NOISES: { id: NoiseType; label: string; blurb: string; Icon: typeof Waves }[] = [
  { id: "white", label: "White Noise", blurb: "Bright, even hiss — like a fan", Icon: AudioLines },
  { id: "lullaby", label: "Gentle Lullaby", blurb: "A soft, repeating melody", Icon: Music2 },
  { id: "pink", label: "Pink Noise", blurb: "Softer, balanced — like steady rain", Icon: CloudRain },
  { id: "brown", label: "Brown Noise", blurb: "Deep rumble — like distant surf", Icon: Waves },
  { id: "vacuum", label: "Vacuum Cleaner", blurb: "Steady low motor hum", Icon: Fan },
  { id: "dryer", label: "Hair Dryer", blurb: "Warm, even rushing air", Icon: Wind },
  { id: "ocean", label: "Ocean Waves", blurb: "Slow swells of surf", Icon: Waves },
  { id: "rain", label: "Soft Rain", blurb: "Gentle patter on the window", Icon: CloudRain },
];

const DURATIONS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "60m", minutes: 60 },
  { label: "∞ Continuous", minutes: 0 },
];

function useRemaining(endsAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.round((endsAt - now) / 1000));
}

export function SoundPlayer() {
  const { active, volume, minutes, endsAt, fading } = useSoundEngine();
  const { isPro, openUpgrade } = usePro();
  const remaining = useRemaining(endsAt);
  const status = !active
    ? "Tap a sound to start"
    : fading
      ? "Fading out…"
      : remaining === null
        ? "Playing continuously"
        : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} left`;

  useEffect(() => {
    if (!isPro && active && active !== "white" && active !== "lullaby") void toggle(active);
  }, [isPro, active]);

  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        {NOISES.map(({ id, label, blurb, Icon }) => {
          const on = active === id;
          const locked = !isPro && id !== "white" && id !== "lullaby";
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() =>
                  locked
                    ? openUpgrade(`${label} is part of Nestling Pro. White Noise and Gentle Lullaby stay free.`)
                    : void toggle(id)
                }
                aria-pressed={on}
                aria-label={`${on ? "Pause" : "Play"} ${label}`}
                className={cn(
                  "tap-card flex w-full items-center gap-4 rounded-full p-3 pr-4 shadow-soft active:scale-[0.98] transition-transform text-left",
                  on ? "bg-lilac ring-1 ring-inset ring-lilac-foreground/25" : "bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    on ? "bg-card text-lilac-foreground" : "bg-sky text-sky-foreground",
                  )}
                >
                  <Icon className={cn("h-6 w-6", on && "animate-pulse")} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block truncate text-base font-bold leading-tight">{label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{blurb}</span>
                </span>
                <span className="relative shrink-0">
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      on ? "bg-lilac-foreground text-card shadow-[0_0_14px_var(--lilac-foreground)]" : "bg-lilac text-lilac-foreground",
                    )}
                  >
                    {on ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5" />
                    )}
                  </span>
                  {locked && (
                    <span
                      aria-label="Pro"
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-lilac-foreground text-card shadow-sm"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-3xl bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">Volume</p>
          <p className="text-sm font-semibold tabular-nums">{Math.round(volume * 100)}%</p>
        </div>
        <div className="flex items-center gap-3">
          <Volume1 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-3 w-full cursor-pointer rounded-full accent-[var(--lilac-foreground)]"
          />
          <Volume2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>

        <p className="mb-2 mt-5 text-sm font-semibold text-muted-foreground">Sleep timer</p>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((d) => (
             <Button
              key={d.label}
              type="button"
               variant="ghost"
              onClick={() => setMinutes(d.minutes)}
              aria-pressed={minutes === d.minutes}
              className={cn(
                "tap-card min-h-12 rounded-full px-1 text-sm font-semibold",
                d.minutes === 0 && "text-xs",
                minutes === d.minutes
                  ? "bg-lilac text-lilac-foreground ring-2 ring-lilac-foreground/30 shadow-[0_0_18px_color-mix(in_oklab,var(--lilac-foreground)_45%,transparent)] hover:bg-lilac"
                  : "bg-sky/60 text-foreground",
              )}
            >
              {d.label}
             </Button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {status}
        </p>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Keeps playing while you switch tabs. Timers fade out gently over 5 seconds.
      </p>
    </div>
  );
}
