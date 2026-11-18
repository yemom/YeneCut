# YeneCut AI (የነካት AI)

> **Edit Faster. Speak Amharic. Create Without Limits.**  
> Ethiopian AI-powered Adobe Premiere Pro UXP plugin and local intelligence engine.

---

## Overview

**YeneCut AI** is an Adobe Premiere Pro UXP extension and local Python AI engine purpose-built for video editors in Ethiopia. It integrates native Adobe Premiere timeline automation with state-of-the-art Amharic automatic speech recognition (ASR), intelligent silence detection, and Ethiopian Ge'ez font typography.

### Core Capabilities

1. **Intelligent Silence Removal**
   - Energy-based and Silero VAD detection.
   - Target-aware editing: Razors and deletes silence ONLY on the selected speaker clip.
   - **Protection guarantee:** Background music, sound effects, B-roll, and unrelated tracks are 100% untouched.
   - Non-destructive marker preview with one-click cleanup.
   - Full Premiere undo (Ctrl+Z) support.

2. **Amharic Auto Captions & Speech Recognition**
   - Faster-Whisper ASR engine supporting Amharic (`am-ET`), English, and auto-detection.
   - Ethiopic Unicode NFC normalization preserving all Ge'ez punctuation (`፡`, `፥`, `፤`, `።`).
   - Zero-text-loss subtitle segmentation engine.
   - Interactive transcript editor with live synchronized caption re-segmentation.
   - Export to industry-standard UTF-8 `.srt`, `.vtt`, `.ass`, or direct Premiere Pro transcript insertion.

3. **Ethiopian Font Studio**
   - Curated Open Font License (OFL) Ethiopian fonts: Noto Sans Ethiopic, Noto Serif Ethiopic, Abyssinica SIL.
   - Live Ge'ez typography preview.
   - Subtitle presets tuned for YouTube (16:9), TikTok / Instagram Reels (9:16 vertical), Broadcast News, and Documentaries.

---

## Architecture

```
Adobe Premiere Pro (Host)
  └── UXP Panel (React 18 + TypeScript + Vite)
        ├── TimeMappingService (Source Time <--> Sequence Timeline Time)
        └── Premiere UXP Adapter (Target-aware editing & transcript actions)
              │
              │  HTTP (127.0.0.1:8765) with X-YeneCut-Token
              ▼
Local Python AI Engine (FastAPI)
  ├── VAD Silence Detector (Energy & Silero)
  ├── ASR Engine (Faster-Whisper + Amharic Normalization)
  ├── Subtitle Segmentation & Export (SRT / VTT / ASS / Premiere JSON)
  └── Font Studio Registry
```

---

## Quick Start (Windows 11)

### 1. Prerequisites
- **OS:** Windows 11 (or Windows 10 64-bit)
- **Node.js:** v18+ (v22 LTS recommended)
- **Python:** 3.10+ (Python 3.11/3.13 supported)
- **Adobe Premiere Pro:** 25.1.0 or newer
- **FFmpeg:** Installed and on PATH

To verify your system:
```powershell
.\scripts\windows\check-prerequisites.ps1
```

### 2. Setup
Run the automated Windows setup scripts:
```powershell
# Setup Node & dependencies
.\scripts\windows\setup-node.ps1

# Setup Python AI engine & generate pairing secret
.\scripts\windows\setup-python.ps1
.\scripts\windows\setup-ai-engine.ps1
```

### 3. Start AI Engine
```powershell
.\scripts\windows\start-ai-engine.ps1
```
The engine starts locally on `http://127.0.0.1:8765`. Health status is available at `http://127.0.0.1:8765/health`.

### 4. Build the Premiere Pro Plugin
```powershell
.\scripts\windows\build-plugin.ps1
```
This bundles the React application into `apps/premiere-plugin/dist/` and runs automated UXP artifact validation.

### 5. Load in Premiere Pro
1. Open the **Adobe UXP Developer Tool** (UDT).
2. Click **Add Plugin** and select `apps/premiere-plugin/dist/manifest.json`.
3. In Adobe Premiere Pro, select **Window > Extensions > YeneCut AI**.

---

## Running Tests

Run the complete test suite (both Python AI engine and Frontend):
```powershell
.\scripts\windows\run-tests.ps1
```

Or individually:
```bash
# Python AI Engine (pytest)
cd apps/ai-engine
python -m pytest tests/ -v

# Premiere Plugin (vitest & typecheck)
cd apps/premiere-plugin
npm run typecheck
npm test
```

---

## Security & Local Privacy

- **100% Local:** Audio, transcripts, and video cuts are processed entirely on your local workstation. No external cloud dependencies or telemetry.
- **Localhost Bound:** The engine binds exclusively to `127.0.0.1`.
- **Token Pairing:** Every local installation generates a cryptographically random token stored in `%LOCALAPPDATA%\YeneCut\engine-credentials.json`.
- **Path Sandboxing:** Media paths are validated against allowed binary audio/video formats. `.prproj` and executable files are blocked.

---

## License

YeneCut AI is licensed under the MIT License. Included fonts (Noto Sans Ethiopic, Abyssinica SIL) are licensed under the SIL Open Font License (OFL 1.1).
