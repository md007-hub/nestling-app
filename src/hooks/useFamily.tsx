import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setLocalChangeListener } from "@/lib/db";
import { subscribeBaby, syncNow } from "@/lib/sync";

export type Baby = { id: string; name: string; invite_code: string; birth_date: string | null; date_kind: string; gender: string | null; birth_weight_kg: number | null; solids_enabled: boolean; milestones_enabled: boolean; photo_url: string | null };

type FamilyState = {
  ready: boolean;
  babiesLoaded: boolean;
  user: User | null;
  babies: Baby[];
  baby: Baby | null;
  memberCount: number;
  selectBaby: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Keep one context instance across hot reloads so providers and consumers always match.
const g = globalThis as { __nestlingFamilyCtx?: React.Context<FamilyState | null> };
const Ctx = (g.__nestlingFamilyCtx ??= createContext<FamilyState | null>(null));

const fallback: FamilyState = {
  ready: false,
  babiesLoaded: false,
  user: null,
  babies: [],
  baby: null,
  memberCount: 0,
  selectBaby: () => {},
  refresh: async () => {},
  signOut: async () => {},
};
const KEY = "nestling-baby-id";

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [babiesLoaded, setBabiesLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyId, setBabyId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);

  const refresh = useCallback(async () => {
    setBabiesLoaded(false);
    const { data } = await supabase.from("babies").select("id, name, invite_code, birth_date, date_kind, gender, birth_weight_kg, solids_enabled, milestones_enabled, photo_url").order("created_at");
    const list = data ?? [];
    setBabies(list);
    const stored = localStorage.getItem(KEY);
    const pick = list.find((b) => b.id === stored) ?? list[0] ?? null;
    setBabyId(pick?.id ?? null);
    if (pick) localStorage.setItem(KEY, pick.id);
    setBabiesLoaded(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) refresh();
    else {
      setBabies([]);
      setBabyId(null);
      setBabiesLoaded(false);
    }
  }, [user, refresh]);

  // Sync + realtime for the active baby.
  useEffect(() => {
    if (!babyId) {
      setLocalChangeListener(null);
      return;
    }
    const run = () => syncNow(babyId).catch((e) => console.warn("Sync failed", e));
    run();
    setLocalChangeListener(run);
    const channel = subscribeBaby(babyId);
    window.addEventListener("online", run);
    supabase
      .from("baby_members")
      .select("user_id", { count: "exact", head: true })
      .eq("baby_id", babyId)
      .then(({ count }) => setMemberCount(count ?? 1));
    return () => {
      setLocalChangeListener(null);
      window.removeEventListener("online", run);
      supabase.removeChannel(channel);
    };
  }, [babyId]);

  const selectBaby = (id: string) => {
    localStorage.setItem(KEY, id);
    setBabyId(id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(KEY);
  };

  const baby = babies.find((b) => b.id === babyId) ?? null;

  return (
    <Ctx.Provider value={{ ready, babiesLoaded, user, babies, baby, memberCount, selectBaby, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFamily() {
  return useContext(Ctx) ?? fallback;
}
