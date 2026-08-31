import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Download, FileArchive, Filter, Headphones, LogOut, RefreshCw, Search, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzeAudio } from "@/lib/audio-analysis";
import { classifyAudioEmotion } from "@/lib/audio-analysis.functions";
import { isAudioFile, parseManifest, safeFileName, validateBatch, type ManifestRow } from "@/lib/batch-manifest";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type Batch = Tables<"analysis_batches">; type Item = Tables<"analysis_items">;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function audioFormat(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "mp3" || extension === "webm" || extension === "m4a" || extension === "ogg" || extension === "aac" || extension === "flac" ? extension : "wav";
}

const display = (value: string | null) => value ? value.replaceAll("_", " ") : "—";

/** Local Stage A/B browser compute (amortised) and Stage C deep-audio model cost, per audio minute. */
const LOCAL_RATE_PER_MIN = 0.00008;
const DEEP_RATE_PER_MIN = 0.003;

/** Sub-cent batches would round to $0.00, so tiny totals are shown in micro-dollars. */
function formatCost(value: number) {
  if (value <= 0) return "$0";
  if (value < 0.001) return `${(value * 1_000_000).toFixed(0)} µ$`;
  return `$${value.toFixed(4)}`;
}

export function AudioDashboard({ userId, email }: { userId: string; email: string }) {
  const [batches, setBatches] = useState<Batch[]>([]); const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string>(); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""); const [tone, setTone] = useState("all"); const [lowConfidence, setLowConfidence] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data, error } = await supabase.from("analysis_batches").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setBatches(data ?? []); setActiveId((current) => current ?? data?.[0]?.id);
  }
  async function loadItems(id?: string) {
    if (!id) return setItems([]);
    const { data, error } = await supabase.from("analysis_items").select("*").eq("batch_id", id).order("file_name");
    if (error) toast.error(error.message); else setItems(data ?? []);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { void loadItems(activeId); }, [activeId]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList); if (!files.length) return;
    setBusy(true);
    try {
      let audio: { name: string; blob: Blob; expected?: Record<string, unknown> }[] = [];
      let manifest: ManifestRow[] | undefined;
      if (files.length === 1 && files[0]?.name.toLowerCase().endsWith(".zip")) {
        const archive = await JSZip.loadAsync(files[0]);
        const entries = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/"));
        entries.forEach((entry) => safeFileName(entry.name));
        const manifestEntry = entries.find((entry) => entry.name.toLowerCase().endsWith(".csv"));
        if (!manifestEntry) throw new Error("ZIP requires a CSV manifest at its root");
        manifest = parseManifest(await manifestEntry.async("text"));
        const audioEntries = entries.filter((entry) => isAudioFile(entry.name));
        const validated = validateBatch(audioEntries.map((entry) => entry.name), manifest);
        if (validated.missing.length) toast.warning(`${validated.missing.length} manifest file(s) missing from ZIP`);
        if (validated.unlisted.length) toast.warning(`${validated.unlisted.length} unlisted audio file(s) skipped`);
        audio = await Promise.all(validated.valid.map(async (row) => ({ name: row.name, blob: await archive.file(row.name)!.async("blob"), ...(row.result_json ? { expected: JSON.parse(row.result_json) as Record<string, unknown> } : {}) })));
      } else {
        audio = files.filter((file) => isAudioFile(file.name)).map((file) => ({ name: safeFileName(file.name), blob: file }));
      }
      if (!audio.length) throw new Error("No supported audio files found");
      const batchName = files.length === 1 ? files[0]?.name.replace(/\.zip$/i, "") ?? "Audio batch" : `Audio batch · ${new Date().toLocaleDateString()}`;
      const { data: batch, error: batchError } = await supabase.from("analysis_batches").insert({ owner_id: userId, name: batchName, status: "processing", total_files: audio.length }).select().single();
      if (batchError) throw batchError;
      setActiveId(batch.id); await load(); let completed = 0; let failed = 0; let seconds = 0; let processing = 0; let deepSeconds = 0;
      const cost = () => Number(((seconds / 60) * LOCAL_RATE_PER_MIN + (deepSeconds / 60) * DEEP_RATE_PER_MIN).toFixed(6));
      for (const entry of audio) {
        const path = `${userId}/${batch.id}/${entry.name}`;
        const { error: storageError } = await supabase.storage.from("audio-batches").upload(path, entry.blob, { contentType: entry.blob.type || "audio/*", upsert: false });
        const { data: item, error: itemError } = await supabase.from("analysis_items").insert({ batch_id: batch.id, file_name: entry.name, storage_path: storageError ? null : path, status: "processing", expected_result: (entry.expected ?? null) as Json }).select().single();
        if (itemError) { failed += 1; continue; }
        try {
          let result = await analyzeAudio(entry.blob);
          if ((result.field_confidence["emotion"] ?? 1) < 0.64) {
            try {
              const deep = await classifyAudioEmotion({ data: { base64: await toBase64(entry.blob), format: audioFormat(entry.name) } });
              result = { ...result, emotional_tone: deep.emotional_tone, emotional_intensity: deep.emotional_intensity, confidence: Math.max(result.confidence, deep.confidence), field_confidence: { ...result.field_confidence, emotion: deep.confidence }, stage_used: "A + B + C (deep audio)" };
              deepSeconds += result.duration_seconds;
            } catch (error) {
              result = { ...result, stage_used: "A + B (Stage C unavailable)", diagnostics: { ...result.diagnostics, stage_c_error: error instanceof Error ? error.message : "Deep audio analysis unavailable" } };
            }
          }
          completed += 1; seconds += result.duration_seconds; processing += result.processing_ms;
          await supabase.from("analysis_items").update({ ...result, status: "completed" }).eq("id", item.id);
        } catch (error) {
          failed += 1; await supabase.from("analysis_items").update({ status: "failed", error_message: error instanceof Error ? error.message : "Audio could not be decoded" }).eq("id", item.id);
        }
        await supabase.from("analysis_batches").update({ completed_files: completed, failed_files: failed, audio_seconds: seconds, processing_ms: processing, estimated_cost_usd: cost() }).eq("id", batch.id);
        await loadItems(batch.id);
      }
      await supabase.from("analysis_batches").update({ status: failed === audio.length ? "failed" : failed ? "partial" : "completed", estimated_cost_usd: cost(), completed_files: completed, failed_files: failed, audio_seconds: seconds, processing_ms: processing }).eq("id", batch.id);

      await load(); await loadItems(batch.id); toast.success(`Processed ${completed} of ${audio.length} files`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); } finally { setBusy(false); }
  }

  const active = batches.find((batch) => batch.id === activeId);
  const filtered = useMemo(() => items.filter((item) => item.file_name.toLowerCase().includes(query.toLowerCase()) && (tone === "all" || item.emotional_tone === tone) && (!lowConfidence || (item.confidence ?? 1) < 0.6)), [items, query, tone, lowConfidence]);
  const progress = active?.total_files ? ((active.completed_files + active.failed_files) / active.total_files) * 100 : 0;

  function exportResults(format: "json" | "csv") {
    const results = items.map(({ file_name, emotional_tone, emotional_intensity, background_noise_present, background_noise_type, background_noise_severity, audio_quality, speaker_overlap_present, long_silence_present, confidence }) => ({ file_name, emotional_tone, emotional_intensity, background_noise_present, background_noise_type, background_noise_severity, audio_quality, speaker_overlap_present, long_silence_present, confidence }));
    if (format === "json") return download(`${active?.name ?? "results"}.json`, JSON.stringify(results, null, 2), "application/json");
    const headers = Object.keys(results[0] ?? { file_name: "" }); const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    download(`${active?.name ?? "results"}.csv`, [headers.join(","), ...results.map((row) => headers.map((key) => escape(row[key as keyof typeof row])).join(","))].join("\n"), "text/csv");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card"><div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Headphones className="size-4" /></div><div><p className="text-sm font-semibold">AutoAce Signal Lab</p><p className="text-xs text-muted-foreground">Voice QA operations</p></div></div><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">{email}</span><Button size="icon" variant="ghost" title="Sign out" onClick={() => supabase.auth.signOut()}><LogOut /></Button></div></div></header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 p-5 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:p-6">
          <Button className="w-full" onClick={() => inputRef.current?.click()} disabled={busy}><UploadCloud />{busy ? "Processing…" : "New batch"}</Button><input ref={inputRef} className="hidden" type="file" multiple accept=".zip,audio/*,.csv" onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />
          <div className="mt-7 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Batches</h2><Button size="icon" variant="ghost" onClick={() => void load()} title="Refresh batches"><RefreshCw /></Button></div>
          <nav className="mt-2 space-y-1" aria-label="Analysis batches">{batches.map((batch) => <Button key={batch.id} variant={activeId === batch.id ? "secondary" : "ghost"} className="h-auto w-full justify-start px-3 py-2.5 text-left" onClick={() => setActiveId(batch.id)}><FileArchive className="size-4" /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{batch.name}</span><span className="block text-xs font-normal text-muted-foreground">{batch.total_files} files · {display(batch.status)}</span></span></Button>)}</nav>
        </aside>
        <section className="min-w-0 px-5 py-7 lg:px-9 lg:py-9">
          {!active ? <div className="grid min-h-[60vh] place-items-center"><div className="max-w-md text-center"><div className="mx-auto grid size-14 place-items-center rounded-md border bg-card"><UploadCloud className="size-6 text-muted-foreground" /></div><h1 className="mt-5 text-2xl font-semibold">Upload your first call batch</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a ZIP with audio and labels.csv, or select individual audio files. Each file is isolated if decoding fails.</p><Button className="mt-6" onClick={() => inputRef.current?.click()}>Choose files</Button></div></div> : <>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">{active.name}</h1><Badge variant={active.status === "completed" ? "default" : active.status === "failed" ? "destructive" : "secondary"}>{display(active.status)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Created {new Date(active.created_at).toLocaleString()}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => exportResults("csv")} disabled={!items.length}><Download />CSV</Button><Button variant="outline" onClick={() => exportResults("json")} disabled={!items.length}><Download />JSON</Button></div></div>
            <div className="mt-7 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 xl:grid-cols-4">{[["Processed", `${active.completed_files}/${active.total_files}`],["Audio minutes", (active.audio_seconds / 60).toFixed(1)],["Avg. confidence", items.length ? `${Math.round(items.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / items.length * 100)}%` : "—"],["Est. compute cost", `$${active.estimated_cost_usd.toFixed(5)}`]].map(([label, value]) => <div key={label} className="bg-card p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
            {(active.status === "processing" || busy) && <div className="mt-5 rounded-md border bg-card p-4"><div className="mb-2 flex justify-between text-xs"><span>Processing audio</span><span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span></div><Progress value={progress} /></div>}
            <div className="mt-7 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search files" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="flex items-center gap-2"><Filter className="size-4 text-muted-foreground" /><select aria-label="Filter by emotion" className="h-9 rounded-md border bg-background px-3 text-sm" value={tone} onChange={(e) => setTone(e.target.value)}><option value="all">All tones</option>{["neutral","satisfied","frustrated","upset","distressed"].map((value) => <option key={value} value={value}>{value}</option>)}</select><Button variant={lowConfidence ? "secondary" : "outline"} onClick={() => setLowConfidence(!lowConfidence)}>Low confidence</Button></div></div>
            <div className="mt-3 rounded-md border bg-card"><Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead>Tone</TableHead><TableHead>Intensity</TableHead><TableHead>Noise</TableHead><TableHead>Quality</TableHead><TableHead>Overlap</TableHead><TableHead>Silence</TableHead><TableHead className="text-right">Confidence</TableHead></TableRow></TableHeader><TableBody>{filtered.map((item) => <TableRow key={item.id}><TableCell className="max-w-52 font-medium"><span className="block truncate">{item.file_name}</span><span className="text-xs font-normal text-muted-foreground">{item.processing_ms ? `${item.processing_ms} ms · ${item.stage_used}` : "Waiting"}</span></TableCell><TableCell>{item.status === "failed" ? <Badge variant="destructive"><XCircle className="mr-1 size-3" />Failed</Badge> : <Badge variant="outline">{item.status}</Badge>}</TableCell><TableCell className="capitalize">{display(item.emotional_tone)}</TableCell><TableCell className="capitalize">{display(item.emotional_intensity)}</TableCell><TableCell><span className="block capitalize">{display(item.background_noise_severity)}</span><span className="text-xs text-muted-foreground">{display(item.background_noise_type)}</span></TableCell><TableCell className="capitalize">{display(item.audio_quality)}</TableCell><TableCell>{item.speaker_overlap_present == null ? "—" : item.speaker_overlap_present ? "Yes" : "No"}</TableCell><TableCell>{item.long_silence_present == null ? "—" : item.long_silence_present ? "Yes" : "No"}</TableCell><TableCell className="text-right font-medium tabular-nums">{item.confidence == null ? "—" : `${Math.round(item.confidence * 100)}%`}</TableCell></TableRow>)}</TableBody></Table></div>
          </>}
        </section>
      </div>
    </main>
  );
}