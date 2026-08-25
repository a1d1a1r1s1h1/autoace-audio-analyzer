export const emotionalTones = ["neutral", "satisfied", "frustrated", "upset", "distressed"] as const;
export const emotionalIntensities = ["low", "medium", "high"] as const;
export const noiseSeverities = ["none", "low", "medium", "high"] as const;
export const audioQualities = ["clear", "slightly_impaired", "severely_impaired"] as const;

export type EmotionalTone = (typeof emotionalTones)[number];
export type EmotionalIntensity = (typeof emotionalIntensities)[number];
export type NoiseSeverity = (typeof noiseSeverities)[number];
export type AudioQuality = (typeof audioQualities)[number];

export type AudioPrediction = {
  emotional_tone: EmotionalTone;
  emotional_intensity: EmotionalIntensity;
  background_noise_present: boolean;
  background_noise_type: string;
  background_noise_severity: NoiseSeverity;
  audio_quality: AudioQuality;
  speaker_overlap_present: boolean;
  long_silence_present: boolean;
  confidence: number;
  field_confidence: Record<string, number>;
  diagnostics: Record<string, number | string | boolean>;
  stage_used: string;
  duration_seconds: number;
  processing_ms: number;
};

export function validatePrediction(value: AudioPrediction): AudioPrediction {
  if (!emotionalTones.includes(value.emotional_tone)) throw new Error("Invalid emotional tone");
  if (!emotionalIntensities.includes(value.emotional_intensity)) throw new Error("Invalid emotional intensity");
  if (!noiseSeverities.includes(value.background_noise_severity)) throw new Error("Invalid noise severity");
  if (!audioQualities.includes(value.audio_quality)) throw new Error("Invalid audio quality");
  if (value.confidence < 0 || value.confidence > 1) throw new Error("Confidence must be between 0 and 1");
  if (!value.background_noise_present && value.background_noise_severity !== "none") {
    throw new Error("Noise severity must be none when background noise is absent");
  }
  return value;
}