import { useState } from "react";
import { AudioWaveform, Loader2, ShieldCheck } from "lucide-react";
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
    <main className="signal-grid relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-12 selection:bg-primary/30">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 opacity-30" aria-hidden="true">
        <svg className="h-full w-full text-primary" preserveAspectRatio="none" viewBox="0 0 1200 160" fill="none"><path d="M0 118c68 0 68-76 136-76s68 94 136 94 68-54 136-54 68 36 136 36 68-92 136-92 68 106 136 106 68-66 136-66 68 52 136 52 68-34 136-34" stroke="currentColor" strokeWidth="2" /><path d="M0 132h1200" stroke="currentColor" strokeOpacity=".25" /></svg>
      </div>
      <section className="relative w-full max-w-md" aria-labelledby="auth-title">
        <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative rounded-2xl border bg-card/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-9 flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20"><AudioWaveform className="size-6" /></div>
            <div><p className="font-display text-base font-bold">AutoAce Signal Lab</p><p className="font-mono text-[10px] uppercase text-primary">Private audio operations</p></div>
          </div>
          <h1 id="auth-title" className="text-2xl font-semibold">{mode === "signin" ? "Sign in to review calls" : "Create analyst access"}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Production audio stays in private storage and is visible only to your account.</p>
          <Button variant="outline" className="mt-7 h-11 w-full bg-foreground text-background hover:bg-foreground/90 hover:text-background" onClick={google} disabled={busy}><span className="font-bold">G</span>Continue with Google</Button>
          <div className="my-6 flex items-center gap-3 font-mono text-[10px] uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label className="font-mono text-[10px] uppercase text-muted-foreground" htmlFor="email">Email address</Label><Input className="h-11 bg-background/60" id="email" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="space-y-2"><Label className="font-mono text-[10px] uppercase text-muted-foreground" htmlFor="password">Password</Label><Input className="h-11 bg-background/60" id="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <Button className="h-11 w-full shadow-lg shadow-primary/20" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>
          <Button variant="link" className="mt-3 w-full text-primary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need an account? Sign up" : "Already have access? Sign in"}</Button>
        </div>
        <div className="mt-5 flex items-center justify-between px-2 font-mono text-[10px] uppercase text-muted-foreground"><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" />Systems operational</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3" />Encrypted workspace</span></div>
      </section>
    </main>
  );
}