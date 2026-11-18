# YeneCut AI - Start Local FastAPI Engine (Windows 11)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."
$engineDir = "$rootDir\apps\ai-engine"

# Load pairing token if present
$credentialFile = "$env:LOCALAPPDATA\YeneCut\engine-credentials.json"
if (Test-Path $credentialFile) {
    try {
        $cred = Get-Content $credentialFile -Raw | ConvertFrom-Json
        $env:YENECUT_ENGINE_TOKEN = $cred.token
        Write-Host "Loaded pairing token from $credentialFile" -ForegroundColor Cyan
    } catch {
        Write-Host "Warning: Could not read $credentialFile, using environment default" -ForegroundColor Yellow
    }
}

Set-Location $engineDir

$python = if (Test-Path "$engineDir\.venv\Scripts\python.exe") {
    "$engineDir\.venv\Scripts\python.exe"
} else {
    "python"
}

Write-Host "Starting YeneCut AI Engine on http://127.0.0.1:8765..." -ForegroundColor Green
& $python -m uvicorn app.main:app --app-dir "$engineDir" --host 127.0.0.1 --port 8765 --reload
