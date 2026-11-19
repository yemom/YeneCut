# YeneCut AI — Troubleshooting Guide

## Common Issues & Solutions

### 1. Plugin panel opens to a blank screen in Premiere Pro
- **Cause:** Manifest or bundle mismatch, or `dist/index.html` referencing non-existent `.tsx` source.
- **Solution:** Run `npm run build:plugin` and check that `dist/index.html` references `./assets/index-*.js`. Verify that `node scripts/validate-build.mjs` exits with code 0.

### 2. "Engine unavailable" status in Plugin Panel
- **Cause:** Python AI engine is not running on port 8765 or token mismatch.
- **Solution:**
  1. Verify engine is running: `curl http://127.0.0.1:8765/health`.
  2. Check engine credentials in `%LOCALAPPDATA%\YeneCut\engine-credentials.json`.
  3. In Plugin Settings tab, paste the matching pairing token and click **Save & Connect**.

### 3. "FFmpeg not found" error during audio extraction
- **Cause:** FFmpeg binary is missing from PATH.
- **Solution:**
  - Run `.\scripts\windows\setup-ffmpeg.ps1` to install via winget, or
  - Download FFmpeg from `gyan.dev` and add `bin/` to system PATH.

### 4. Background music or B-roll was sliced
- **Cause:** Using legacy razor code instead of target-aware editing.
- **Solution:** Make sure you are on branch `fix/yenecut-production-readiness`. Target-aware editing only cuts the user-selected track and linked audio/video partner. Unrelated tracks are untouched.

### 5. Premiere Transcript insertion fails
- **Cause:** Older Premiere Pro version or clip does not support direct transcript injection.
- **Solution:** Click **Export SRT**, then in Premiere Pro open the **Text** panel and select **Import captions from file**.
