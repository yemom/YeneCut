# YeneCut AI — Developer Setup Guide

## Requirements
- Windows 11 (or Windows 10 64-bit)
- Node.js 18+ (Node 22 LTS recommended)
- Python 3.10+ (Python 3.11/3.13)
- FFmpeg on PATH
- Adobe Premiere Pro 25.1+
- Adobe UXP Developer Tool (UDT)

## Quick Installation

Run the automated PowerShell setup scripts from the repository root:

```powershell
# Check requirements
.\scripts\windows\check-prerequisites.ps1

# Install node packages
.\scripts\windows\setup-node.ps1

# Setup Python venv
.\scripts\windows\setup-python.ps1

# Generate pairing credentials
.\scripts\windows\setup-ai-engine.ps1

# Build plugin
.\scripts\windows\build-plugin.ps1
```

## Running the Development Stack

### Terminal 1: AI Engine
```powershell
.\scripts\windows\start-ai-engine.ps1
```

### Terminal 2: Plugin Development Watcher
```powershell
cd apps\premiere-plugin
npm run dev
```

### Loading into Premiere Pro via UXP Developer Tool
1. Open the **UXP Developer Tool**.
2. Click **Add Plugin** -> Select `apps/premiere-plugin/dist/manifest.json`.
3. Click the **...** menu -> **Load** (or **Watch** for auto-reload).
