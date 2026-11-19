# YENECUT AI — SYSTEM ARCHITECTURE

## 1. High-Level Architecture Overview

YeneCut AI is composed of two primary subsystems operating in a decoupled, zero-cloud, privacy-preserving architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADOBE PREMIERE PRO (HOST)                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           YENECUT UXP EXTENSION (REACT 18 + TS)           │  │
│  │                                                           │  │
│  │  - Dashboard & Workflow Tabs (Silence, Captions, Fonts)  │  │
│  │  - TimeMappingService (Source <--> Sequence Coordinates)  │  │
│  │  - LinkedClipResolver (ProjectItem identity correlation)  │  │
│  │  - EditPlan Builder (Pre-mutation validation)             │  │
│  │  - Atomic Transaction Executor (executeTransaction)      │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                 HTTP REST API   │ Loopback Only: 127.0.0.1:8765
         Header: X-YeneCut-Token │ Pairing Secret
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   LOCAL PYTHON AI ENGINE (FASTAPI)              │
│                                                                 │
│  - FastAPI Web Server (uvicorn, loopback binding)              │
│  - VAD Silence Detector (Silero VAD + Deterministic Energy VAD) │
│  - Amharic ASR (Faster-Whisper + Unicode NFC normalization)    │
│  - Subtitle Segmenter (Zero-word-loss sentence segmenter)       │
│  - Font Studio Registry (Ge'ez fonts: Noto Sans, Abyssinica)   │
│  - Job Manager (State machine: QUEUED -> RUNNING -> COMPLETED)  │
│  - Security Sandbox (realpath symlink checks, binary whitelist) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Adobe Premiere Pro UXP Plugin (`apps/premiere-plugin`)
- **Technology:** React 18, TypeScript 5, Vite 8, Adobe UXP API v5.
- **Role:** Interactive panel inside Premiere Pro (`Window > Extensions > YeneCut AI`).
- **Isolation Invariant:** Never accesses project bins or arbitrary tracks to infer context. All operations start from active timeline selection retrieved via `sequence.getSelection()`.
- **Coordinate Transformation:** Clips on a sequence timeline have both `sequence` time and `source media` time. The `TimeMappingService` maps timestamps accurately, accounting for clip in-points and sequence offsets.

### 2.2 Local Python AI Engine (`apps/ai-engine`)
- **Technology:** Python 3.10+, FastAPI, PyTorch / ONNX Runtime, Faster-Whisper, Soundfile, NumPy.
- **Port & Host:** `127.0.0.1:8765` (never exposed to external interfaces).
- **Authentication:** Header `X-YeneCut-Token` matching cryptographically generated token stored in `%LOCALAPPDATA%\YeneCut\engine-credentials.json`.

---

## 3. Core Operational Workflows

### 3.1 Silence Detection & Safe Removal Workflow
1. **User selects clip** on the Premiere timeline.
2. Plugin queries selected clip `ClipInfo` (source in/out, sequence start/end, track index).
3. Plugin sends request to `POST /api/v1/silence/detect` with media path and threshold parameters.
4. Engine processes audio via VAD and returns `silence_regions` (in source media seconds) and `detector_metadata`.
5. Plugin translates source silence intervals to sequence coordinates via `mapSilenceIntervalsToSequence`.
6. Plugin constructs an immutable `EditPlan` containing target clip identity (`ProjectItem.getId()`), resolved linked audio/video track items, and frame-aligned cut boundaries.
7. User may review cuts non-destructively via **"Preview as Markers"**.
8. When applying cuts, the user confirms via UI prompt.
9. Operations execute atomically inside `project.executeTransaction()`, registering a single Undo entry in Premiere Pro history.

### 3.2 Amharic Transcription & Caption Generation
1. Selected media path is submitted to `POST /api/v1/transcription/jobs`.
2. Faster-Whisper generates word-level timestamps with language code `am`.
3. Engine performs Ethiopic Unicode NFC normalization preserving all Ge'ez punctuation (`፡`, `፥`, `፤`, `።`).
4. `segment_transcript()` splits words into readable 1-2 line captions adhering to character-per-line and reading-speed limits without dropping a single word.
5. Captions can be exported to standard UTF-8 `.srt`, `.vtt`, or inserted directly into Premiere's text panel.

---

## 4. Security & Isolation Architecture

- **Loopback Enforcement:** Binds exclusively to `127.0.0.1`.
- **Token Secret Lifecycle:** Generated via OS CSPRNG (`System.Security.Cryptography.RandomNumberGenerator`).
- **Path Whitelist:** Only approved media extensions (`.wav`, `.mp3`, `.m4a`, `.aac`, `.flac`, `.ogg`, `.mp4`, `.mov`, `.mkv`, `.avi`, `.mxf`) are accepted. Project files (`.prproj`) and executable scripts (`.exe`, `.bat`, `.ps1`) are rejected at the API boundary.
- **Symlink & Junction Defense:** All file paths are validated through `os.path.realpath` to prevent directory traversal escapes.
