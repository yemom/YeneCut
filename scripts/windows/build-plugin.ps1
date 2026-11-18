# YeneCut AI - Build Premiere Pro UXP Plugin
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."
$pluginDir = "$rootDir\apps\premiere-plugin"

Set-Location $pluginDir

Write-Host "Building YeneCut AI Premiere Plugin for UXP..." -ForegroundColor Cyan
npm run build

Write-Host "Plugin build complete. Dist is in $pluginDir\dist" -ForegroundColor Green
