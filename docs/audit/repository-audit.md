# YeneCut AI — Comprehensive Repository Audit

**Date:** 2026-11-18  
**Repository:** https://github.com/yemom/YeneCut  
**Product:** YeneCut AI (Ethiopian AI-powered Adobe Premiere Pro UXP plugin)  
**Target Platform:** Windows 11 / Adobe Premiere Pro 25.1+  
**Branch Audited:** `fix/yenecut-production-readiness`  

---

## 1. Executive Summary

YeneCut AI is designed as a hybrid Adobe Premiere Pro UXP plugin paired with a local Python FastAPI AI engine. It targets video editors producing Amharic and multilingual content in Ethiopia. The core capabilities comprise:
1. Intelligent silence detection and removal.
2. Amharic automatic speech recognition and caption generation using Faster-Whisper.
3. Ethiopian Ge'ez font management and subtitle styling.
4. Adobe Premiere Pro timeline automation via UXP APIs.

The baseline audit revealed critical architectural, security, and functional blockers that prevent production use. Most notably:
- The UXP build pipeline outputs an `index.html` referencing non-existent TypeScript source (`./index.tsx`), causing the plugin to fail on launch in Premiere Pro.
- The silence cutting service razors every track across the entire timeline (including background music and B-roll), and uses source timestamps directly as sequence timestamps without coordinate transformation.
- The subtitle segmentation algorithm silently drops spoken words when lines reach the maximum line budget.
- The Premiere transcript generator hardcodes `??-??` as the language code and manufactures artificial `confidence: 1.0` metrics.
- Over 2,000 files in `node_modules`, `dist`, and Python `__pycache__` directories were checked into git.

---

## 2. Identified Issues Registry

### P0 — Critical / Blocker / Safety Issues

#### ISSUE-P0-01: UXP Plugin Entrypoint Broken (References Source `.tsx` in Distribution)
- **Severity:** P0
- **File Path:** `apps/premiere-plugin/public/index.html`, `apps/premiere-plugin/vite.config.mjs`
- **Relevant Function/Config:** Vite build configuration (`publicDir: "public"`, `rolldownOptions.input`)
- **Actual Problem:** `index.html` is located inside `public/`. In Vite, files in `public/` are copied verbatim to `dist/` without script bundling. `dist/index.html` contains `<script type="module" src="./index.tsx"></script>`. In production, no `.tsx` file exists, and Adobe UXP cannot parse TypeScript at runtime.
- **Root Cause:** Misunderstanding of Vite's HTML entrypoint model; entrypoint was treated as a static public asset while bundling `index.tsx` separately as CommonJS into `dist/index.js`.
- **User Impact:** The plugin fails to load completely when opened in Premiere Pro; panel displays a blank screen or throws a script loading error.
- **Recommended Solution:** Move `index.html` to the root of `apps/premiere-plugin/`, configure standard Vite `rollupOptions.input` pointing to `index.html`, and add a build verification script to validate `dist/index.html`.
- **Test Required:** Build verification test parsing `dist/index.html` to ensure zero `.tsx` references and confirm referenced bundled scripts exist on disk.

#### ISSUE-P0-02: Timeline Service Destroys All Audio and Video Tracks (Razors Every Track)
- **Severity:** P0 (Data Loss / Timeline Corruption)
- **File Path:** `apps/premiere-plugin/src/premiere/timeline.service.ts`
- **Relevant Function:** `applySilenceCuts()` (lines 38–43, 52–73)
- **Actual Problem:** The loop iterates through `0 < videoTrackCount` and `0 < audioTrackCount`, inserting razor cuts across every single track on the sequence. It then selects and deletes any clip on any track falling within the timestamp window.
- **Root Cause:** Lack of target-clip awareness and track scoping. Line 42 even passes `ppro.Constants.MediaType.VIDEO` as target media type when razoring audio tracks.
- **User Impact:** Background music, sound effects, B-roll, voiceover, and graphics tracks are sliced and deleted destructively.
- **Recommended Solution:** Implement target-aware editing. Only razor and remove clips on the track containing the user-selected clip (and its linked audio/video track). Never iterate over all sequence tracks.
- **Test Required:** Regression test with multi-track mock (talking head + background music + B-roll) ensuring music and B-roll track items are untouched.

