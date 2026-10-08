import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { QuickActions } from "@/components/tracker/QuickActions";
import { DailySummary } from "@/components/tracker/DailySummary";
import { Timeline } from "@/components/tracker/Timeline";
import { Insights } from "@/components/tracker/Insights";
import { useHydrated } from "@/hooks/useOnline";
import { Link } from "@tanstack/react-router";
import { useFamily } from "@/hooks/useFamily";
import { IntroductionCarousel } from "@/components/IntroductionCarousel";

function SyncBanner() {
  const { ready, user, baby } = useFamily();
  if (!ready || !user || baby) return null;
  return (
    <Link to={user ? "/onboarding" : "/auth"} className="mb-4 block rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-soft">
      <span className="font-semibold">{user ? "Create or join a baby profile" : "Sign in to sync"}</span>
      <span className="block text-muted-foreground">{user ? "Share logs with your partner in real time." : "Back up your logs and share them across phones."}</span>
    </Link>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tracker — Nestling" },
      {
        name: "description",
        content:
          "One-tap feed, diaper and sleep tracking for new parents. Works fully offline on your phone.",
      },
      { property: "og:title", content: "Tracker — Nestling" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "One-tap feed, diaper and sleep tracking that works fully offline.",
      },
    ],
  }),
  component: TrackerPage,
});

function TrackerPage() {
  const hydrated = useHydrated();
  const { ready, user, baby, babiesLoaded } = useFamily();
  const navigate = useNavigate();
  useEffect(() => {
    if (hydrated && ready && user && babiesLoaded && !baby) navigate({ to: "/onboarding", replace: true });
  }, [hydrated, ready, user, baby, babiesLoaded, navigate]);

  if (!hydrated || !ready || (user && !babiesLoaded)) return <div className="h-80 animate-pulse rounded-md bg-muted/60" />;
  if (!user) return <IntroductionCarousel />;
  if (!baby) return null;

  return (
    <div>
      <SyncBanner />
      <DailySummary />
      <QuickActions />
      <Insights />
      <Timeline />
    </div>
  );
}
