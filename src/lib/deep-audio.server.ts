import { z } from "zod";

const DeepAudioResult = z.object({
  emotional_tone: z.enum(["neutral", "satisfied", "frustrated", "upset", "distressed"]),
  emotional_intensity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
});

type DeepAudioInput = { base64: string; format: "wav" | "mp3" | "webm" | "m4a" | "ogg" | "aac" | "flac" };

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function classifyAudioDeep(input: DeepAudioInput, apiKey: string) {
  const body = {
    model: "google/gemini-3.1-flash-lite",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Classify only the speaker emotional tone from this call audio. Return JSON with emotional_tone (neutral, satisfied, frustrated, upset, or distressed), emotional_intensity (low, medium, or high), and confidence from 0 to 1." },
        { type: "input_audio", input_audio: { data: input.base64, format: input.format } },
      ],
    }],
    response_format: { type: "json_object" },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (response.ok) {
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Deep audio analysis returned no classification.");
      return DeepAudioResult.parse(JSON.parse(content));
    }
    const message = payload.error?.message ?? `Deep audio analysis failed (${response.status}).`;
    if (response.status !== 429 && response.status < 500) throw new Error(message);
    if (attempt === 2) throw new Error(message);
    const retryAfter = Number(response.headers.get("Retry-After"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt + Math.random() * 250);
  }
  throw new Error("Deep audio analysis did not complete.");
}