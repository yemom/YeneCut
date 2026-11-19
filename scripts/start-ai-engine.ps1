param(
    [int]$Port = 8765,
    [string]$EngineDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "apps\ai-engine")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $EngineDir "app\main.py"))) {
    Write-Error "AI engine entrypoint was not found."
    exit 1
}

$env:YENECUT_ENGINE_TOKEN = if ($env:YENECUT_ENGINE_TOKEN) { $env:YENECUT_ENGINE_TOKEN } else { "yenecut-dev-token" }
Set-Location $EngineDir
python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
