# YeneCut AI - Validate Plugin Build & Manifest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."
$pluginDir = "$rootDir\apps\premiere-plugin"

Set-Location $pluginDir

Write-Host "Validating UXP Distribution Artifacts..." -ForegroundColor Cyan
node scripts/validate-build.mjs

Write-Host "Validation succeeded!" -ForegroundColor Green
