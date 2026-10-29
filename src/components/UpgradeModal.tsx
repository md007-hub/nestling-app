import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Check, FileText, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/hooks/useFamily";
import { usePro } from "@/hooks/usePro";
import { getOfferings, purchasePackage, restorePurchases } from "@/lib/purchases";
import { cn } from "@/lib/utils";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

const PERKS = [
  { Icon: Sparkles, title: "20 Nanny AI Questions Daily", sub: "Helpful parenting guidance every day" },
  { Icon: FileText, title: "Unlimited Doctor PDF Exports", sub: "Ready for every pediatric checkup" },
  { Icon: Users, title: "Unlimited Caregiver Sync", sub: "Invite nannies, partners & family" },
  { Icon: Ban, title: "100% Ad-Free experience", sub: "No sponsor messages, ever" },
];

type PlanId = "pro_monthly" | "pro_yearly";

interface DisplayPlan {
  id: PlanId;
  title: string;
  price: string;
  per: string;
  note: string;
  badge?: string;
  rcPackage?: PurchasesPackage;
}

const DEFAULT_PLANS: DisplayPlan[] = [
  { id: "pro_monthly", title: "Monthly", price: "A$7.99", per: "/ mo", note: "7-day free trial" },
  { id: "pro_yearly", title: "Annual", price: "A$59.99", per: "/ yr", note: "Save 37%", badge: "Best Value" },
];

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
  const { canTestPro, setTestPro, refreshPro } = usePro();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("pro_yearly");
  const [plans, setPlans] = useState<DisplayPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      return;
    }

    async function loadOfferings() {
      try {
        const currentOffering = await getOfferings();
        if (currentOffering?.availablePackages?.length) {
          const mapped = DEFAULT_PLANS.map((defaultPlan) => {
            const found = currentOffering.availablePackages.find((pkg) => {
              const id = pkg.identifier.toLowerCase();
              if (defaultPlan.id === "pro_monthly") return id.includes("month");
              if (defaultPlan.id === "pro_yearly") return id.includes("year") || id.includes("annual");
              return false;
            });

            if (found) {
              return {
                ...defaultPlan,
                price: found.product.priceString,
                rcPackage: found,
              };
            }
            return defaultPlan;
          });
          setPlans(mapped);
        }
      } catch (e) {
        console.error("Failed to load RevenueCat offerings", e);
      }
    }

    loadOfferings();
  }, [open]);

  const handlePurchase = async () => {
    const active = plans.find((p) => p.id === selectedPlan);
    if (!active?.rcPackage) {
      setMessage({ type: "error", text: "Package configuration unavailable. Please try again shortly." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const success = await purchasePackage(active.rcPackage);
      if (success) {
        await refreshPro?.();
        setMessage({ type: "success", text: "Upgrade successful! Welcome to Nestling PRO." });
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        setMessage({ type: "error", text: "Purchase could not be completed." });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred during checkout." });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const isRestored = await restorePurchases();
      if (isRestored) {
        await refreshPro?.();
        setMessage({ type: "success", text: "Purchases successfully restored!" });
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        setMessage({ type: "error", text: "No active subscriptions found to restore." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to restore purchases." });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-md">
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

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selectedPlan === p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={cn(
                "relative rounded-2xl border p-2.5 pt-5 text-left transition-colors active:scale-[0.98]",
                selectedPlan === p.id ? "border-primary bg-primary/10" : "border-border bg-card",
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
              {selectedPlan === p.id && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>

        {user ? (
          <Button onClick={handlePurchase} disabled={loading || restoring} className="h-14 w-full text-base font-semibold">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedPlan === "pro_monthly" && "Start 7-Day Free Trial"}
            {selectedPlan === "pro_yearly" && "Upgrade to PRO Annual"}
          </Button>
        ) : (
          <Button asChild className="h-14 w-full text-base font-semibold" onClick={() => onOpenChange(false)}>
            <Link to="/auth">Sign in to upgrade</Link>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={loading || restoring}
          onClick={handleRestore}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-medium"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", restoring && "animate-spin")} />
          Restore Purchases
        </Button>

        {message && (
          <p
            className={cn(
              "text-center text-xs font-medium",
              message.type === "success" ? "text-primary" : "text-destructive",
            )}
          >
            {message.text}
          </p>
        )}

        {canTestPro && (
          <Button
            variant="ghost"
            className="h-10 w-full text-xs text-muted-foreground"
            onClick={() => {
              setTestPro(true);
              onOpenChange(false);
            }}
          >
            Test mode: switch PRO on without paying
          </Button>
        )}

        <p className="rounded-2xl bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Always Free:</span> Full lifetime history & 2 caregiver sync included.
        </p>
      </DialogContent>
    </Dialog>
  );
}