#### ISSUE-P0-03: Silence Intervals Applied as Sequence Time Without Time Mapping
- **Severity:** P0
- **File Path:** `apps/premiere-plugin/src/premiere/timeline.service.ts`
- **Relevant Function:** `applySilenceCuts()`
- **Actual Problem:** Silence detection returns timestamps relative to the source media file (0 to file duration). `applySilenceCuts()` treats these source timestamps directly as sequence timeline timestamps.
- **Root Cause:** Omission of source-to-sequence coordinate transformation (`sequenceTime = clip.startInSequence + (sourceTime - clip.sourceInPoint)`).
- **User Impact:** If a clip starts at 2 minutes (120s) in the sequence, a silence at 5s in the media file is cut at 5s in the sequence, destroying unrelated media at the beginning of the timeline.
- **Recommended Solution:** Implement a dedicated `TimeMappingService` computing exact sequence intervals bounded by `clip.sourceInPoint` and `clip.sourceOutPoint`.
- **Test Required:** Unit test mapping source silence [10.0, 15.0] on a clip positioned at [120.0, 180.0] with `sourceInPoint = 5.0` -> expected sequence cut interval [125.0, 130.0].

#### ISSUE-P0-04: Subtitle Segmenter Discards Words on Line Overflow
- **Severity:** P0
- **File Path:** `apps/ai-engine/app/engines/subtitles/segmenter.py`
- **Relevant Function:** `_split_text_for_lines()` (line 18)
- **Actual Problem:** When `len(lines) >= max_lines`, the loop executes `break`. Any remaining words in the input text are silently discarded.
- **Root Cause:** Loop termination condition inside line break logic instead of accumulating overflow into subsequent caption blocks.
- **User Impact:** Long sentences or rapid Amharic speech lose the end of phrases in generated subtitles.
- **Recommended Solution:** Refactor segmentation into a chunking pipeline where words are never dropped. Overflow words must form subsequent caption chunks or overflow into the last line.
- **Test Required:** Regression test segmenting a 100-word Amharic text; verify total word count across output captions exactly equals input word count.

#### ISSUE-P0-05: Premiere Transcript Emits Hardcoded Placeholder Language and Fabricated Confidence
- **Severity:** P0
- **File Path:** `apps/ai-engine/app/api/routes/premiere_transcript.py`
- **Relevant Function:** `premiere_transcript()` (lines 16, 32, 42, 48)
- **Actual Problem:** Emits `"language": "??-??"` hardcoded. Fabricates word-level timestamps by equal-interval division and assigns `confidence: 1.0` to every word.
- **Root Cause:** Placeholder prototyping code left in production route.
- **User Impact:** Premiere Pro transcript engine rejects invalid language code `??-??`. Artificial confidence 1.0 misleads downstream speech tools and QA checks.
- **Recommended Solution:** Accept actual BCP-47 language codes (`am`, `am-ET`, `en-US`). Use real Whisper word timestamps when available; omit fabricated confidence if word timestamps are absent.
- **Test Required:** Verify schema outputs valid BCP-47 codes and never emits fabricated 1.0 confidence for synthetic word divisions.

#### ISSUE-P0-06: Security Vulnerability — Premiere Project Files Treated as Media
- **Severity:** P0 (Security)
- **File Path:** `apps/ai-engine/app/core/security.py`
- **Relevant Function:** `validate_source_path()` / `ALLOWED_MEDIA_EXTENSIONS`
- **Actual Problem:** `ALLOWED_MEDIA_EXTENSIONS` contains `".prproj"`. The AI engine attempts to open XML/gzip Premiere project files with FFmpeg/audio decoders.
- **Root Cause:** Conflation of media assets with project container files.
- **User Impact:** Denial of service, memory exhaustion, or potential XML parsing attacks if project files are forwarded to media extraction pipelines.
- **Recommended Solution:** Remove `.prproj` from media extensions. Restrict media extensions strictly to true audio/video formats (`.wav`, `.mp3`, `.mp4`, `.mov`, etc.).
- **Test Required:** Security test verifying that passing `project.prproj` to `/api/v1/audio/analyze` returns HTTP 400/403.

