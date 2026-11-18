export interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  maxCharsPerLine: number;
  maxLines: number;
  minDuration: number;
  maxDuration: number;
  readingSpeedCps: number;
  style: {
    fontFamily: string;
    fontSize: number;
    primaryColor: string;    // ASS format: &H00FFFFFF (white)
    outlineColor: string;    // ASS format: &H00000000 (black)
    outlineWidth: number;
    shadowDistance: number;
    alignment: number;        // 2 = bottom center
    bold: boolean;
    italic: boolean;
  };
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  youtube: {
    id: "youtube",
    name: "YouTube Standard",
    description: "Standard 16:9 horizontal layout optimized for clarity and high readability.",
    maxCharsPerLine: 42,
    maxLines: 2,
    minDuration: 1.2,
    maxDuration: 6.0,
    readingSpeedCps: 17,
    style: {
      fontFamily: "Noto Sans Ethiopic",
      fontSize: 22,
      primaryColor: "&H00FFFFFF",
      outlineColor: "&H00000000",
      outlineWidth: 2,
      shadowDistance: 1,
      alignment: 2,
      bold: true,
      italic: false,
    },
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok & Reels (Vertical)",
    description: "Vertical 9:16 short-form video preset with centered bold subtitles.",
    maxCharsPerLine: 26,
    maxLines: 2,
    minDuration: 0.8,
    maxDuration: 3.5,
    readingSpeedCps: 20,
    style: {
      fontFamily: "Noto Sans Ethiopic",
      fontSize: 28,
      primaryColor: "&H0000FFFF", // Yellow highlight
      outlineColor: "&H00000000",
      outlineWidth: 3,
      shadowDistance: 2,
      alignment: 2,
      bold: true,
      italic: false,
    },
  },
  news: {
    id: "news",
    name: "Ethiopian News & Broadcast",
    description: "Traditional broadcast lower-third style with formal Ge'ez typography.",
    maxCharsPerLine: 40,
    maxLines: 2,
    minDuration: 1.5,
    maxDuration: 7.0,
    readingSpeedCps: 15,
    style: {
      fontFamily: "Noto Serif Ethiopic",
      fontSize: 20,
      primaryColor: "&H00FFFFFF",
      outlineColor: "&H00202020",
      outlineWidth: 2,
      shadowDistance: 1,
      alignment: 2,
      bold: false,
      italic: false,
    },
  },
  documentary: {
    id: "documentary",
    name: "Documentary & Cinematic",
    description: "Subtle, elegant serif styling for long-form narrative content.",
    maxCharsPerLine: 44,
    maxLines: 2,
    minDuration: 1.5,
    maxDuration: 6.5,
    readingSpeedCps: 14,
    style: {
      fontFamily: "Abyssinica SIL",
      fontSize: 20,
      primaryColor: "&H00E8E8E8",
      outlineColor: "&H00111111",
      outlineWidth: 1.5,
      shadowDistance: 1,
      alignment: 2,
      bold: false,
      italic: false,
    },
  },
};

export const subtitleTemplates = SUBTITLE_PRESETS;
