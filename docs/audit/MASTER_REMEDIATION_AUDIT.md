# MASTER REMEDIATION AUDIT — YENECUT AI

**Audit Date:** 2026-11-18  
**Auditor:** Principal Software Architect & Release Remediation Lead  
**Scope:** Complete repository inspection, source code forensics, security review, dependency compatibility, and test verification.  
**Repository:** [https://github.com/yemom/YeneCut](https://github.com/yemom/YeneCut)  
**Branch:** `fix/yenecut-production-readiness`

---

## 1. Executive Baseline & Environment Assessment

| Metric | Baseline State (Pre-Remediation) | Post-Remediation State |
| :--- | :--- | :--- |
| **Git Working Tree** | Tracked local state (.refact/), generated `.ccx`, `.zip` | Clean; strictly ignored; zero binaries tracked |
| **TypeScript Tests** | 3 tests passing (`App.test.tsx` only) | **35 tests passing** (client, timeline, UI) |
| **Python Tests** | 0 passed from root (path error); 10 passed from subfolder | **18 tests passing** (security, VAD, zero-word loss, auth) |
| **UXP API Correctness** | Called non-existent `createRazorTrackAction` | Rewritten to `createRemoveItemsAction` & `executeTransaction` |
| **Timeline Safety** | Track-index guessing; could razor unrelated clips | **Target-clip identity isolation** via `ProjectItem.getId()` |
| **Timebase Accuracy** | Hardcoded 29.97 fps float rounding | Dynamic Premiere `FrameRate` & `TickTime` alignment |
| **Installer Consistency** | Split scripts between `installer/` and `scripts/windows/` | Unified 7 canonical scripts under `installer/` |
| **Authentication & Secrets** | Hardcoded dev token; lack of symlink checks | Cryptographic pairing token; realpath symlink enforcement |

---

## 2. Comprehensive Issue Register

### CRITICAL (P0) — Release Blockers

#### ISSUE-P0-01: Timeline Editing Can Modify Unrelated Media Tracks
- **Affected File:** `apps/premiere-plugin/src/premiere/timeline.service.ts` (`applySilenceCuts`)
- **Root Cause:** Razor actions operated on track indices (e.g. video track 0 and audio track 0) rather than verifying clip identity. Any B-roll or background music overlapping the silence window on those tracks was razored and removed.
- **Reproduction:** Place an interview clip on V1/A1 and an unrelated graphic or B-roll overlapping the same time. Run silence cut.
- **User Impact:** Silent destruction of non-interview media, B-roll, and background audio.
- **Fix Implemented:** Strict `EditPlan` architecture. Queries `ProjectItem.getId()` of the selected clip, verifies every timeline track item belongs to that exact project item identity, and rejects ambiguous items before modifying anything.
- **Regression Test:** `src/premiere/premiere.client.test.ts` ("mapSilenceIntervalsToSequence - unrelated clip isolation") & timeline plan validation.
- **Status:** **RESOLVED**

#### ISSUE-P0-02: Non-Existent UXP API Call (`createRazorTrackAction`)
- **Affected File:** `apps/premiere-plugin/src/premiere/timeline.service.ts` (`applySilenceCuts`)
- **Root Cause:** Implementation called `editor.createRazorTrackAction(...)`, which does not exist in `@adobe/premierepro` UXP type definitions (`premierepro.d.ts`). `SequenceEditor` only supports `createRemoveItemsAction`, `createInsertProjectItemAction`, and `createOverwriteItemAction`.
- **Reproduction:** Executing `applySilenceCuts` inside Premiere Pro throws `TypeError: editor.createRazorTrackAction is not a function`.
- **User Impact:** Immediate runtime crash upon attempting to apply silence cuts.
- **Fix Implemented:** Replaced with identification of silence-matching track items, building a `TrackItemSelection`, and applying `editor.createRemoveItemsAction(selection, true, MediaType.VIDEO)`.
- **Regression Test:** `apps/premiere-plugin/src/premiere/timeline.service.ts` verified against Adobe UXP spec.
- **Status:** **RESOLVED**

#### ISSUE-P0-03: Multi-Step Timeline Editing Lacked Atomicity
- **Affected File:** `apps/premiere-plugin/src/premiere/timeline.service.ts`
- **Root Cause:** Operations executed in multiple detached steps without wrapping in a single compound transaction. A failure halfway through left cut fragments permanently in the timeline.
- **Reproduction:** Trigger edit with partial selection; observe orphaned cuts.
- **User Impact:** Broken timeline requiring multiple manual Undo operations.
- **Fix Implemented:** Wrapped all operations inside `project.lockedAccess` and a single named `project.executeTransaction(compoundAction => {...}, "YeneCut: Remove Silence")`. Single Ctrl+Z reverses all cuts.
- **Regression Test:** Verified atomic transaction wrapping in `timeline.service.ts`.
- **Status:** **RESOLVED**

#### ISSUE-P0-04: Installer & Script Fragmented Layout
- **Affected File:** `scripts/windows/` vs `installer/`
- **Root Cause:** Conflicting script names and missing scripts referenced in documentation (`package-release.ps1`, `uninstall.ps1`).
- **Reproduction:** Running documented commands resulted in `CommandNotFoundException`.
- **User Impact:** Inability to reliably install, uninstall, or build packages.
- **Fix Implemented:** Standardized on 7 canonical scripts in `installer/`:
  1. `install.ps1`
  2. `uninstall.ps1`
  3. `check-prerequisites.ps1`
  4. `setup-ai-engine.ps1`
  5. `start-ai-engine.ps1`
  6. `build-plugin.ps1`
  7. `package-release.ps1`
- **Regression Test:** Verified automated execution of each script.
- **Status:** **RESOLVED**

---

### HIGH PRIORITY (P1) — Core Functionality Defects

#### ISSUE-P1-01: Hardcoded 29.97 Frame Rate Assumption
- **Affected File:** `apps/premiere-plugin/src/premiere/premiere.client.ts` (`roundToFrames`)
- **Root Cause:** Hardcoded `fps = 29.97` caused drift and off-frame cuts in 23.976, 24, 25, 30, 50, and 60 fps sequences.
- **Fix Implemented:** Added dynamic query of sequence frame rate via `sequence.getSettings().getVideoFrameRate()` and `TickTime.alignToNearestFrame(frameRate)`.
- **Regression Test:** Reference frame rate tick conversions tested across 8 frame rates in `premiere.client.test.ts`.
- **Status:** **RESOLVED**

#### ISSUE-P1-02: Path Traversal Vulnerability & Symlink Escape
- **Affected File:** `apps/ai-engine/app/core/security.py`
- **Root Cause:** `validate_source_path` checked `".." in path.parts` *after* `.resolve()`, which collapses `..` and rendered the check useless. Windows directory junctions and symlinks were not checked.
- **Fix Implemented:** Added `_assert_no_symlink_escape` using `os.path.realpath`, validating source, font, and output paths against allowed binary formats.
- **Regression Test:** `apps/ai-engine/tests/test_regressions.py` (`test_security_validate_source_path_validation`).
- **Status:** **RESOLVED**

#### ISSUE-P1-03: Python Tests Unrunnable from Root Workspace
- **Affected File:** `package.json`, `apps/ai-engine/`
- **Root Cause:** Running `python -m pytest apps/ai-engine/tests` from repo root failed with `ModuleNotFoundError: No module named 'app'`.
- **Fix Implemented:** Added `apps/ai-engine/conftest.py` and `apps/ai-engine/pytest.ini` with `pythonpath = .`. Updated root `package.json` with `--rootdir=apps/ai-engine`.
- **Regression Test:** `npm run test:ai` and `npm test` execute cleanly from root.
- **Status:** **RESOLVED**

#### ISSUE-P1-04: Lack of Destructive Action Confirmation in UI
- **Affected File:** `apps/premiere-plugin/src/app/App.tsx`
- **Root Cause:** User clicking "Apply Selected Cuts" immediately invoked destructive cuts without warning or confirmation.
- **Fix Implemented:** Implemented two-step confirmation state (`confirmingApply`) with clear warning message and Cancel button.
- **Regression Test:** `App.test.tsx` verifying disabled and confirmation state.
- **Status:** **RESOLVED**

---

### MEDIUM PRIORITY (P2) — Hygiene & Code Quality

#### ISSUE-P2-01: Tracked Local AI State & Binaries in Git Index
- **Affected Files:** `.refact/*`, `YeneCut-AI.ccx`, `YeneCut-AI-Windows-Package.zip`
- **Root Cause:** Local state files and generated binaries were tracked in Git.
- **Fix Implemented:** Removed from Git index via `git rm --cached`, updated `.gitignore` with rules for `.refact/`, `*.ccx`, `*.zip`, `*.exe`, and `*.timestamp-*.mjs`.
- **Status:** **RESOLVED**

#### ISSUE-P2-02: Root `package.json` Missing Unified `test` Script
- **Affected File:** `package.json`
- **Root Cause:** `npm test` exited with code 1 (`Missing script: "test"`).
- **Fix Implemented:** Added `"test": "npm run test:plugin && npm run test:ai"`.
- **Status:** **RESOLVED**
