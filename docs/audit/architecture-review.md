# YeneCut AI — Architecture Review

**Date:** 2026-11-18  
**Scope:** Complete system architecture, subsystem boundaries, data contracts, and component lifecycle.

---

## 1. System Architecture Diagram

```
+-------------------------------------------------------------------------+
|                        Adobe Premiere Pro (Host)                        |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                 UXP Plugin Panel (React 18 + TS)                  |  |
|  |                                                                   |  |
|  |  +-------------------+  +-------------------+  +---------------+  |  |
|  |  | Silence Removal   |  | Amharic Captions  |  | Font Studio   |  |  |
|  |  | Panel View        |  | Panel View        |  | Panel View    |  |  |
|  |  +---------+---------+  +---------+---------+  +-------+-------+  |  |
|  |            |                      |                    |          |  |
|  |  +---------v----------------------v--------------------v-------+  |  |
|  |  |                    TimeMappingService                       |  |  |
|  |  |       Source Media Space <--> Timeline Sequence Space       |  |  |
|  |  +--------------------------------+----------------------------+  |  |
|  |                                   |                               |  |
|  |  +--------------------------------v----------------------------+  |  |
|  |  |                   PremierePro UXP Adapter                   |  |  |
|  |  |  (Target-aware sequence editing, clip queries, marker mgmt)  |  |  |
|  +--+--------------------------------+----------------------------+--+  |
|                                      |                                   |
|                                      | HTTP API (127.0.0.1:8765)         |
|                                      | X-YeneCut-Token Header            |
+--------------------------------------v-----------------------------------+
                                       |
+--------------------------------------v-----------------------------------+
|                     Local AI Engine (FastAPI / Python)                   |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |                FastAPI HTTP Server & Security Boundary             |  |
|  |      (Token Auth, Path Sandboxing, Media Extension Validation)     |  |
|  +-----------------------------------+--------------------------------+  |
|                                      |                                   |
|  +-----------------+-----------------+-----------------+                 |
|  |                 |                                   |                 |
|  v                 v                                   v                 |
|  +-------------+   +-------------------------------+   +--------------+  |
|  | VAD Silence |   | Speech Recognition & Captions |   | Font Studio  |  |
|  | Engine      |   | (Faster-Whisper + Amharic     |   | Registry     |  |
|  | (Energy/    |   |  Normalizer + Segmenter)      |   | (SIL/Noto    |  |
|  |  Silero)    |   +---------------+---------------+   |  Validation) |  |
|  +-------------+                   |                   +--------------+  |
|                                    v                                     |
|                    +-------------------------------+                     |
|                    | Subtitle Exporters            |                     |
|                    | (SRT / VTT / ASS / Premiere)  |                     |
|                    +-------------------------------+                     |
+--------------------------------------------------------------------------+
```

---

## 2. Component Subsystems Analysis

### 2.1 Premiere Pro UXP Plugin Subsystem
- **Current State:** The plugin UI is built with React 18 and standard CSS. However, the build system was configured incorrectly for Adobe UXP:
  - UXP expects standard HTML loading bundled JavaScript via relative script tags.
  - The Vite configuration was generating CommonJS chunks with external dependencies `os`, `uxp`, and `premierepro`.
  - The HTML entrypoint in `public/` resulted in unprocessed script tags pointing to `index.tsx`.
- **Target Architecture:**
  - `apps/premiere-plugin/index.html` at plugin root as Vite entrypoint.
  - Vite bundling transforms TypeScript into self-contained scripts referenced in `dist/index.html`.
  - Manifest points to `index.html`.
  - Premiere Pro API access strictly isolated in `premiere.client.ts` and `timeline.service.ts`.

### 2.2 Time Mapping Architecture (Source Media vs Sequence Timeline)
- **Problem Statement:** Silence detection operates on physical audio extracted from source files (timeline starts at `0.0s` = start of file). Premiere Pro sequence clips represent arbitrary slices of this source file:
  - `sourceInPoint`: Start offset within source media.
  - `sourceOutPoint`: End offset within source media.
  - `startInSequence`: Where the clip begins on the timeline.
  - `endInSequence`: Where the clip ends on the timeline.
- **Formula:**
  $$\text{sequenceTime} = \text{clip.startInSequence} + (\text{sourceTime} - \text{clip.sourceInPoint})$$
- **Constraint:** Edits must be bounded:
  $$\text{clip.sourceInPoint} \le \text{sourceSilence.start} < \text{sourceSilence.end} \le \text{clip.sourceOutPoint}$$
- **Architectural Solution:** All silence intervals from the AI engine must pass through `mapSilenceIntervalsToSequence()` before being presented to the editor or applied to sequence tracks.

### 2.3 Silence Detection Pipeline
- **Providers:**
  - `EnergyVADDetector`: Low-latency, deterministic, dependency-free RMS energy calculator.
  - `SileroVAD`: High-accuracy neural VAD model (optional/configurable).
- **Post-Processing Pipeline:**
  $$\text{Audio} \rightarrow \text{VAD Speech Frames} \rightarrow \text{Invert to Silence} \rightarrow \text{Merge Gaps} \rightarrow \text{Apply Padding} \rightarrow \text{Target Track Cuts}$$

### 2.4 Amharic Captioning Pipeline
- **Engine:** Faster-Whisper (CTranslate2 backend).
- **Normalization:** Amharic Ethiopic Unicode block (`0x1200` to `0x137F`). NFC normalization is mandatory to avoid breaking Ge'ez combining marks and punctuation (such as `፥`, `፤`, `።`).
- **Segmentation Engine:**
  - Word-level greedy chunking when word timestamps exist.
  - Duration, line, and reading speed (CPS) budget enforcement without word dropping.
- **Export Formats:** UTF-8 encoded SRT, WebVTT, ASS, and Premiere Transcript JSON.

---

## 3. Data Contracts and Interface Boundaries

### 3.1 Silence Detection Request/Response
- `SilenceSettings`: Controls thresholds, durations, and paddings.
- `SilenceDetectionResponse`: Must support all asynchronous lifecycle states: `"queued" | "running" | "completed" | "failed" | "cancelled"`.

### 3.2 Premiere Transcript Payload
- BCP-47 language tag: `"am"` or `"am-ET"`.
- Speaker identifiers: Unique GUID per speaker.
- Segments array: Start, duration, words array (with real Whisper timestamps and probabilities when available).

---

## 4. Key Architectural Recommendations
1. Decouple timeline clip selection from project bin traversal.
2. Ensure all long-running operations in Python engine run in thread pools/executors to keep FastAPI event loop unblocked.
3. Keep frontend state synchronized: editing transcript triggers automatic re-computation of dependent caption segments.
