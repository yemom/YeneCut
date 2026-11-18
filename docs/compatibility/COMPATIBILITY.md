# YENECUT AI — SYSTEM & DEPENDENCY COMPATIBILITY

## 1. Supported Environments

| Component | Minimum Version | Recommended Version | Compatibility Status |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10 64-bit (21H2+) | Windows 11 64-bit | Verified supported |
| **Adobe Premiere Pro** | v24.0.0 | v25.1.0+ | Manifest v5 supported |
| **UXP Runtime** | v7.0 | v8.0+ | Verified supported |
| **Node.js** | v18.0.0 | v22 LTS | Verified supported |
| **Python** | v3.10.0 | v3.11 / v3.13 | Verified supported |
| **FFmpeg** | v4.4+ | v6.0+ | Recommended for non-WAV media |

---

## 2. Audio & Video Formats

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
