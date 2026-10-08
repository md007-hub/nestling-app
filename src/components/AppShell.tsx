import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Baby, LogOut, User, UserPlus, Users, Moon, Sparkles, Sun, Waves, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useHydrated, useOnline } from "@/hooks/useOnline";
import { registerAppSW } from "@/lib/registerSW";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/hooks/useFamily";
import { usePro } from "@/hooks/usePro";
import { checkReminders, notificationsSupported } from "@/lib/reminders";

function SignInChip() {
  return (
    <Link to="/auth" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-semibold text-secondary-foreground">
      <UserPlus className="h-4 w-4" />
      Sign in
    </Link>
  );
}

function AccountMenu() {
  const { baby, memberCount, signOut } = useFamily();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="h-10 w-10 rounded-full p-0 active:bg-muted"
      >
        <User className="h-5 w-5" />
      </Button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close account menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border/70 bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold">Account</p>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} aria-label="Close" className="h-7 w-7 rounded-full p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Baby className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{baby ? baby.name : "No baby set up"}</span>
              <span>·</span>
              <span className="shrink-0">{memberCount > 1 ? `${memberCount} members` : "Solo parent"}</span>
            </p>
            <Link
              to="/family"
              onClick={() => setOpen(false)}
              className="mt-3 flex h-10 w-full items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
            >
              <Users className="h-4 w-4" />
              Family & settings
            </Link>
            <Button
              type="button"
              onClick={handleSignOut}
              variant="ghost"
              className="mt-2 h-11 w-full gap-2 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FamilyChip() {
  const { ready, user, baby, memberCount } = useFamily();
  if (!ready) return null;
  if (!user) return <SignInChip />;
  return <AccountMenu />;
}

function HeaderTitle() {
  const { user } = useFamily();
  const { isPro, openUpgrade } = usePro();
  return (
    <p className="flex items-center gap-1.5 font-display text-lg font-bold leading-none">
      <span>Nestling</span>
      {user && (
        <button
          type="button"
          onClick={() => openUpgrade()}
          aria-label={isPro ? "Nestling PRO membership" : "Upgrade to PRO"}
          className={
            isPro
              ? "rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-primary"
              : "rounded-md border border-dashed border-primary/50 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-primary/80"
          }
        >
          {isPro ? "PRO" : "GO PRO"}
        </button>
      )}
    </p>
  );
}

function NestlingLogo() {
  return (
    <img
      src="/icon-192.png"
      alt=""
      className="h-7 w-7 shrink-0 rounded-lg dark:opacity-80 dark:mix-blend-luminosity dark:brightness-90"
      draggable={false}
    />
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("nursery-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("nursery-theme", next ? "dark" : "light");
  };

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggle}
      aria-label="Toggle night mode"
      className="h-10 w-10 rounded-full p-0 active:bg-muted"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

function StatusBadge() {
  const hydrated = useHydrated();
  const online = useOnline();
  const showOnline = !hydrated || online;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        showOnline ? "bg-online/15 text-online" : "bg-offline/20 text-offline",
      )}
    >
      {showOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {showOnline ? "Online" : "Offline (Local)"}
    </span>
  );
}

const tabs = [
  { to: "/", label: "Tracker", icon: Baby },
  { to: "/sounds", label: "Sounds", icon: Waves },
  { to: "/ask", label: "Nanny AI", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { ready, user, baby } = useFamily();
  useEffect(() => {
    void registerAppSW();
  }, []);
  useEffect(() => {
    if (!baby || !notificationsSupported()) return;
    const run = () => void checkReminders(baby).catch(() => {});
    run();
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
  }, [baby]);
  const navigate = useNavigate();
  const guarded = pathname.startsWith("/sounds") || pathname.startsWith("/ask");
  useEffect(() => {
    if (ready && !user && guarded) navigate({ to: "/", replace: true });
  }, [ready, user, guarded, navigate]);
  const isIntroduction =
    pathname === "/tour" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/reset-password") ||
    (pathname === "/" && (!ready || !user));
  if (guarded && (!ready || !user)) {
    return <div className="mx-auto min-h-[100dvh] w-full max-w-md bg-background" />;
  }
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-background">
      {!isIntroduction && <header className="sticky top-0 z-40 isolate flex items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 py-3 shadow-soft backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="flex min-w-0 items-center gap-3">
          <NestlingLogo />
          <div className="flex min-w-0 flex-col items-start justify-center gap-1">
            <HeaderTitle />
            <StatusBadge />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FamilyChip />
          <ThemeToggle />
        </div>
      </header>}

      <main className={`relative z-0 flex-1 px-4 pt-4 ${isIntroduction ? "pb-4" : "pb-28"}`}>{children}</main>

      {!isIntroduction && <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-3">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          ))}
        </div>
      </nav>}
    </div>
  );
}
