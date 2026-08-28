# AutoAce Signal Lab

Secure batch analysis for call-audio quality and emotion review. Analysts upload audio files or a ZIP containing audio plus `labels.csv`, monitor processing, filter results, and export JSON or CSV.

## Analysis pipeline

- **Stage A — signal features:** RMS, silence windows, clipping, zero-crossing rate, spectral centroid, spectral flatness, and duration.
- **Stage B — lightweight classification:** calibrated rules classify noise, quality, overlap, silence, emotional tone, and intensity locally in the browser.
- **Stage C — deep audio escalation:** uncertain emotion predictions are sent from an authenticated server function to an audio-capable Lovable AI model. Failures preserve the Stage A/B result and are recorded in diagnostics.
- Local feature extraction analyzes up to the first 180 seconds. The upload limit is 20 MB per file.

## Security and data

- Email/password and Google sign-in.
- Private audio storage and row-level owner policies.
- Authenticated users can only access their own batches and results.
- AI credentials stay server-side.

## Run locally

```sh
bun install
bun run dev
```

The evaluation ZIP format expects audio at the archive root and `labels.csv` with `file_name` and `result_json` columns.
