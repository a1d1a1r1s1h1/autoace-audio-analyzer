import Papa from "papaparse";

export type ManifestRow = { name: string; result_json?: string };
const audioExtensions = new Set(["wav", "mp3", "ogg", "m4a", "aac", "flac", "webm"]);

export function safeFileName(name: string) {
  const normalized = name.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (normalized.startsWith("/") || parts.includes("..") || parts.length !== 1) {
    throw new Error(`Unsafe archive path: ${name}`);
  }
  return parts[0] ?? "";
}

export function isAudioFile(name: string) {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return audioExtensions.has(extension);
}

export function parseManifest(csv: string): ManifestRow[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message ?? "Invalid CSV manifest");
  if (!parsed.meta.fields?.includes("name")) throw new Error("Manifest requires a name column");
  const seen = new Set<string>();
  return parsed.data.map((row) => {
    const name = safeFileName((row["name"] ?? "").trim());
    if (!name || !isAudioFile(name)) throw new Error(`Invalid audio filename in manifest: ${row["name"] ?? "empty"}`);
    if (seen.has(name)) throw new Error(`Duplicate filename in manifest: ${name}`);
    seen.add(name);
    return { name, ...(row["result_json"]?.trim() ? { result_json: row["result_json"].trim() } : {}) };
  });
}

export function validateBatch(audioNames: string[], manifest: ManifestRow[]) {
  const files = new Set(audioNames.map(safeFileName));
  const rows = new Set(manifest.map((row) => row.name));
  return {
    missing: [...rows].filter((name) => !files.has(name)),
    unlisted: [...files].filter((name) => !rows.has(name)),
    valid: manifest.filter((row) => files.has(row.name)),
  };
}