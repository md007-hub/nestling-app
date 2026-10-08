import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { tryStripeEnvironment } from "@/lib/stripe";
import { UpgradeModal } from "@/components/UpgradeModal";

export type OwnSub = { status: string; price_id: string; current_period_end: string | null; cancel_at_period_end: boolean | null };

export const FREE_AI_DAILY = 3;
const TEST_PRO_KEY = "nestling-test-pro";

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type ProState = {
  isPro: boolean;
  ownSub: OwnSub | null;
  /** Preview/test mode only: Pro switched on locally without paying. */
  testPro: boolean;
  canTestPro: boolean;
  setTestPro: (on: boolean) => void;
  aiQuestionsRemaining: number | null;
  refreshQuota: () => Promise<void>;
  consumeQuestion: () => Promise<boolean>;
  grantAiBonus: () => Promise<void>;
  watchRewardedAd: (onReward: () => void | Promise<void>) => void;
  refreshPro: () => Promise<void>;
  openUpgrade: (reason?: string) => void;
};

const g = globalThis as { __nestlingProCtx?: React.Context<ProState | null> };
const Ctx = (g.__nestlingProCtx ??= createContext<ProState | null>(null));

const fallback: ProState = {
  isPro: false,
  ownSub: null,
  testPro: false,
  canTestPro: false,
  setTestPro: () => {},
  aiQuestionsRemaining: null,
  refreshQuota: async () => {},
  consumeQuestion: async () => false,
  grantAiBonus: async () => {},
  watchRewardedAd: () => {},
  refreshPro: async () => {},
  openUpgrade: () => {},
};

export function ProProvider({ children }: { children: ReactNode }) {
  const { user, memberCount } = useFamily();
  const [realPro, setRealPro] = useState(false);
  const [ownSub, setOwnSub] = useState<OwnSub | null>(null);
  const [testPro, setTestProState] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [adPlaying, setAdPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  const canTestPro = tryStripeEnvironment() === "sandbox";
  const isPro = realPro || (canTestPro && testPro);

  useEffect(() => {
    if (canTestPro) setTestProState(localStorage.getItem(TEST_PRO_KEY) === "1");
  }, [canTestPro]);

  const setTestPro = useCallback((on: boolean) => {
    localStorage.setItem(TEST_PRO_KEY, on ? "1" : "0");
    setTestProState(on);
  }, []);

  const refreshPro = useCallback(async () => {
    const env = tryStripeEnvironment();
    if (!user || !env) {
      setRealPro(false);
      setOwnSub(null);
      return;
    }
    const [{ data: pro }, { data: sub }] = await Promise.all([
      supabase.rpc("has_family_pro", { check_env: env }),
      supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setRealPro(!!pro);
    setOwnSub(sub ?? null);
  }, [user]);

  const refreshQuota = useCallback(async () => {
    const day = todayKey();
    if (user) {
      const { data } = await supabase.from("ai_usage").select("count, bonus").eq("user_id", user.id).eq("day", day).maybeSingle();
      setRemaining(Math.max(0, FREE_AI_DAILY + (data?.bonus ?? 0) - (data?.count ?? 0)));
    } else {
      const used = Number(localStorage.getItem(`nestling-ai-${day}`) ?? 0);
      const bonus = Number(localStorage.getItem(`nestling-ai-bonus-${day}`) ?? 0);
      setRemaining(Math.max(0, FREE_AI_DAILY + bonus - used));
    }
  }, [user]);

  const consumeQuestion = useCallback(async () => {
    if (isPro) return true;
    const day = todayKey();
    if (user) {
      const { data, error } = await supabase.rpc("consume_ai_question", {
        check_env: tryStripeEnvironment() ?? "sandbox",
        _day: day,
      });
      if (error) return false;
      const res = data as { allowed?: boolean; remaining?: number | null } | null;
      if (typeof res?.remaining === "number") setRemaining(res.remaining);
      return !!res?.allowed;
    }
    const used = Number(localStorage.getItem(`nestling-ai-${day}`) ?? 0);
    const bonus = Number(localStorage.getItem(`nestling-ai-bonus-${day}`) ?? 0);
    if (used >= FREE_AI_DAILY + bonus) return false;
    localStorage.setItem(`nestling-ai-${day}`, String(used + 1));
    setRemaining(FREE_AI_DAILY + bonus - used - 1);
    return true;
  }, [isPro, user]);

  const grantAiBonus = useCallback(async () => {
    const day = todayKey();
    if (user) {
      await supabase.rpc("grant_ai_bonus", { _day: day });
    } else {
      const k = `nestling-ai-bonus-${day}`;
      localStorage.setItem(k, String(Number(localStorage.getItem(k) ?? 0) + 3));
    }
    await refreshQuota();
  }, [user, refreshQuota]);

  const watchRewardedAd = useCallback((onReward: () => void | Promise<void>) => {
    setAdPlaying(true);
    window.setTimeout(() => {
      setAdPlaying(false);
      void onReward();
    }, 2000);
  }, []);

  useEffect(() => {
    void refreshPro();
    void refreshQuota();
    if (!user) return;
    const channel = supabase
      .channel(`subs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void refreshPro())
      .subscribe();
    const onFocus = () => {
      void refreshPro();
      void refreshQuota();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, memberCount, refreshPro, refreshQuota]);

  const openUpgrade = useCallback((r?: string) => {
    setReason(r);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider
      value={{
        isPro,
        ownSub,
        testPro,
        canTestPro,
        setTestPro,
        aiQuestionsRemaining: remaining,
        refreshQuota,
        consumeQuestion,
        grantAiBonus,
        watchRewardedAd,
        refreshPro,
        openUpgrade,
      }}
    >
      {children}
      <UpgradeModal open={open} onOpenChange={setOpen} reason={reason} />
      {adPlaying && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-8 py-6 shadow-soft">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Playing quick sponsor message…</p>
            <p className="text-xs text-muted-foreground">Muted · 2 seconds</p>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function usePro() {
  return useContext(Ctx) ?? fallback;
}

export const useSubscription = usePro;
