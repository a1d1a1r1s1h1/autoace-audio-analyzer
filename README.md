# AutoAce Signal Lab

Hosted dashboard for the Voice Tone and Background Noise technical trial. Analysts log in, upload an evaluation batch (folder of audio as a ZIP plus one CSV manifest), watch progress and per-file errors, review predictions, and download structured results.

## Output schema

Every clip returns exactly the required fields: `emotional_tone` (neutral | satisfied | frustrated | upset | distressed), `emotional_intensity` (low | medium | high), `background_noise_present` (bool), `background_noise_type` (open text, empty string when no noise), `background_noise_severity` (none | low | medium | high), `audio_quality` (clear | slightly_impaired | severely_impaired), `speaker_overlap_present` (bool), `long_silence_present` (bool), and `confidence` (0.0–1.0). Cross-field rules are enforced before storage.

## Batch format

- Audio files at the archive root plus one CSV manifest.
- Manifest columns: `name` (exact audio filename with extension) and `result_json` (expected JSON object; may be empty for an unlabeled hidden set).
- Unmatched and missing files are reported, not fatal. A malformed or unsupported file fails on its own with a reason shown in the results table.
- Results download as CSV or JSON, preserving the original filename per row.

## Pipeline

- **Stage A — acoustic features:** RMS and energy variation, silence runs, clipping, zero-crossing rate, spectral centroid and flatness, pitch and pitch variation, duration. Runs in the browser; audio stays local.
- **Stage B — calibrated rules:** produces all schema fields with per-field confidence.
- **Stage C — audio foundation model:** invoked server-side only when local emotion confidence is below 0.64. Failures preserve the Stage A/B result and are recorded in diagnostics.
- First 180 seconds analyzed per clip; 20 MB upload limit per file.

## Cost and latency

Blended cost per audio minute is `0.00008 + 0.003 × escalation_rate`, at or below the $0.003/min ceiling in the worst case. Each batch shows measured audio minutes, total cost, cost per audio minute, and processing seconds per audio minute. Per-clip latency is stored with every result.

## Validation

`/docs` in the app contains the technical memo, architecture, per-field accuracy and emotional-tone confusion matrix computed from your own labeled run, cost and latency analysis, and failure modes with next steps.

## Security and data

Email/password and Google sign-in, private audio storage, row-level owner policies, and server-side AI credentials. Only escalated clips are sent to the external model; set the escalation threshold to 0 to keep everything local.

## Run locally

```sh
bun install
bun run dev
```
