
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";
import { UpgradeModal } from "@/components/UpgradeModal";
import { showRewardedAd } from "@/lib/admob";
import { getVerifiedCustomerInfo, checkEntitlement } from "@/lib/purchases";

export type OwnSub = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export const FREE_AI_DAILY = 3;
const TEST_PRO_KEY = "nestling-test-pro";

type ProState = {
  isPro: boolean;
  ownSub: OwnSub | null;
  testPro: boolean;
  canTestPro: boolean;
  setTestPro: (on: boolean) => void;
  aiQuestionsRemaining: number | null;
  bonusClaimedToday: boolean;
  refreshQuota: () => Promise<void>;
  watchRewardedAd: (onReward: () => void | Promise<void>) => void;
  refreshPro: () => Promise<void>;
  openUpgrade: (reason?: string) => void;
};

const g = globalThis as {
  __nestlingProCtx?: React.Context<ProState | null>;
};

const Ctx = (g.__nestlingProCtx ??= createContext<ProState | null>(null));

const fallback: ProState = {
  isPro: false,
  ownSub: null,
  testPro: false,
  canTestPro: false,
  setTestPro: () => {},
  aiQuestionsRemaining: null,
  bonusClaimedToday: false,
  refreshQuota: async () => {},
  watchRewardedAd: () => {},
  refreshPro: async () => {},
  openUpgrade: () => {},
};

export function ProProvider({ children }: { children: ReactNode }) {
  const { user, memberCount } = useFamily();

  const [realPro, setRealPro] = useState(false);
  const [testPro, setTestProState] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [bonusClaimedToday, setBonusClaimedToday] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  // Test PRO is only available during local development.
  const canTestPro = import.meta.env.DEV;
  const isPro = realPro || (canTestPro && testPro);

  // Retained temporarily for compatibility with existing components.
  // Native subscription entitlements are managed through RevenueCat.
  const ownSub: OwnSub | null = null;

  useEffect(() => {
    if (canTestPro) {
      setTestProState(localStorage.getItem(TEST_PRO_KEY) === "1");
    } else {
      setTestProState(false);
    }
  }, [canTestPro]);

  const setTestPro = useCallback((on: boolean) => {
    if (!canTestPro) return;

    localStorage.setItem(TEST_PRO_KEY, on ? "1" : "0");
    setTestProState(on);
  }, [canTestPro]);

  const refreshPro = useCallback(async () => {
    if (!user) {
      setRealPro(false);
      return;
    }

    // RevenueCat is the source of truth for native subscriptions.
    if (Capacitor.isNativePlatform()) {
      try {
        const info = await getVerifiedCustomerInfo(user.id);
        setRealPro(!!info && checkEntitlement(info, "premium"));
      } catch (error) {
        console.error("RevenueCat verification failed:", error);
        setRealPro(false);
      }
      return;
    }

    // Web/PWA purchases are not supported after Stripe removal.
    setRealPro(false);
  }, [user]);

  const refreshQuota = useCallback(async () => {
    if (!user) {
      setRemaining(null);
      setBonusClaimedToday(false);
      return;
    }

    const day = new Date().toISOString().slice(0, 10);

    try {
      const { data, error } = await supabase
        .from("ai_usage")
        .select("count, bonus")
        .eq("user_id", user.id)
        .eq("day", day)
        .maybeSingle();

      if (error) throw error;

      const used = Math.max(0, data?.count ?? 0);
      const bonus = Math.min(3, Math.max(0, data?.bonus ?? 0));

      setBonusClaimedToday(bonus >= 3);
      setRemaining(Math.max(0, FREE_AI_DAILY + bonus - used));
    } catch (error) {
      console.warn("Unable to load Nanny AI allowance:", error);
      setRemaining(null);
      setBonusClaimedToday(false);
    }
  }, [user]);

  const watchRewardedAd = useCallback(async (
    onReward: () => void | Promise<void>
  ) => {
    if (!Capacitor.isNativePlatform()) {
      console.warn("Rewarded ads are only available in the native app.");
      return;
    }

    try {
      const rewarded = await showRewardedAd();
      if (rewarded) {
        await onReward();
      }
    } catch (error) {
      console.error("Rewarded ad failed:", error);
    }
  }, []);

  useEffect(() => {
    void refreshPro();
    void refreshQuota();

    if (!user) return;

    const onFocus = () => {
      void refreshPro();
      void refreshQuota();
    };

    window.addEventListener("focus", onFocus);

    return () => {
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
        bonusClaimedToday,
        refreshQuota,
        watchRewardedAd,
        refreshPro,
        openUpgrade,
      }}
    >
      {children}
      <UpgradeModal
        open={open}
        onOpenChange={setOpen}
        reason={reason}
      />
    </Ctx.Provider>
  );
}

export function usePro() {
  return useContext(Ctx) ?? fallback;
}

export const useSubscription = usePro;
