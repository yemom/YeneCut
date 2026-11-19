# YENECUT AI — SECURITY & DATA PRIVACY SPECIFICATION

## 1. Security Architecture & Threat Model

YeneCut AI is designed for local workstations. It enforces zero telemetry, zero cloud streaming of audio or video, and loopback isolation.

```
+--------------------------------------------------------+
| Workstation Host                                       |
|                                                        |
|   Premiere Pro (UXP) <====== Loopback ======> FastAPI  |
|                         127.0.0.1:8765                 |
|                     (X-YeneCut-Token)                  |
|                                                        |
|  [NO External Network Calls]  [NO Analytics]           |
+--------------------------------------------------------+
```

---

## 2. Security Controls & Mitigations

### 2.1 Network Exposure
- **Control:** The FastAPI server listens strictly on `127.0.0.1`. Binding to `0.0.0.0` or public interfaces is prohibited.
- **Verification:** Verified via `uvicorn.run(host="127.0.0.1")` in all launcher scripts and tests.

### 2.2 Authentication & Secret Lifecycle
- **Control:** Every endpoint (except `/health`) requires header `X-YeneCut-Token`.
- **Secret Generation:** Cryptographically generated via CSPRNG during setup (`installer/setup-ai-engine.ps1`).
- **Secret Storage:** Stored in user-specific `%LOCALAPPDATA%\YeneCut\engine-credentials.json` with standard Windows user ACL permissions.
- **Constant-Time Verification:** Handled via `hmac.compare_digest` in `apps/ai-engine/app/core/security.py` to prevent timing attacks.

### 2.3 Filesystem Access & Path Traversal Defense
- **Control:** Media paths, font paths, and output paths must pass `validate_source_path` and `validate_output_path`.
- **Symlink & Junction Protection:** Verified with `os.path.realpath` to prevent symlink traversal out of authorized media directories.
- **Extension Whitelist:** Only approved media formats (`.wav`, `.mp3`, `.m4a`, `.aac`, `.flac`, `.ogg`, `.mp4`, `.mov`, `.mkv`, `.avi`, `.mxf`) and fonts (`.ttf`, `.otf`, `.woff`, `.woff2`) are permitted.
- **Project File Blocking:** `.prproj` and executable formats (`.exe`, `.bat`, `.cmd`, `.ps1`) are explicitly rejected.

### 2.4 Error Sanitization & Diagnostic Logging
- **Control:** Raw internal exception traces are logged locally to `%LOCALAPPDATA%\YeneCut\logs` and sanitized before being returned to the UXP client.
