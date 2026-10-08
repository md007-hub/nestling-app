import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "up" } => search["mode"] === "up" ? { mode: "up" } : {},
  head: () => ({ meta: [
    { title: "Log in or create an account · Nestling" },
    { name: "description", content: "Create a Nestling account to share your baby's care with your partner." },
    { property: "og:title", content: "Nestling account" },
    { property: "og:description", content: "Share your baby's care with your partner." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up" | "reset">(initialMode ?? "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "reset" && password.length < 8) { toast.error("Use at least 8 characters for your password"); return; }
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(true);
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        } });
        if (error) throw error;
        if (!data.session) setSent(true);
        else navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-sm py-5">
    <div className="mb-8 text-center">
      <img src="/icon-192.png" alt="Nestling logo" className="mx-auto mb-4 h-14 w-14 rounded-2xl" draggable={false} />
      <p className="font-display text-2xl font-bold">Nestling</p>
      <p className="mt-2 text-sm text-muted-foreground">A calmer way to care, together.</p>
    </div>
    {sent ? <div className="space-y-3 border-t border-border pt-6 text-center">
      <h1 className="font-display text-2xl font-bold">Check your email</h1>
      <p className="text-sm text-muted-foreground">{mode === "reset" ? "We've sent a password reset link" : "We've sent a confirmation link"} to {email}. Open it to continue.</p>
      <Button variant="ghost" onClick={() => { setSent(false); setMode("in"); }}>Back to log in</Button>
    </div> : <>
      {mode !== "reset" && <div className="mb-7 grid grid-cols-2 border-b border-border" role="tablist" aria-label="Account">
        {(["in", "up"] as const).map(m => <Button key={m} type="button" role="tab" aria-selected={mode === m} variant="ghost" onClick={() => setMode(m)} className={cn("h-12 rounded-none border-b-2 text-sm", mode === m ? "border-sage-strong text-foreground" : "border-transparent text-muted-foreground")}>{m === "in" ? "Log In" : "Create Account"}</Button>)}
      </div>}
      <h1 className="mb-1 font-display text-2xl font-bold">{mode === "reset" ? "Reset your password" : mode === "up" ? "Welcome to the family" : "Welcome back"}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{mode === "reset" ? "We'll email you a secure link." : mode === "up" ? "Start sharing the little moments." : "Pick up where you left off."}</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Email address<Input aria-label="Email address" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-12 text-base focus-visible:ring-sage-strong/50" /></label>
        {mode !== "reset" && <label className="block text-sm font-medium">Password
          <span className="relative mt-1.5 block"><Input aria-label="Password" type={visible ? "text" : "password"} required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-12 pr-12 text-base focus-visible:ring-sage-strong/50" />
            <Button type="button" variant="ghost" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 h-10 w-10 px-0">{visible ? <EyeOff /> : <Eye />}</Button></span>
        </label>}
        {mode === "in" && <Button type="button" variant="link" onClick={() => setMode("reset")} className="ml-auto flex h-8 px-0">Forgot password?</Button>}
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-sage-strong text-base text-white shadow-soft transition hover:bg-sage-strong/90 active:scale-[0.98]">{busy ? "Please wait…" : mode === "reset" ? "Send reset link" : mode === "up" ? "Create account" : "Log in"}{!busy && <ArrowRight />}</Button>
      </form>
      {mode === "reset" && <Button variant="ghost" onClick={() => setMode("in")} className="mt-4 w-full">Back to log in</Button>}
    </>}
    <p className="mt-8 text-center text-xs text-muted-foreground">Your care notes are yours. <Link to="/" className="underline underline-offset-2">Back to introduction</Link></p>
  </div>;
}