---

### P1 — High Priority Issues

#### ISSUE-P1-01: SilenceDetectionResponse Schema Mismatch Rejects `"queued"` Status
- **Severity:** P1
- **File Path:** `apps/ai-engine/app/schemas/models.py`
- **Relevant Function:** `SilenceDetectionResponse`
- **Actual Problem:** `status: Literal["completed", "failed", "cancelled"]`. Async silence jobs return `status="queued"`, causing FastAPI Pydantic validation error (HTTP 500).
- **Root Cause:** Schema out of sync with asynchronous job lifecycle.
- **User Impact:** Background silence detection jobs fail immediately on initiation.
- **Recommended Solution:** Update status literal to `Literal["queued", "running", "completed", "failed", "cancelled"]`.
- **Test Required:** Unit test validating `SilenceDetectionResponse(status="queued", ...)` succeeds.

#### ISSUE-P1-02: Font Validation Uses Media File Extension Allowlist
- **Severity:** P1
- **File Path:** `apps/ai-engine/app/engines/fonts.py`, `apps/ai-engine/app/core/security.py`
- **Relevant Function:** `validate_font()` calls `validate_source_path()`
- **Actual Problem:** Validating a font file (`.ttf`, `.otf`) fails security validation because `validate_source_path` only allows audio/video extensions.
- **Root Cause:** Reusing media file validator for font files.
- **User Impact:** Custom local font validation fails for any valid TTF/OTF font.
- **Recommended Solution:** Create a dedicated `validate_font_path()` allowing `.ttf`, `.otf`, `.woff2`.
- **Test Required:** Test verifying `validate_font_path("NotoSansEthiopic-Regular.ttf")` passes while rejecting executable extensions.

#### ISSUE-P1-03: Duplicate Route Registration for Health Endpoint
- **Severity:** P1
- **File Path:** `apps/ai-engine/app/main.py`
- **Relevant Function:** `app.include_router(health.router)`
- **Actual Problem:** `health.router` included twice (lines 10 and 12).
- **Root Cause:** Incomplete refactoring of route prefixes.
- **User Impact:** Route ambiguity and OpenAPI documentation pollution.
- **Recommended Solution:** Register `health.router` once at `/health`.
- **Test Required:** Test route table has exactly one route for `/health`.

#### ISSUE-P1-04: Universal Hardcoded Development Token Shipped in Production Code
- **Severity:** P1 (Security)
- **File Path:** `apps/ai-engine/app/config.py`, `apps/premiere-plugin/src/services/local-engine.client.ts`
- **Relevant Function:** `Settings.token`, `DEFAULT_TOKEN = "yenecut-dev-token"`
- **Actual Problem:** Fixed dev token shipped as default with no runtime warning or generation of unique installation secret.
- **Root Cause:** Lack of installation-specific credential pairing.
- **User Impact:** Any local process can invoke engine endpoints if user does not configure an environment variable.
- **Recommended Solution:** Emit loud runtime security warning when default token is active; implement automatic secret generation script on Windows setup.
- **Test Required:** Test verifying warning is logged when running with default token.

#### ISSUE-P1-05: Transcript Editor Edits Do Not Propagate to Subtitle Captions
- **Severity:** P1
- **File Path:** `apps/premiere-plugin/src/app/App.tsx`
- **Relevant Function:** `setTranscript` onChange handler
- **Actual Problem:** When user edits transcript text in the UI, `transcript` state updates, but `captions` state remains stale. Exporting SRT/VTT exports the unedited captions.
- **Root Cause:** Decoupled states without synchronization or reactive re-segmentation.
- **User Impact:** User corrections in transcript are lost during subtitle export or Premiere insertion.
- **Recommended Solution:** Bind transcript updates to automatic or one-click caption regeneration; ensure export reads updated segments.
- **Test Required:** Frontend test verifying edited transcript propagates to exported caption text.

