import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Ban, Check, FileText, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/hooks/useFamily";
import { usePro } from "@/hooks/usePro";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { cn } from "@/lib/utils";

const PERKS = [
  { Icon: Sparkles, title: "Unlimited AI Nanny Chat", sub: "Instant 24/7 answers" },
  { Icon: FileText, title: "Unlimited Doctor PDF Exports", sub: "Ready for every pediatric checkup" },
  { Icon: Users, title: "Unlimited Caregiver Sync", sub: "Invite nannies, partners & family" },
  { Icon: Ban, title: "100% Ad-Free experience", sub: "No sponsor messages, ever" },
];

type Plan = "pro_monthly" | "pro_yearly" | "pro_lifetime";

const PLANS: { id: Plan; title: string; price: string; per: string; note: string; badge?: string }[] = [
  { id: "pro_monthly", title: "Monthly", price: "$5.99", per: "/ mo", note: "7-day free trial" },
  { id: "pro_yearly", title: "Annual", price: "$34.99", per: "/ yr", note: "Save 50%", badge: "Best Value" },
  { id: "pro_lifetime", title: "Lifetime", price: "$69.99", per: "once", note: "One-time purchase" },
];

const CTA: Record<Plan, string> = {
  pro_monthly: "Start 7-Day Free Trial",
  pro_yearly: "Upgrade — $34.99 / year",
  pro_lifetime: "Get Lifetime — $69.99",
};

function Checkout({ priceId }: { priceId: Plan }) {
  const fetchClientSecret = async () => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout did not start");
    return result.clientSecret;
  };
  return (
    <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reason?: string | undefined;
}) {
  const { user } = useFamily();
  const { canTestPro, setTestPro } = usePro();
  const [plan, setPlan] = useState<Plan>("pro_yearly");
  const [checkout, setCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setCheckout(false);
      setError(null);
    }
  };

  const start = () => {
    try {
      getStripeEnvironment();
      setCheckout(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        {checkout ? (
          <div className="-mx-2 pt-6">
            <Checkout priceId={plan} />
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Nestling PRO
              </span>
              <DialogTitle className="font-display text-2xl">Support your family with PRO</DialogTitle>
              {reason && <DialogDescription>{reason}</DialogDescription>}
            </DialogHeader>

            <ul className="space-y-2.5">
              {PERKS.map(({ Icon, title, sub }) => (
                <li key={title} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-muted-foreground">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Plan">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={plan === p.id}
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "relative rounded-2xl border p-2.5 pt-5 text-left transition-colors active:scale-[0.98]",
                    plan === p.id ? "border-primary bg-primary/10" : "border-border bg-card",
                  )}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {p.badge}
                    </span>
                  )}
                  <span className="block text-xs font-semibold text-muted-foreground">{p.title}</span>
                  <span className="block text-lg font-bold leading-tight">{p.price}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.per}</span>
                  <span className="mt-1 block text-[10px] font-medium leading-tight text-primary">{p.note}</span>
                  {plan === p.id && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>

            {user ? (
              <Button onClick={start} className="h-14 w-full text-base font-semibold">
                {CTA[plan]}
              </Button>
            ) : (
              <Button asChild className="h-14 w-full text-base font-semibold" onClick={() => close(false)}>
                <Link to="/auth">Sign in to upgrade</Link>
              </Button>
            )}
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            {canTestPro && (
              <Button
                variant="ghost"
                className="h-10 w-full text-xs text-muted-foreground"
                onClick={() => {
                  setTestPro(true);
                  close(false);
                }}
              >
                Test mode: switch PRO on without paying
              </Button>
            )}
            <p className="rounded-2xl bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Always Free:</span> Full lifetime history & 2 caregiver sync included.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
