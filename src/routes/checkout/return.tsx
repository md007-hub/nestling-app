import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePro } from "@/hooks/usePro";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Welcome to Nestling Pro" },
      { name: "description", content: "Your Nestling Pro free trial has started." },
      { property: "og:title", content: "Welcome to Nestling Pro" },
      { property: "og:description", content: "Your Nestling Pro free trial has started." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const { refreshPro } = usePro();
  useEffect(() => {
    const t = setTimeout(() => void refreshPro(), 2500);
    void refreshPro();
    return () => clearTimeout(t);
  }, [refreshPro]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
      <h1 className="mt-3 font-display text-2xl font-bold">
        {session_id ? "Your free trial has started" : "Nothing to show here"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {session_id
          ? "Pro is now unlocked for you and your partner. You won't be charged for 7 days."
          : "No checkout details found."}
      </p>
      <Button asChild className="mt-5 h-12 w-full text-base">
        <Link to="/">Back to tracker</Link>
      </Button>
    </div>
  );
}