#### ISSUE-P1-06: False Success Reported on No-Op Silence Editing
- **Severity:** P1
- **File Path:** `apps/premiere-plugin/src/premiere/timeline.service.ts`
- **Relevant Function:** `applySilenceCuts()`
- **Actual Problem:** When no items fall within cut regions after razoring, function returns `{ success: true, message: "No removable track items were found..." }`.
- **Root Cause:** Conflating unhandled razor state with successful editing.
- **User Impact:** UI displays green success state even though no cuts were made and the timeline was left in a modified (razored) state.
- **Recommended Solution:** Return `{ success: false, noOp: true }` and do not leave orphaned razors.
- **Test Required:** Test scenario with non-matching intervals asserting `success === false`.

---

### P2 — Normal Priority Issues

#### ISSUE-P2-01: Tracked Generated Files in Git Repository
- **Severity:** P2 (Hygiene & Repository Bloat)
- **File Path:** `node_modules/`, `apps/premiere-plugin/dist/`, `apps/ai-engine/app/**/__pycache__/`
- **Actual Problem:** Thousands of build artifacts and virtual environment binaries checked into git.
- **Root Cause:** Incomplete `.gitignore`.
- **User Impact:** Slow clone times, git status noise, merge conflicts.
- **Recommended Solution:** Unstage all generated files from git cache; commit a comprehensive `.gitignore`.

#### ISSUE-P2-02: Arbitrary First Media Selection in Project Bin
- **Severity:** P2
- **File Path:** `apps/premiere-plugin/src/premiere/premiere.client.ts`
- **Relevant Function:** `getClipProjectItem()`, `getMediaFilePath()`
- **Actual Problem:** Iterates the project root bin and returns the first media item found, regardless of sequence context.
- **Root Cause:** Missing timeline selection query logic.
- **User Impact:** Operations apply to the wrong file if multiple clips exist in the bin.
- **Recommended Solution:** Implement `getSelectedClips()` using Premiere Pro `sequence.getSelection()` and track item queries.

#### ISSUE-P2-03: In-Memory Unbounded JobManager
- **Severity:** P2
- **File Path:** `apps/ai-engine/app/workers/jobs.py`
- **Relevant Function:** `JobManager._jobs`
- **Actual Problem:** Jobs dictionary grows indefinitely; completed jobs are never expired or pruned.
- **Root Cause:** No TTL or maximum capacity management.
- **User Impact:** Memory leak in long-running local engine processes.
- **Recommended Solution:** Add TTL-based cleanup or max-jobs eviction.

#### ISSUE-P2-04: Misleading Silence Confidence Values
- **Severity:** P2
- **File Path:** `apps/ai-engine/app/engines/silence/silence_analyzer.py`
- **Relevant Function:** `recommended_cuts()`
- **Actual Problem:** `confidence = min(0.99, 0.6 + (end - start) * 0.08 + settings.sensitivity * 0.2)` generates arbitrary numbers presented as model confidence.
- **Root Cause:** Heuristic formula disguised as probability.
- **User Impact:** Misleads users regarding algorithmic certainty.
- **Recommended Solution:** Clearly document heuristic recommendation scores vs true VAD probabilities.

---

### P3 — Low Priority / Maintenance Issues

#### ISSUE-P3-01: Conflicting Package Manager Configuration
- **Severity:** P3
- **File Path:** `pnpm-workspace.yaml`, `package.json`, `package-lock.json`
- **Actual Problem:** `pnpm-workspace.yaml` present while `package-lock.json` is used.
- **Recommended Solution:** Remove `pnpm-workspace.yaml` and standardize strictly on npm.

#### ISSUE-P3-02: Missing Windows 11 Automated Setup Scripts
- **Severity:** P3
- **File Path:** `scripts/windows/`
- **Actual Problem:** Missing dedicated PowerShell setup for Node, Python, FFmpeg, and model caching.
- **Recommended Solution:** Create structured setup scripts in `scripts/windows/`.
