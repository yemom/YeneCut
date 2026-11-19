# YeneCut AI - Build Premiere Pro UXP Plugin
param(
    [switch]$SkipTypecheck = $false
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$pluginDir = "$rootDir\apps\premiere-plugin"

Set-Location $pluginDir

if (-not $SkipTypecheck) {
    Write-Host "Running TypeScript typecheck..." -ForegroundColor Cyan
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Typecheck failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "Building YeneCut AI Premiere Plugin for UXP..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Plugin build complete. Dist is ready in $pluginDir\dist" -ForegroundColor Green
exit 0
