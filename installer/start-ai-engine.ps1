# YeneCut AI - Start Local FastAPI Engine
param(
    [int]$Port = 8765,
    [string]$Host = "127.0.0.1",
    [switch]$NoReload = $false
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$engineDir = "$rootDir\apps\ai-engine"

# Load pairing token if present
$credentialFile = "$env:LOCALAPPDATA\YeneCut\engine-credentials.json"
if (Test-Path $credentialFile) {
    try {
        $cred = Get-Content $credentialFile -Raw | ConvertFrom-Json
        $env:YENECUT_ENGINE_TOKEN = $cred.token
        Write-Host "Loaded pairing token from $credentialFile" -ForegroundColor Cyan
    } catch {
        Write-Host "Warning: Could not read $credentialFile, using default development token" -ForegroundColor Yellow
    }
} else {
    Write-Host "Warning: No pairing credentials found at $credentialFile. Run setup-ai-engine.ps1 first." -ForegroundColor Yellow
}

Set-Location $engineDir

$python = "python"
if ((Test-Path "$engineDir\.venv\Scripts\python.exe") -and (Test-Path "$engineDir\.venv\Lib\site-packages\fastapi")) {
    $python = "$engineDir\.venv\Scripts\python.exe"
}

$reloadArg = if ($NoReload) { @() } else { @("--reload") }

Write-Host "Starting YeneCut AI Engine on http://$Host:$Port..." -ForegroundColor Green
& $python -m uvicorn app.main:app --app-dir "$engineDir" --host $Host --port $Port @reloadArg
