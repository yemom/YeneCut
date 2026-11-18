# YeneCut AI — Security Review and Threat Analysis

**Date:** 2026-11-18  
**Scope:** Local API authentication, filesystem sandboxing, path traversal, injection vectors, and sensitive data handling.

---

## 1. Threat Model & Trust Boundaries

YeneCut AI operates in a desktop environment with two distinct processes:
1. **Adobe Premiere Pro UXP Sandbox:** Runs with restricted filesystem and network permissions governed by `manifest.json`.
2. **Local Python AI Engine:** Runs as a local daemon bound to `127.0.0.1:8765`.

```
[ Untrusted Local Network / Host ]
               |
               v (Blocked: bind to 127.0.0.1 only)
+--------------------------------------------------------------+
|               Local AI Engine (127.0.0.1:8765)               |
|                                                              |
|  [Security Boundary: Token Header: X-YeneCut-Token]          |
|  [Filesystem Validation: Allowed Extensions & Size Limits]   |
+--------------------------------------------------------------+
               ^
               | HTTP (localhost only)
+--------------------------------------------------------------+
|              Premiere Pro UXP Plugin Sandbox                 |
|  manifest.json:                                              |
|  - localFileSystem: request                                  |
|  - network.domains: ["http://127.0.0.1"]                     |
+--------------------------------------------------------------+
```

---

## 2. Vulnerability Findings and Remediation

### SEC-01: Premiere Project Files (`.prproj`) Allowed in Media Ingestion (High Severity)
- **Vulnerability:** `ALLOWED_MEDIA_EXTENSIONS` in `app/core/security.py` included `.prproj`.
- **Attack Vector:** An attacker or malicious plugin request could point `/api/v1/audio/analyze` or `/api/v1/silence/detect` to a Premiere project file (`.prproj`). `.prproj` files are gzipped XML documents containing project structures, bin configurations, and file paths. Passing them to FFmpeg or raw audio decoders causes unpredictable memory allocation, parser faults, or potential denial of service.
- **Remediation:** Remove `.prproj` from `ALLOWED_MEDIA_EXTENSIONS`. Restrict exclusively to true binary audio/video containers: `.wav`, `.mp3`, `.m4a`, `.aac`, `.flac`, `.ogg`, `.mp4`, `.mov`, `.mkv`, `.avi`, `.mxf`.
- **Status:** REMEDIATED.

### SEC-02: Universal Development Token Default Shipped Without Secret Generation (High Severity)
- **Vulnerability:** `Settings.token` defaults to `"yenecut-dev-token"`, and the frontend hardcodes `"yenecut-dev-token"`.
- **Attack Vector:** Any local script or browser page running on the user's machine making requests to `http://127.0.0.1:8765` with `X-YeneCut-Token: yenecut-dev-token` can command the AI engine to read files and write subtitle files.
- **Remediation:**
  1. Add runtime warning when default token is detected.
  2. Implement an automated setup script generating a cryptographically secure random token (`secrets.token_urlsafe(32)`) saved to a user-restricted local credential file (`%LOCALAPPDATA%\YeneCut\credentials.json`).
  3. Provide UI controls in Settings to pair and rotate credentials.
- **Status:** REMEDIATED (Warning added, token generation script provided).

### SEC-03: Font Validation Using Media Extension Allowlist (Medium Severity)
- **Vulnerability:** `apps/ai-engine/app/engines/fonts.py` called `validate_source_path()`, which checks against `ALLOWED_MEDIA_EXTENSIONS`. Valid `.ttf` and `.otf` font files were rejected, and if an attacker attempted to validate a `.prproj` file, it passed.
- **Remediation:** Create dedicated `ALLOWED_FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2", ".ttc"}` and `validate_font_path()` enforcing font-specific extension and byte boundaries.
- **Status:** REMEDIATED.

### SEC-04: Arbitrary Output Path Traversal and Writing (Medium Severity)
- **Vulnerability:** `validate_output_path()` creates directories recursively with `mkdir(parents=True, exist_ok=True)` without verifying whether the target directory is within user-approved paths or temporary storage.
- **Remediation:** Enforce that output files can only be written to `ALLOWED_OUTPUT_EXTENSIONS` (`.srt`, `.vtt`, `.ass`, `.json`, `.txt`) and ensure path normalization resolves symlinks and blocks `..` components.
- **Status:** REMEDIATED.

### SEC-05: Sensitive Transcript Data in Logs (Low Severity)
- **Vulnerability:** Synchronous error handling could log raw transcript text or spoken dialogues to standard output.
- **Remediation:** Sanitize log messages; log only segment count, duration, and status codes, never raw text payloads.
- **Status:** REMEDIATED.

---

## 3. Security Checklist for Production Release

- [x] Engine strictly bound to `127.0.0.1` (never `0.0.0.0`).
- [x] Constant-time token comparison (`hmac.compare_digest`).
- [x] Strict allowlists for media extensions and font extensions.
- [x] Maximum payload size limits enforced ($2\text{ GB}$ media, $50\text{ MB}$ fonts).
- [x] Symlink resolution and path traversal (`..`) blocked.
- [x] Temporary files cleaned in `try...finally` blocks.
- [x] No plaintext passwords or external API keys stored unencrypted.
