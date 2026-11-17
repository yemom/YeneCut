export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
  confidence: number;
}

export interface SilenceSettings {
  threshold_db: number;
  min_silence_duration: number;
  min_speech_duration: number;
  pre_speech_padding: number;
  post_speech_padding: number;
  noise_tolerance: number;
  sensitivity: number;
  preserve_breathing: boolean;
  preserve_background_music: boolean;
  preserve_short_pauses: boolean;
  preview_mode: boolean;
}

export const defaultSilenceSettings: SilenceSettings = {
  threshold_db: -40,
  min_silence_duration: 0.5,
  min_speech_duration: 0.25,
  pre_speech_padding: 0.1,
  post_speech_padding: 0.1,
  noise_tolerance: 0.05,
  sensitivity: 0.5,
  preserve_breathing: true,
  preserve_background_music: true,
  preserve_short_pauses: true,
  preview_mode: true,
};

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number | null;
  words?: { start: number; end: number; text: string; confidence?: number | null }[];
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface FontMetadata {
  id: string;
  family: string;
  category: string;
  style: string;
  license: string;
  source: string;
  sample_text: string;
  recommended_use: string[];
  weights: number[];
  paths: string[];
}

const DEFAULT_ENGINE_URL = "http://127.0.0.1:8765";
const DEFAULT_TOKEN = "yenecut-dev-token";

export function getEngineBaseUrl(): string {
  return localStorage.getItem("yenecut.engineUrl") || DEFAULT_ENGINE_URL;
}

export function getEngineToken(): string {
  return localStorage.getItem("yenecut.engineToken") || DEFAULT_TOKEN;
}

export function setEngineBaseUrl(url: string): void {
  localStorage.setItem("yenecut.engineUrl", url);
}

export function setEngineToken(token: string): void {
  localStorage.setItem("yenecut.engineToken", token);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getEngineBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-YeneCut-Token": getEngineToken(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Engine request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

export async function checkEngineHealth(): Promise<{ status: string; ffmpeg_available: boolean }> {
  const response = await fetch(`${getEngineBaseUrl()}/health`, {
    headers: { "X-YeneCut-Token": getEngineToken() },
  });
  if (!response.ok) throw new Error(`Engine unavailable: ${response.status}`);
  return response.json();
}

export async function analyzeAudio(sourcePath: string): Promise<{ status: string; duration: number; sample_rate: number }> {
  return request("/api/v1/audio/analyze", {
    method: "POST",
    body: JSON.stringify({ source_path: sourcePath }),
  });
}

export async function detectSilence(sourcePath: string, settings: SilenceSettings): Promise<{
  status: string;
  duration: number;
  silence_regions: SilenceRegion[];
  estimated_removable_duration: number;
  job_id?: string;
}> {
  return request(`/api/v1/silence/detect?sync=true`, {
    method: "POST",
    body: JSON.stringify({ source_path: sourcePath, settings }),
  });
}

export async function createTranscriptionJob(payload: {
  source_path: string;
  language?: string | null;
  model_size: string;
  word_timestamps: boolean;
}): Promise<{ status: string; job_id: string; language: string; segments: TranscriptSegment[] }> {
  return request("/api/v1/transcription/jobs?sync=true", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function segmentCaptions(payload: {
  segments: TranscriptSegment[];
  max_chars_per_line: number;
  max_lines: number;
  min_duration: number;
  max_duration: number;
  reading_speed_cps: number;
}): Promise<{ captions: CaptionSegment[] }> {
  return request("/api/v1/captions/segment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportCaptions(payload: {
  captions: CaptionSegment[];
  format: "srt" | "vtt" | "ass";
  output_path?: string;
  style?: Record<string, unknown>;
}): Promise<{ format: string; content: string; output_path?: string }> {
  return request("/api/v1/captions/export", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listFonts(): Promise<FontMetadata[]> {
  const response = await request<{ fonts: FontMetadata[] }>("/api/v1/fonts");
  return response.fonts;
}

export async function createPremiereTranscript(payload: { captions: { start: number; end: number; text: string }[]; language?: string }): Promise<{ json: string }> {
  return request("/api/v1/captions/premiere-transcript", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function validateFont(payload: { font_path?: string; family?: string }): Promise<{
  available: boolean;
  family: string;
  path?: string | null;
  message: string;
}> {
  return request("/api/v1/fonts/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
