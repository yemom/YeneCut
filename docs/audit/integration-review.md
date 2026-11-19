# YeneCut AI — Host Integration Review (Adobe Premiere Pro UXP)

**Date:** 2026-11-18  
**Scope:** Adobe Premiere Pro UXP APIs, manifest compliance, timeline editing transactions, and host version support.

---

## 1. Adobe Premiere Pro UXP API Compliance

### 1.1 Manifest Specifications (`manifest.json`)
- **Manifest Version:** 5.
- **Minimum Host Version Declared:** `25.1.0`.
- **Installed Type Definitions:** `@adobe/premierepro@^27.0.0`, `@adobe/cc-ext-uxp-types@^7.3.1`.
- **Analysis:**
  - Premiere Pro 25.1+ supports modern UXP APIs including `SequenceEditor`, `lockedAccess`, `executeTransaction`, and `Markers`.
  - Declaring `minVersion: "25.1.0"` is aligned with the official Adobe developer documentation for UXP sequence editing actions.
  - Required permissions (`localFileSystem: "request"`, `network: ["http://127.0.0.1", "http://localhost"]`) conform to Adobe security requirements.

---

## 2. Timeline Editing Transactions Review

### 2.1 The Razor Cut Flaw
In the original `timeline.service.ts`:
```typescript
// DANGEROUS CODE IN ORIGINAL IMPLEMENTATION:
for (let i = 0; i < videoTrackCount; i++) {
  actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.VIDEO, i, position, true, ppro.Constants.MediaType.VIDEO));
}
for (let i = 0; i < audioTrackCount; i++) {
  actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.AUDIO, i, position, true, ppro.Constants.MediaType.VIDEO));
}
```
**Defects identified:**
1. Razors all tracks simultaneously. Background music on Audio Track 2 and sound effects on Audio Track 3 are razored into hundreds of fragments.
2. The second loop passes `ppro.Constants.MediaType.VIDEO` as the 5th parameter (`splitMediaType`) to `createRazorTrackAction` for an audio track, which is invalid in the Premiere Pro type model.

### 2.2 Correct Target-Aware Editing Pattern
The redesigned editing transaction operates under strict constraints:
1. Target track is determined from the user's active clip selection (`ClipInfo.trackIndex`, `ClipInfo.trackType`).
2. Only the target track and its linked audio/video track are razored.
3. Only clips originating from the target track are added to the removal selection.
4. Razoring and removal occur within an atomic `project.lockedAccess()` transaction.
5. If no clips are isolated for removal, the function reports `noOp: true` and restores timeline state.

---

## 3. Caption and Transcript Integration Review

### 3.1 Native Transcript Import API
- `ppro.Transcript.createImportTextSegmentsAction(ppro.Transcript.importFromJSON(json), clip)`:
  - This API requires a valid Premiere Transcript JSON structure.
  - Premiere Pro requires a recognized BCP-47 language tag (e.g., `"am"` or `"am-ET"`). The previously emitted `"??-??"` caused Premiere Pro's speech analysis subsystem to fail.
  - Word entries must contain either real timestamps from Faster-Whisper or be omitted.

### 3.2 Native Subtitle / SRT Import Fallback
- Because native Premiere caption track creation varies across minor UXP point releases, YeneCut AI implements a dual workflow:
  1. **Direct Transcript Insertion:** Uses `ppro.Transcript.createImportTextSegmentsAction` on the selected clip.
  2. **Standard Subtitle Export:** One-click export of industry-standard `.srt`, `.vtt`, or `.ass` files, which editors import directly via Premiere Pro's `File > Import` or the Text panel.

---

## 4. State Management and Stale Context

### 4.1 Lifecycle States Handled
- **Premiere Not Running / Host Disconnected:** Graceful fallback state with informative UI banner ("Premiere API unavailable — running in standalone browser preview").
- **No Active Project Open:** Displays "No project" without crashing.
- **No Active Sequence:** Disables timeline actions, prompts user to open a sequence.
- **No Clip Selected:** Instructs user to select a clip on the active sequence.
- **Missing / Offline Media:** Validates that `clip.mediaPath` exists before initiating silence detection or transcription.
