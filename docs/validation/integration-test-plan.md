# Integration Test Plan

## Automated tests

Python:
```bash
cd apps/ai-engine
YENECUT_ENGINE_TOKEN=test-token python -m pytest -q
```

Plugin:
```bash
cd apps/premiere-plugin
npm run typecheck
npm run test
npm run build
```

## Manual Premiere tests

1. Install Premiere Pro 25.1+.
2. Enable developer mode.
3. Open UXP Developer Tool.
4. Add `apps/premiere-plugin/dist/manifest.json`.
5. Load the plugin.
6. Open a Premiere project with an active sequence.
7. Run Silence Cut analysis.
8. Apply cuts and verify undo.
9. Generate captions from real Amharic audio.
10. Export SRT/VTT/ASS.
11. Insert transcript into a selected clip.
12. Validate Ge'ez font rendering in Program Monitor and exported video.

## Host-dependent status

All Premiere-specific workflow items remain `BLOCKED` until executed in Premiere.
