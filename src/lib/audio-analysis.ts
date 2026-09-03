import { validatePrediction, type AudioPrediction, type EmotionalTone } from "./audio-schema";

type Features = {
  duration: number; rms: number; rmsVariation: number; silenceRatio: number; longestSilence: number;
  clippingRatio: number; zcr: number; centroid: number; flatness: number; pitch: number; pitchVariation: number;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function spectralFeatures(samples: Float32Array, sampleRate: number) {
  const size = Math.min(512, samples.length);
  if (size < 32) return { centroid: 0, flatness: 0 };
  const start = Math.max(0, Math.floor((samples.length - size) / 2));
  const magnitudes: number[] = [];
  for (let k = 1; k < size / 2; k += 1) {
    let real = 0; let imaginary = 0;
    for (let n = 0; n < size; n += 1) {
      const sample = samples[start + n] ?? 0;
      const windowed = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1)));
      const phase = (2 * Math.PI * k * n) / size;
      real += windowed * Math.cos(phase); imaginary -= windowed * Math.sin(phase);
    }
    magnitudes.push(Math.sqrt(real * real + imaginary * imaginary) + 1e-10);
  }
  const total = magnitudes.reduce((sum, value) => sum + value, 0);
  const centroid = total ? magnitudes.reduce((sum, value, index) => sum + value * ((index + 1) * sampleRate / size), 0) / total : 0;
  const geometric = Math.exp(mean(magnitudes.map((value) => Math.log(value))));
  return { centroid, flatness: geometric / Math.max(mean(magnitudes), 1e-10) };
}

function pitchForFrame(frame: Float32Array, sampleRate: number) {
  let bestLag = 0; let best = 0;
  const minLag = Math.floor(sampleRate / 350); const maxLag = Math.min(Math.floor(sampleRate / 70), frame.length / 2);
  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let correlation = 0; let energy = 0;
    for (let i = 0; i < frame.length - lag; i += 1) {
      correlation += (frame[i] ?? 0) * (frame[i + lag] ?? 0); energy += (frame[i] ?? 0) ** 2;
    }
    const score = energy ? correlation / energy : 0;
    if (score > best) { best = score; bestLag = lag; }
  }
  return best > 0.32 && bestLag ? sampleRate / bestLag : 0;
}

function extractFeatures(samples: Float32Array, sampleRate: number): Features {
  const frameSize = Math.max(256, Math.floor(sampleRate * 0.025));
  const hop = Math.max(128, Math.floor(sampleRate * 0.01));
  const rmsFrames: number[] = []; const pitches: number[] = [];
  let zeroCrossings = 0; let clipped = 0; let silenceRun = 0; let longestRun = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const current = samples[i] ?? 0; const previous = samples[i - 1] ?? 0;
    if ((current >= 0) !== (previous >= 0)) zeroCrossings += 1;
    if (Math.abs(current) >= 0.985) clipped += 1;
  }
  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    const frame = samples.slice(start, start + frameSize);
    const rms = Math.sqrt(mean(Array.from(frame, (value) => value * value)));
    rmsFrames.push(rms);
    if (rms < 0.012) { silenceRun += 1; longestRun = Math.max(longestRun, silenceRun); } else silenceRun = 0;
    if (rms > 0.018 && pitches.length < 140) { const pitch = pitchForFrame(frame, sampleRate); if (pitch) pitches.push(pitch); }
  }
  const averageRms = mean(rmsFrames); const pitch = mean(pitches);
  const spectral = spectralFeatures(samples, sampleRate);
  return {
    duration: samples.length / sampleRate,
    rms: averageRms,
    rmsVariation: Math.sqrt(mean(rmsFrames.map((value) => (value - averageRms) ** 2))),
    silenceRatio: rmsFrames.length ? rmsFrames.filter((value) => value < 0.012).length / rmsFrames.length : 0,
    longestSilence: longestRun * hop / sampleRate,
    clippingRatio: samples.length ? clipped / samples.length : 0,
    zcr: samples.length ? zeroCrossings / samples.length : 0,
    centroid: spectral.centroid,
    flatness: spectral.flatness,
    pitch,
    pitchVariation: pitch ? Math.sqrt(mean(pitches.map((value) => (value - pitch) ** 2))) / pitch : 0,
  };
}

