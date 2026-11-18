export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
  confidence: number;
}

export type CaptionFormat = "srt" | "vtt" | "ass";
