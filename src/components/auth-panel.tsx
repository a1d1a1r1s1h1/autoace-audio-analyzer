import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export function AuthPanel() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else if (mode === "signup") toast.success("Check your email to confirm your account.");
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message); setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12">
      <section className="w-full max-w-sm" aria-labelledby="auth-title">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground"><LockKeyhole className="size-5" /></div>
          <div><p className="text-sm font-semibold">AutoAce Signal Lab</p><p className="text-xs text-muted-foreground">Private audio operations</p></div>
        </div>
        <h1 id="auth-title" className="text-3xl font-semibold">{mode === "signin" ? "Sign in to review calls" : "Create analyst access"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Production audio stays in private storage and is visible only to your account.</p>
        <Button variant="outline" className="mt-7 w-full" onClick={google} disabled={busy}>Continue with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <Button variant="link" className="mt-3 w-full" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need an account? Sign up" : "Already have access? Sign in"}</Button>
      </section>
    </main>
  );
}