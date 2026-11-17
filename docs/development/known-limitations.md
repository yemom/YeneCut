# Known limitations

- Premiere Pro must be installed and running for plugin integration tests.
- Faster-Whisper and Silero VAD are optional heavy dependencies; transcription returns a clear error if unavailable.
- Font availability in Premiere output must be verified in a real Premiere render.
- Silence classification distinguishes speech/silence heuristically; ambiguous regions are returned as suggested cuts.
