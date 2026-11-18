# YeneCut AI — Test Coverage and Verification Review

**Date:** 2026-11-18  
**Baseline Test Execution Results:**
- Python AI Engine (`pytest`): 10 passed in 18.76s
- Premiere Plugin Frontend (`vitest`): 3 passed in 57.30s

---

## 1. Existing Test Coverage Matrix

| Subsystem | Existing Tests | Coverage Assessment | Missing Critical Scenarios |
|---|---|---|---|
| **Health API** | `test_health` | Basic | FFmpeg availability check, GPU/device reporting |
| **Silence Detection** | `test_silence_detect_sync` | Synthetic sine wave | Asynchronous job polling, multi-channel audio, noisy backgrounds |
| **Amharic Processing** | `test_amharic_unicode_preserved`, `test_punctuation_correction`, `test_duplicate_detection` | Minimal unit | Extended paragraphs, archaic numbers, combined punctuation |
| **Subtitle Formats** | `test_segmentation_and_exports` | Basic format syntax | 100+ word stress tests, word loss verification, timestamp boundary verification |
| **Font Validation** | `test_fonts` | Basic existence | OTF/TTF format checks, system font discovery, font substitution |
| **Jobs System** | `test_jobs` | Basic state transition | Timeout handling, memory reclamation, cancellation during processing |
| **Plugin Frontend** | `App.test.tsx` (3 tests) | Smoke rendering | Time mapping, clip selection, transcript-to-caption synchronization |
| **Premiere Integration** | None (untested) | 0% | Multi-track safety, marker preview, rollback, transcript import |

---

## 2. Critical Regression Test Suite (Required Before Production)

### Test 1: Subtitle Segmentation Word Preservation (Zero Text Loss)
- **Objective:** Verify that segmenting long Amharic text preserves 100% of input words across output captions.
- **Assertion:** `sum(len(c.text.split()) for c in captions) == len(input_text.split())`.
- **Status:** Added to test suite.

### Test 2: Source to Sequence Time Mapping
- **Objective:** Verify that source silence intervals are translated into sequence space accurately.
- **Given:** Clip at sequence start `120.0s`, `sourceInPoint = 10.0s`, silence at source `[15.0s, 20.0s]`.
- **Expected:** Mapped interval is `[125.0s, 130.0s]`.
- **Status:** Added to test suite.

### Test 3: Multi-Track Timeline Razor Protection
- **Objective:** Ensure timeline editing only targets the designated track, leaving background music and B-roll untouched.
- **Assertion:** Video Track 1 (talking head) razored; Audio Track 2 (music) has zero cuts added.
- **Status:** Validated via unit mocks.

### Test 4: Premiere Transcript Language BCP-47 Code
- **Objective:** Verify that Premiere transcript payload never contains `??-??`.
- **Assertion:** `payload["language"] in ["am", "am-ET", "en-US", "und"]`.
- **Status:** Added to test suite.

### Test 5: Security File Extension Rejection
- **Objective:** Ensure `.prproj`, `.exe`, `.bat`, and `.dll` are rejected by media and font validators.
- **Status:** Added to test suite.
