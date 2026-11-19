# REAL ADOBE PREMIERE PRO INTEGRATION VALIDATION PLAN

**Document Status:** PENDING LIVE PREMIERE SESSION  
**Target Premiere Pro Versions:** 25.1.0 (v2025), 24.6.0 (v2024 LTS)  
**Host Platform:** Windows 11 Pro 64-bit

> **STRICT INTEGRATION HONESTY CONTRACT:**
> Unit tests and mocked UXP interfaces have run and passed in CI. However, per the non-negotiable remediation directives, **mocked tests do NOT constitute live Premiere Pro integration validation**. This document specifies the exact test protocol to be executed inside a live Premiere Pro session before final production release approval.

---

## 1. Test Matrix

| Test ID | Area | Test Procedure | Expected Outcome | Live Result |
| :--- | :--- | :--- | :--- | :--- |
| **LIV-01** | Manifest & Load | Load `apps/premiere-plugin/dist/manifest.json` in UDT. Open *Window > Extensions > YeneCut AI*. | Panel opens without console errors; UI renders smoothly. | *PENDING* |
| **LIV-02** | Clip Resolution | Select an interview clip on V1/A1. Check Dashboard. | Clip name, timeline in/out, and media path display accurately. | *PENDING* |
| **LIV-03** | Silence Markers | Run silence analysis and click "Preview as Markers". | Comment markers added across silence intervals; media clips remain untouched. | *PENDING* |
| **LIV-04** | Marker Cleanup | Click "Clear Markers". | Only YeneCut preview markers are removed; user markers preserved. | *PENDING* |
| **LIV-05** | Clip-Level Isolation | Place B-roll on V2 overlapping interview silence. Click "Confirm Apply Cuts". | Interview silence segments removed; B-roll on V2 remains 100% intact. | *PENDING* |
| **LIV-06** | Atomic Undo | Press `Ctrl+Z` after applying cuts. | Entire cut and ripple operation rolls back in a single undo step. | *PENDING* |
| **LIV-07** | Frame Accuracy | Test across 23.976 fps, 25 fps, 29.97 fps, and 59.94 fps sequences. | Cuts snap precisely to frame boundaries with zero drift. | *PENDING* |
| **LIV-08** | Amharic Captions | Transcribe Amharic audio clip; insert transcript or export SRT. | Ge'ez characters render with proper shaping in Premiere Text panel. | *PENDING* |
| **LIV-09** | Font Rendering | Apply Noto Sans Ethiopic / Abyssinica SIL in Essential Graphics. | Subtitle styles display Ethiopic punctuation (`፡`, `።`) without font fallback boxes. | *PENDING* |
| **LIV-10** | Error Recovery | Disconnect engine or select empty sequence. | User-friendly sanitized error banner appears; UI does not freeze. | *PENDING* |

---

## 2. Test Execution Harness & Log Collection

1. Open Adobe UXP Developer Tool (UDT).
2. Click **Add Plugin** -> Select `apps/premiere-plugin/dist/manifest.json`.
3. Click **Load**.
4. Open the Debugger console in UDT to capture all `console.log` statements prefixed with `[YeneCut]`.
5. Execute Test Cases LIV-01 through LIV-10 sequentially and record results.
