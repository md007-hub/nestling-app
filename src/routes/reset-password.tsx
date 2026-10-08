import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password · Nestling" }, { name: "description", content: "Set a new password for your Nestling account." },
    { property: "og:title", content: "Reset password · Nestling" }, { property: "og:description", content: "Set a new password for your Nestling account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setRecovery(hash.get("type") === "recovery");
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/auth" });
  };
  return <div className="mx-auto max-w-sm space-y-5 py-10">
    <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
    {!recovery ? <p className="text-sm text-muted-foreground">Open the reset link from your email to continue.</p> :
      <form onSubmit={submit} className="space-y-4">
        <Input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (8+ characters)" className="h-12" />
        <Input aria-label="Confirm password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" className="h-12" />
        <Button disabled={busy} type="submit" className="h-12 w-full">Save password</Button>
      </form>}
  </div>;
}