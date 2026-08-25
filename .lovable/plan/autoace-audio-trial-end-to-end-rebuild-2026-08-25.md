# AutoAce Audio Trial — End-to-End Rebuild

## Goal
Build a submission-ready AutoAce experience at `/` that combines a secure batch-processing dashboard with a materially stronger hybrid audio-classification pipeline, while preserving the required eight output fields, per-file isolation, downloadable results, validation evidence, and cost reporting.

## Product experience
- Create a restrained, professional audio-operations dashboard rather than a marketing page.
- Add authenticated access, ZIP/audio + CSV manifest intake, drag-and-drop validation, queued/processing/completed/error states, and per-file progress.
- Show a dense results table with all required fields, confidence, stage used, latency, and expandable diagnostics.
- Add filters for status, emotional tone, noise severity, and low confidence; include CSV and JSON downloads.
- Provide a batch summary with field distributions, processing time, estimated cost, and clear partial-failure reporting.
- Make upload, processing, review, and download flows responsive and keyboard accessible.

## Classification pipeline
1. **Stage A — deterministic signal analysis**
   - Port the useful feature and heuristic logic from the uploaded package into Worker/browser-compatible TypeScript.
   - Extract duration, RMS/energy variation, silence runs, clipping, spectral flatness/centroid/rolloff, zero-crossing rate, pitch contour, and noise-floor proxies.
   - Produce baseline predictions for noise presence/type/severity, audio quality, long silence, and overlap likelihood with field-level confidence and diagnostics.

2. **Stage B — learned audio classification**
   - Replace the uploaded Stage C stub with a real, pinned, browser-compatible audio classifier where licensing and runtime support permit.
   - Map model labels into the trial’s emotional-tone/intensity and noise taxonomy, retaining the deterministic prediction when learned-model confidence is weaker.
   - Treat overlap as a separately calibrated detector rather than inferring it from duplicated channels.

3. **Stage C — bounded arbitration**
   - Escalate only low-confidence fields, not every clip.
   - Keep the escalation adapter isolated so the primary workflow remains functional if the optional model is unavailable.
   - If Lovable AI audio arbitration is used, enforce the gateway status contract: terminal 4xx errors are surfaced without retries; only 429/5xx receive bounded delayed retries; cost/policy denials pause further automated AI work.
   - Measure an actual call before enabling this route and disable it if the measured per-minute cost threatens the trial’s `$0.003/min` ceiling.

4. **Schema and consistency**
   - Preserve the exact required values for emotional tone, intensity, noise severity, audio quality, overlap, and long silence.
   - Add field-level confidence internally while keeping exported rows compatible with the required result JSON.
   - Enforce cross-field rules such as `noise_present=false` implying `severity=none`.

## Data, jobs, and security
- Enable Lovable Cloud for authentication, private audio storage, persistent batches/jobs/results, and server-side orchestration.
- Store roles separately from user profiles and protect all batch data by authenticated ownership policies.
- Use a private storage bucket with file-size/type limits; generate short-lived access only when processing requires it.
- Validate archive paths, manifest shape, MIME/type, size, duplicate filenames, and audio/manifest correspondence before processing.
- Persist job state so refreshes and server restarts do not lose progress; isolate failures to individual files.
- Do not seed or retain the three confidential production calls in the published app.

## Evaluation and trial deliverables
- Import the uploaded labels and existing predictions as local evaluation fixtures without exposing raw calls.
- Add leave-one-call-out reporting with explicit `N=3` caveats and no speaker/call leakage.
- Add deterministic stress fixtures for silence, clipping, background noise, low SNR, and synthetic overlap.
- Report per-field accuracy/F1 where meaningful, confusion matrices for categorical fields, calibration/confidence behavior, latency, and measured cost per audio minute.
- Update the technical memo to distinguish measured results from proposed work and document the original synthetic-to-real threshold failure.
- Provide submission-ready README instructions, environment/configuration notes, architecture diagram, test commands, and downloadable sample outputs.

## Technical approach
- Keep TanStack Start routing and use typed server functions for app-internal job operations; do not carry over the FastAPI runtime.
- Run browser-only decoding/model code after hydration through dynamic imports; keep server modules compatible with the deployed Worker runtime.
- Keep server-function declaration files thin, moving runtime helpers and model logic into imported modules.
- Use TanStack Query for persistent polling/refetching and route metadata for the dashboard page.
- Use the project’s semantic design tokens and reusable controls; avoid hardcoded component colors.

## Verification
- Unit-test schema validation, manifest/archive safety, feature extraction, confidence routing, retry policy, and export formatting.
- Integration-test login, upload, validation, persisted progress, partial failures, filters, and CSV/JSON downloads.
- Run the pipeline on synthetic fixtures and the available labeled evaluation inputs, recording reproducible metrics rather than hand-entered claims.
- Test the final UI in desktop and mobile viewports and verify there are no console, network, overflow, or accessibility failures.
- Invoke and inspect any enabled Lovable AI request before considering Stage C complete.
