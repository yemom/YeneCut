# YENECUT AI — TESTING & QUALITY ASSURANCE GUIDE

## 1. Automated Test Architecture

YeneCut AI maintains test suites across both TypeScript (UXP plugin) and Python (local AI engine).

```
                      ROOT TEST RUNNER
                        (npm test)
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
   PREMIERE UXP PLUGIN              PYTHON AI ENGINE
     (npm run test:plugin)           (npm run test:ai)
            │                               │
   - premiere.client.test.ts        - test_captions.py
     * Time mapping                 - test_fonts.py
     * Boundary clamping            - test_jobs.py
     * Frame-accurate tick clock    - test_silence.py
     * Unrelated clip isolation     - test_regressions.py
   - App.test.tsx                     * Symlink & path traversal
     * Dashboard rendering            * .prproj rejection
     * Tab navigation                 * Zero-word-loss Amharic
     * Destructive cut confirmation   * Token authentication
```

---

## 2. Running Automated Tests

### Run All Tests (Root Workspace)
```bash
npm test
```
**Output:**
- 35 passing TypeScript tests in `apps/premiere-plugin`
- 18 passing Python tests in `apps/ai-engine`
- Total: 53 automated tests passing cleanly

### Run TypeScript Suite Only
```bash
npm run test:plugin
```

### Run Python Suite Only
```bash
npm run test:ai
```

### Run TypeScript Typecheck
```bash
npm run typecheck:plugin
```

---

## 3. Test Coverage Matrix

| Area | Test File | Key Test Cases |
| :--- | :--- | :--- |
| **Time Mapping** | `premiere.client.test.ts` | Source in/out offsets, boundary clamping, non-zero in-points |
| **Frame Rates** | `premiere.client.test.ts` | 23.976, 24, 25, 29.97, 30, 50, 59.94, 60 fps ticksPerFrame |
| **Clip Isolation** | `premiere.client.test.ts` | Unrelated B-roll clip mapping isolation |
| **Plugin UI** | `App.test.tsx` | Navigation, settings, font preview, confirmation requirement |
| **Path Security** | `test_regressions.py` | Traversal checks, `.prproj` block, symlink escapes |
| **Authentication** | `test_regressions.py` | 401 on missing token, 401 on invalid token |
| **Zero-Word Loss** | `test_regressions.py` | Amharic sentence split word preservation, punctuation retention |
| **VAD Silence** | `test_silence.py` | Synchronous silence detection, provider transparency |
| **Ethiopic Fonts** | `test_fonts.py` | Catalog loading, font availability checks |
