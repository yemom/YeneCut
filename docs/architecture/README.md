# YeneCut AI — Architecture & Engineering Specification

## 1. Overview & Separation of Concerns

YeneCut AI is partitioned into two cooperating environments:
1. **Premiere Pro UXP Plugin (`apps/premiere-plugin`):**
   - Renders inside Adobe Premiere Pro as a panel.
   - Communicates with the host DOM via Premiere Pro UXP APIs (`@adobe/premierepro`).
   - Translates timeline context into time-mapped coordinates.
   - Initiates AI processing requests to the local engine.
2. **Local Python AI Engine (`apps/ai-engine`):**
   - Standalone FastAPI daemon running on `127.0.0.1:8765`.
   - Handles heavy computational workloads: FFmpeg audio extraction, VAD silence analysis, Faster-Whisper ASR, and subtitle segmentation.
   - Provides asynchronous job queues with progress tracking and cancellation.

---

## 2. Time Mapping System

Silence detection and transcription operate on source media audio files (where time 0 is the beginning of the file). Premiere Pro sequence clips represent slices of media placed at arbitrary sequence times.

### Coordinate Transformation Formula
```
sequenceTime = clip.startInSequence + (sourceTime - clip.sourceInPoint)
```
Bounds condition:
`clip.sourceInPoint <= sourceSilence.start < sourceSilence.end <= clip.sourceOutPoint`

Any silence interval falling outside `[clip.sourceInPoint, clip.sourceOutPoint]` is excluded.

---

## 3. Safe Timeline Editing Protocol

1. User selects a clip on the active sequence.
2. Plugin queries selected clip properties via `getSelectedClips()`.
3. Silence intervals are analyzed by the AI engine.
4. Silence intervals are mapped to sequence time via `mapSilenceIntervalsToSequence()`.
5. Atomic transaction is opened with `project.lockedAccess()`.
6. Only the target clip's track and its linked audio/video track partner are razored.
7. Only clip fragments fully enclosed within silence windows on the target track are removed.
8. If 0 items are removed, transaction is marked `noOp: true` without reporting false success.
