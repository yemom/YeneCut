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

export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
  confidence?: number | null;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number | null;
  words?: TranscriptWord[];
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

export interface JobStatus {
  job_id: string;
  job_type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  error?: string | null;
  result?: any;
}

const DEFAULT_ENGINE_URL = "http://127.0.0.1:8765";
const DEFAULT_TOKEN = "yenecut-dev-token";

export function getEngineBaseUrl(): string {
  try {
    return localStorage.getItem("yenecut.engineUrl") || DEFAULT_ENGINE_URL;
  } catch {
    return DEFAULT_ENGINE_URL;
  }
}

export function getEngineToken(): string {
  try {
    return localStorage.getItem("yenecut.engineToken") || DEFAULT_TOKEN;
  } catch {
    return DEFAULT_TOKEN;
  }
}

export function setEngineBaseUrl(url: string): void {
  try {
    localStorage.setItem("yenecut.engineUrl", url);
  } catch {
    // Ignore storage errors in test or restricted environments
  }
}

export function setEngineToken(token: string): void {
  try {
    localStorage.setItem("yenecut.engineToken", token);
  } catch {
    // Ignore storage errors
  }
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

export async function checkEngineHealth(): Promise<{
  status: string;
  service?: string;
  version?: string;
  ffmpeg_available: boolean;
  faster_whisper_available?: boolean;
}> {
  const response = await fetch(`${getEngineBaseUrl()}/health`);
  if (!response.ok) throw new Error(`Engine unavailable: ${response.status}`);
  return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return request<JobStatus>(`/api/v1/jobs/${jobId}`);
}

export async function cancelJob(jobId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/v1/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function analyzeAudio(sourcePath: string): Promise<{ status: string; duration: number; sample_rate: number }> {
  return request("/api/v1/audio/analyze", {
    method: "POST",
    body: JSON.stringify({ source_path: sourcePath }),
  });
}

export async function detectSilence(
  sourcePath: string,
  settings: SilenceSettings,
  sync: boolean = true
): Promise<{
  status: string;
  duration: number;
  silence_regions: SilenceRegion[];
  estimated_removable_duration: number;
  job_id?: string;
}> {
  return request(`/api/v1/silence/detect?sync=${sync}`, {
    method: "POST",
    body: JSON.stringify({ source_path: sourcePath, settings }),
  });
}

export async function createTranscriptionJob(payload: {
  source_path: string;
  language?: string | null;
  model_size: string;
  word_timestamps: boolean;
  sync?: boolean;
}): Promise<{ status: string; job_id: string; language: string; segments: TranscriptSegment[] }> {
  const sync = payload.sync ?? true;
  return request(`/api/v1/transcription/jobs?sync=${sync}`, {
    method: "POST",
    body: JSON.stringify({
      source_path: payload.source_path,
      language: payload.language,
      model_size: payload.model_size,
      word_timestamps: payload.word_timestamps,
    }),
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

export async function createPremiereTranscript(payload: {
  captions: {
    start: number;
    end: number;
    text: string;
    words?: { start: number; end: number; text: string; confidence?: number | null }[];
  }[];
  language?: string;
}): Promise<{ json: string }> {
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
