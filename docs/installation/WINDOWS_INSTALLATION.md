# YENECUT AI — WINDOWS INSTALLATION & DEPLOYMENT GUIDE

## 1. System Requirements

- **Operating System:** Windows 11 (64-bit) or Windows 10 (64-bit version 21H2 or later).
- **Adobe Premiere Pro:** Version 25.1.0 or newer (v24.x supported via UXP manifest v5 fallback).
- **Node.js:** v18.0.0 or higher (v22 LTS recommended).
- **Python:** v3.10.0 or higher (Python 3.11 / 3.13 recommended).
- **FFmpeg:** Installed and available on system PATH (for non-WAV media extraction).

---

## 2. Canonical Installer Scripts (`installer/`)

All setup, execution, and packaging operations are centralized under `installer/`:

| Script | Purpose | Parameters |
| :--- | :--- | :--- |
| `check-prerequisites.ps1` | Verifies OS, Node, Python, FFmpeg, and Premiere paths | `[-Quiet]` |
| `setup-ai-engine.ps1` | Creates directories, pairing secret, installs dependencies | `[-InstallRequirements]` |
| `start-ai-engine.ps1` | Launches local FastAPI engine on 127.0.0.1:8765 | `[-Port 8765] [-NoReload]` |
| `build-plugin.ps1` | Runs typecheck and builds UXP distribution | `[-SkipTypecheck]` |
| `install.ps1` | Deploys UXP extension to Adobe directories and creates shortcuts | `[-SkipPrereqCheck] [-Quiet]` |
| `uninstall.ps1` | Removes extension, shortcuts, and optionally user data | `[-RemoveData] [-Quiet]` |
| `package-release.ps1` | Builds `.ccx` and distribution `.zip` archive | `[-OutputDir <path>]` |

---

## 3. Step-by-Step Installation Instructions

### Step 1: Verify System Prerequisites
Open PowerShell and run:
```powershell
.\installer\check-prerequisites.ps1
```
Ensure all required components display `[OK]`.

### Step 2: Install and Configure AI Engine
Run the engine setup script:
```powershell
.\installer\setup-ai-engine.ps1
```
This generates your unique pairing secret at `%LOCALAPPDATA%\YeneCut\engine-credentials.json`.

### Step 3: Build & Deploy UXP Plugin
Run the primary installer:
```powershell
.\installer\install.ps1
```
This deploys the plugin into:
`%APPDATA%\Adobe\UXP\Extensions\com.yenecut.ai`

### Step 4: Start AI Engine Service
```powershell
.\installer\start-ai-engine.ps1
```
The service will listen on `http://127.0.0.1:8765`. Check status by visiting `http://127.0.0.1:8765/health`.

### Step 5: Open Plugin in Adobe Premiere Pro
1. Launch **Adobe Premiere Pro**.
2. Go to menu: **Window > Extensions > YeneCut AI**.
3. The panel will connect to your local engine automatically using the generated credentials.

---

## 4. Uninstallation

To completely remove YeneCut AI:
```powershell
.\installer\uninstall.ps1 -RemoveData
```
This removes the deployed UXP extension, desktop shortcuts, and stored credentials.