function emotionHead(features: Features) {
  const arousal = clamp(features.rmsVariation * 15 + features.pitchVariation * 0.9 + features.zcr * 2.5);
  const distress = clamp(arousal * 0.55 + features.pitchVariation * 0.65 + features.silenceRatio * 0.2);
  const scores: Record<EmotionalTone, number> = {
    neutral: 1.05 - arousal,
    satisfied: 0.48 + clamp(features.pitch / 250) * 0.2 - distress * 0.25,
    frustrated: arousal * 0.78 + features.rmsVariation * 2,
    upset: distress * 0.84 + arousal * 0.18,
    distressed: distress * 0.92 + features.silenceRatio * 0.24,
  };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [EmotionalTone, number][];
  const tone = sorted[0]?.[0] ?? "neutral";
  const margin = (sorted[0]?.[1] ?? 0) - (sorted[1]?.[1] ?? 0);
  return { tone, arousal, confidence: clamp(0.52 + margin * 0.55, 0.45, 0.88) };
}

export async function analyzeAudio(file: Blob): Promise<AudioPrediction> {
  const started = performance.now();
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const maxSamples = Math.min(buffer.length, buffer.sampleRate * 180);
    const mono = new Float32Array(maxSamples);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < maxSamples; index += 1) mono[index] = (mono[index] ?? 0) + (data[index] ?? 0) / buffer.numberOfChannels;
    }
    const f = extractFeatures(mono, buffer.sampleRate); const emotion = emotionHead(f);
    const noiseScore = clamp(f.flatness * 0.9 + f.zcr * 3.2 + (f.rms < 0.025 ? 0.12 : 0));
    const noisePresent = noiseScore > 0.36;
    const noiseSeverity = !noisePresent ? "none" : noiseScore > 0.72 ? "high" : noiseScore > 0.52 ? "medium" : "low";
    const noiseType = !noisePresent ? "" : f.flatness > 0.58 ? "broadband / wind" : f.centroid > 2600 ? "keyboard / high-frequency" : f.zcr > 0.13 ? "office chatter" : "ambient room noise";
    const impairedScore = clamp(f.clippingRatio * 80 + (f.rms < 0.008 ? 0.6 : 0) + noiseScore * 0.55 + (f.centroid < 500 ? 0.3 : 0));
    const quality = impairedScore > 0.72 ? "severely_impaired" : impairedScore > 0.38 ? "slightly_impaired" : "clear";
    const overlapScore = clamp(f.rmsVariation * 7 + f.pitchVariation * 0.55 + (f.centroid > 2100 ? 0.12 : 0));
    const confidence = mean([emotion.confidence, clamp(0.58 + Math.abs(noiseScore - 0.36)), clamp(0.62 + Math.abs(impairedScore - 0.38))]);
    return validatePrediction({
      emotional_tone: emotion.tone,
      emotional_intensity: emotion.arousal > 0.7 ? "high" : emotion.arousal > 0.38 ? "medium" : "low",
      background_noise_present: noisePresent,
      background_noise_type: noiseType,
      background_noise_severity: noiseSeverity,
      audio_quality: quality,
      speaker_overlap_present: overlapScore > 0.66,
      long_silence_present: f.longestSilence >= 2.5,
      confidence: Number(confidence.toFixed(3)),
      field_confidence: { emotion: emotion.confidence, noise: clamp(0.58 + Math.abs(noiseScore - 0.36)), quality: clamp(0.62 + Math.abs(impairedScore - 0.38)), overlap: clamp(0.5 + Math.abs(overlapScore - 0.66)), silence: clamp(0.72 + Math.abs(f.longestSilence - 2.5) / 10) },
      diagnostics: { ...f, noiseScore, impairedScore, overlapScore, analyzedSeconds: f.duration > 180 ? 180 : f.duration },
      stage_used: emotion.confidence < 0.56 ? "A + B (low-confidence review)" : "A + B",
      duration_seconds: Number(buffer.duration.toFixed(3)),
      processing_ms: Math.round(performance.now() - started),
    });
  } finally { await context.close(); }
}