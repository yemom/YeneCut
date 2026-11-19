param(
    [string]$EngineDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "apps\ai-engine")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $EngineDir "requirements.txt"))) {
    Write-Error "requirements.txt was not found in $EngineDir"
    exit 1
}

python -m pip install -r (Join-Path $EngineDir "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python dependency installation failed."
    exit $LASTEXITCODE
}

Write-Host "Python dependencies installed."
