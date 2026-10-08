import { createFileRoute } from "@tanstack/react-router";
import { SoundPlayer } from "@/components/SoundPlayer";
import { useHydrated } from "@/hooks/useOnline";

export const Route = createFileRoute("/sounds")({
  head: () => ({
    meta: [
      { title: "Soothing Sounds — Nestling" },
      {
        name: "description",
        content:
           "Eight soothing sounds generated right on your phone, with 15, 30 and 60 minute sleep timers.",
      },
      { property: "og:title", content: "Soothing Sounds — Nestling" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
         content: "White noise, lullaby and six more soothing sounds with sleep timers — works offline.",
      },
    ],
  }),
  component: SoundsPage,
});

function SoundsPage() {
  const hydrated = useHydrated();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Soothing sounds</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Generated on your phone — no downloads, works offline.
      </p>
      {hydrated ? <SoundPlayer /> : <div className="h-64 animate-pulse rounded-3xl bg-muted/60" />}
    </div>
  );
}
