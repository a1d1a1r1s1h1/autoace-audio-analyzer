import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyAudioDeep } from "./deep-audio.server";

export const classifyAudioEmotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    base64: z.string().min(1).max(28_000_000),
    format: z.enum(["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"]),
  }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Lovable AI is not configured for deep audio analysis.");
    return classifyAudioDeep(data, apiKey);
  });