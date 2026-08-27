import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth-panel";
import { AudioDashboard } from "@/components/audio-dashboard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "AutoAce Audio Analysis Dashboard" },
    { name: "description", content: "Secure batch voice-tone, background-noise, overlap, silence, and audio-quality analysis for call operations." },
    { property: "og:title", content: "AutoAce Audio Analysis Dashboard" },
    { property: "og:description", content: "Secure batch voice-tone and call-quality analysis for audio operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (user === undefined) return <div className="grid min-h-screen place-items-center bg-background"><div className="size-8 animate-pulse rounded-md bg-primary" aria-label="Loading" /></div>;
  if (!user) return <AuthPanel />;
  return <AudioDashboard userId={user.id} email={user.email ?? "Analyst"} />;
}
