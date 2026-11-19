param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$engineDir = Join-Path $ProjectRoot "apps\ai-engine"
$pluginDir = Join-Path $ProjectRoot "apps\premiere-plugin"

Push-Location $engineDir
$env:YENECUT_ENGINE_TOKEN = "test-token"
python -m pytest -q
$engineResult = $LASTEXITCODE
Pop-Location

Push-Location $pluginDir
npm run typecheck
$typeResult = $LASTEXITCODE
npm run test
$testResult = $LASTEXITCODE
Pop-Location

if ($engineResult -ne 0 -or $typeResult -ne 0 -or $testResult -ne 0) {
    Write-Error "One or more validation commands failed."
    exit 1
}

Write-Host "All automated validation commands passed."
