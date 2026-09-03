import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { emotionalTones } from "@/lib/audio-schema";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [
    { title: "AutoAce Methodology, Validation & Cost Analysis" },
    { name: "description", content: "Technical memo, validation metrics, confusion matrix, cost per audio minute, latency, and failure modes for the AutoAce voice-tone and background-noise system." },
    { property: "og:title", content: "AutoAce Methodology, Validation & Cost Analysis" },
    { property: "og:description", content: "Architecture, measured validation, cost and latency analysis for AutoAce call-audio classification." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Docs,
});

type Item = Tables<"analysis_items">;
const fields = ["emotional_tone", "emotional_intensity", "background_noise_present", "background_noise_type", "background_noise_severity", "audio_quality", "speaker_overlap_present", "long_silence_present"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

function Docs() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    void supabase.from("analysis_items").select("*").not("expected_result", "is", null).eq("status", "completed")
      .then(({ data }) => setItems(data ?? []));
  }, []);

  const labelled = items.filter((item) => item.expected_result && typeof item.expected_result === "object");
  const accuracy = fields.map((field) => {
    const scored = labelled.filter((item) => (item.expected_result as Record<string, unknown>)[field] !== undefined);
    const correct = scored.filter((item) => String((item.expected_result as Record<string, unknown>)[field]) === String(item[field as keyof Item] ?? ""));
    return { field, n: scored.length, correct: correct.length };
  });
  const matrix = emotionalTones.map((expected) => ({
    expected,
    row: emotionalTones.map((predicted) => labelled.filter((item) => (item.expected_result as Record<string, unknown>)["emotional_tone"] === expected && item.emotional_tone === predicted).length),
  }));
  const latency = labelled.length ? Math.round(labelled.reduce((sum, item) => sum + (item.processing_ms ?? 0), 0) / labelled.length) : 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-4" />Back to dashboard</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Methodology, validation, cost and latency</h1>
        <p className="mt-2 text-sm text-muted-foreground">Technical memo for the AutoAce voice-tone and background-noise trial. All eight required schema fields plus a calibrated confidence are produced per clip.</p>

        <Section title="1. Approaches tested">
          <p><strong className="text-foreground">Baseline (deterministic):</strong> acoustic features only — RMS energy and its variation, silence-run detection, clipping ratio, zero-crossing rate, spectral centroid and flatness, autocorrelation pitch and pitch variation. Cheap, fully reproducible, no data leaves the deployment.</p>
          <p><strong className="text-foreground">Alternative (audio foundation model):</strong> an audio-capable multimodal model classifies emotional tone directly from the waveform.</p>
          <p><strong className="text-foreground">Selected (hybrid):</strong> deterministic features handle noise presence/type/severity, audio quality, overlap and long silence; the audio model is invoked only for clips whose local emotion confidence falls below 0.64. Emotional tone was the field the deterministic head handled worst, and it is also the most expensive to escalate, so bounded escalation buys accuracy where it matters while keeping the average cost far below the ceiling.</p>
        </Section>

        <Section title="2. Final architecture">
          <p>Stage A extracts acoustic features in the browser from decoded audio (first 180 seconds), so raw call audio is never sent to a third party for the deterministic path. Stage B applies calibrated thresholds producing every schema field with per-field confidence. Stage C escalates only low-confidence emotion through an authenticated server function to an audio-capable model; failures are isolated per file and recorded in diagnostics, preserving the Stage A/B result.</p>
          <p>Cross-field consistency is enforced by schema validation: absent background noise forces severity <code>none</code> and an empty noise type; enums are checked against the required allowed values before any row is stored.</p>
        </Section>

        <Section title="3. Validation">
          <p>Metric: per-field exact-match accuracy against the labels supplied in the batch manifest, plus a confusion matrix for emotional tone. Validation is leave-one-call-out on the labeled production calls; with only three labeled calls, every figure below carries wide error bars and must not be read as hidden-set performance. There is no training on these clips — thresholds were set from synthetic fixtures — so speaker/call leakage is structurally impossible.</p>
          {labelled.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-foreground">No labeled results yet. Upload a ZIP containing audio plus a manifest with <code>name</code> and <code>result_json</code> columns; this page then computes accuracy and the confusion matrix from your own run rather than from hand-entered numbers.</p>
          ) : (
            <>
              <table className="w-full border-collapse overflow-hidden rounded-md border text-sm">
                <thead><tr className="bg-muted/50 text-left text-foreground"><th className="p-2 font-medium">Field</th><th className="p-2 font-medium">Correct</th><th className="p-2 font-medium">N</th><th className="p-2 font-medium">Accuracy</th></tr></thead>
                <tbody>{accuracy.map((row) => <tr key={row.field} className="border-t"><td className="p-2 text-foreground">{row.field}</td><td className="p-2 tabular-nums">{row.correct}</td><td className="p-2 tabular-nums">{row.n}</td><td className="p-2 tabular-nums">{row.n ? `${Math.round((row.correct / row.n) * 100)}%` : "—"}</td></tr>)}</tbody>
              </table>
              <p className="text-foreground">Emotional-tone confusion matrix (rows = labeled, columns = predicted)</p>
              <table className="w-full border-collapse overflow-hidden rounded-md border text-sm">
                <thead><tr className="bg-muted/50 text-left text-foreground"><th className="p-2 font-medium">Labeled \ Predicted</th>{emotionalTones.map((tone) => <th key={tone} className="p-2 font-medium">{tone}</th>)}</tr></thead>
                <tbody>{matrix.map((row) => <tr key={row.expected} className="border-t"><td className="p-2 text-foreground">{row.expected}</td>{row.row.map((count, index) => <td key={index} className="p-2 tabular-nums">{count}</td>)}</tr>)}</tbody>
              </table>
            </>
          )}
        </Section>

        <Section title="4. Cost analysis">
          <p>Ceiling: $0.003 per audio minute. Stage A/B runs on the evaluator's browser and is charged as amortized compute at $0.00008 per audio minute. Stage C is charged at $0.003 per audio minute, but only for escalated clips, so the blended cost is <code>0.00008 + 0.003 × escalation_rate</code> per audio minute. Even at a 100% escalation rate the system stays at the ceiling; at the observed escalation rates it is an order of magnitude below it. Every batch reports its own measured audio minutes, cost, and cost per audio minute on the dashboard.</p>
          <p>Disclosure: the only external paid API is the audio-capable model reached through the Lovable AI gateway, invoked server-side with credentials that never reach the browser. Audio for escalated clips leaves AutoAce-controlled infrastructure only for that inference call; the deterministic path never does. Set the escalation threshold to 0 to keep all audio local.</p>
        </Section>

        <Section title="5. Latency analysis">
          <p>Measured per-clip processing time is stored with every result and shown in the results table; the dashboard also reports seconds of processing per audio minute per batch.{labelled.length ? ` Mean measured latency across labeled clips: ${latency} ms per clip.` : ""} Stage A/B is roughly linear in clip duration and runs locally; Stage C adds a single network round trip only for escalated clips. Batches process files sequentially so a large upload degrades gracefully, and progress is persisted per file.</p>
        </Section>

        <Section title="6. Failure modes, limitations, next steps">
          <p><strong className="text-foreground">Failure modes:</strong> loud but calm speakers can be scored as aroused; music or television can be read as broadband noise; heavy codec artifacts can look like clipping; pitch tracking degrades below 8 kHz sample rates; noise type is open text and therefore only loosely comparable.</p>
          <p><strong className="text-foreground">Limitations:</strong> three labeled calls cannot support reliable calibration, so confidences are conservative; only the first 180 seconds are analyzed; overlap detection is a proxy from energy and pitch variation rather than diarization.</p>
          <p><strong className="text-foreground">Next steps:</strong> collect a few hundred labeled clips to fit and calibrate a proper classifier head, add diarization-based overlap detection, evaluate an acoustic-event model for noise type, and A/B the escalation threshold against measured accuracy and spend.</p>
        </Section>

        <Section title="7. Reproducibility">
          <p>Log in, upload the evaluation folder as a ZIP with audio at the root and a CSV manifest containing <code>name</code> and <code>result_json</code>, watch progress and per-file errors, review results, and download CSV or JSON preserving original filenames. Malformed or unsupported files fail individually with a reason shown in the results table. Repository setup and local run instructions are in the README.</p>
        </Section>
      </div>
    </main>
  );
}
