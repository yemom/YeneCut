# YENECUT AI — SYSTEM & DEPENDENCY COMPATIBILITY

## 1. Supported Environments

| Component | Minimum Version | Recommended Version | Compatibility Status |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10 64-bit (21H2+) | Windows 11 64-bit | Verified supported |
| **Adobe Premiere Pro** | v25.1.0 | v25.1.0 – v26.2+ | Manifest v5 (v24.x not supported due to manifest minVersion) |
| **UXP Runtime** | v7.0 | v8.0+ | Verified supported |
| **Node.js** | v18.0.0 | v22 LTS | Verified supported |
| **Python** | v3.10.0 | v3.11 / v3.13 | Verified supported |
| **FFmpeg** | v4.4+ | v6.0+ | Recommended for non-WAV media |

---

## 2. Adobe Premiere Pro Version Compatibility Matrix

### Minimum Host Version Reconciled
The UXP plugin manifest (`apps/premiere-plugin/public/manifest.json`) strictly declares:
```json
"host": {
  "app": "premierepro",
  "minVersion": "25.1.0"
}
```
**Premiere Pro 24.x is NOT supported.** Even though certain underlying UXP APIs exist in v24.x, the Premiere Pro host application enforces `manifest.json` at plugin load time and will reject loading YeneCut AI on Premiere Pro v24.x. The true minimum supported version is **Premiere Pro 25.1.0**.

### Frame-Rate Resolution & Timeline Timebase
Adobe Premiere Pro introduced `SequenceSettings.getVideoFrameRate()` in v26.2. Version 25.1.0 does not expose this method. YeneCut implements a dual-mode fallback strategy to ensure frame accuracy across the supported host range:

1. **Host v26.2+**: Calls `sequenceSettings.getVideoFrameRate()` to obtain exact sequence frame rate.
2. **Host v25.1.0 – v26.1.x**: Calls `sequence.getTimebase()` to obtain ticks-per-frame integer, calculating frame rate via `254016000000 / timebaseTicks` with sub-tick accuracy.
3. **Safety Fallback**: If sequence metadata is locked or inaccessible, defaults to target clip frame rate or sequence standard 25 fps, logging a diagnostic note.

### UXP API Implementation Evidence
| Capability | API Method / Contract | Host Availability | Validation Method |
| :--- | :--- | :--- | :--- |
| **Transaction Atomicity** | `project.executeTransaction(actionGroup => ..., name)` | Premiere Pro 25.1.0+ | Vitest automated transaction tests (Live host test pending) |
| **Clip Removal** | `project.createRemoveItemsAction(selection)` | Premiere Pro 25.1.0+ | Vitest automated action tests |
| **Marker Management** | `marker.createRemoveMarkerAction()` / `project.createRemoveMarkerAction()` | Premiere Pro 25.1.0+ | Vitest + runtime feature check |
| **Freshness Verification** | `verifyPlanFreshness(sequence, ppro, plan)` | Premiere Pro 25.1.0+ | Re-reads start/end/source in/out prior to transaction |

---

## 3. Audio & Video Formats

| Format | Extension | Container | Extraction Method |
| :--- | :--- | :--- | :--- |
| **WAV** | `.wav` | Linear PCM 16-bit / 24-bit | Native soundfile loader |
| **MP3** | `.mp3` | MPEG-1 Audio Layer III | FFmpeg / Soundfile |
| **AAC / M4A** | `.aac`, `.m4a` | MP4 Audio | FFmpeg stream demuxing |
| **MP4 / MOV** | `.mp4`, `.mov` | H.264, HEVC, ProRes | FFmpeg audio track demuxing |
| **MXF** | `.mxf` | Broadcast format | FFmpeg demuxing |

---

## 3. Ethiopian Font Support

| Font Family | Format | License | Ge'ez Shaping |
| :--- | :--- | :--- | :--- |
| **Noto Sans Ethiopic** | `.ttf` | Open Font License (OFL 1.1) | Full Ethiopic Unicode coverage |
| **Noto Serif Ethiopic** | `.ttf` | Open Font License (OFL 1.1) | Full Ethiopic Unicode coverage |
| **Abyssinica SIL** | `.ttf` | Open Font License (OFL 1.1) | Classical Ethiopic ligatures |
