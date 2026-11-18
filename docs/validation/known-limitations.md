# Known Limitations

- Premiere Pro integration cannot be verified without an installed Premiere Pro host.
- Faster-Whisper and Silero VAD are optional; transcription returns a clear error if unavailable.
- FFmpeg is optional for WAV input but required for other media formats.
- Ge'ez font availability is checked at the OS level; actual Premiere rendering must be verified in Premiere.
- Silence detection is heuristic and may require threshold tuning.
- Caption insertion uses Premiere's transcript JSON workflow and may require a selected clip/project item.
