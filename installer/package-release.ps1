# YeneCut AI - Package Release (.ccx and Windows Distribution .zip)
param(
    [string]$OutputDir = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$pluginDist = "$rootDir\apps\premiere-plugin\dist"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "      YeneCut AI - Packaging Release Artifacts   " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Build and validate plugin
Write-Host "`n[1/3] Building and validating Premiere UXP plugin..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File "$scriptDir\build-plugin.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting packaging." -ForegroundColor Red
    exit 1
}

# 2. Generate .ccx (UXP zip package format)
Write-Host "`n[2/3] Generating YeneCut-AI.ccx package..." -ForegroundColor Cyan
$ccxPath = "$OutputDir\YeneCut-AI.ccx"
$tempCcx = "$env:TEMP\YeneCut_ccx_temp.zip"
if (Test-Path $tempCcx) { Remove-Item $tempCcx -Force }
if (Test-Path $ccxPath) { Remove-Item $ccxPath -Force }

Compress-Archive -Path "$pluginDist\*" -DestinationPath $tempCcx -CompressionLevel Optimal -Force
Move-Item -Path $tempCcx -Destination $ccxPath -Force
Write-Host "Created .ccx at: $ccxPath" -ForegroundColor Green

# 3. Create Windows Distribution Package
Write-Host "`n[3/3] Creating Windows Distribution Archive..." -ForegroundColor Cyan
$outZip = "$OutputDir\YeneCut-AI-Windows-Package.zip"
if (Test-Path $outZip) { Remove-Item $outZip -Force }

$tempStage = "$env:TEMP\YeneCut-Dist-Stage"
if (Test-Path $tempStage) { Remove-Item $tempStage -Recurse -Force }
New-Item -ItemType Directory -Path $tempStage -Force | Out-Null

# Copy root entry points and release artifacts
Copy-Item "$rootDir\Setup-YeneCut.bat" "$tempStage\" -Force -ErrorAction SilentlyContinue
Copy-Item $ccxPath "$tempStage\" -Force
Copy-Item "$rootDir\README.md" "$tempStage\" -Force
Copy-Item "$rootDir\LICENSE" "$tempStage\" -Force -ErrorAction SilentlyContinue

# Copy installer folder
Copy-Item "$rootDir\installer" "$tempStage\installer" -Recurse -Force

# Copy scripts folder
Copy-Item "$rootDir\scripts" "$tempStage\scripts" -Recurse -Force

# Copy plugin dist
New-Item -ItemType Directory -Path "$tempStage\apps\premiere-plugin" -Force | Out-Null
Copy-Item $pluginDist "$tempStage\apps\premiere-plugin\dist" -Recurse -Force

# Copy AI engine code and requirements without caches or venv
New-Item -ItemType Directory -Path "$tempStage\apps\ai-engine" -Force | Out-Null
Copy-Item "$rootDir\apps\ai-engine\app" "$tempStage\apps\ai-engine\app" -Recurse -Force
Copy-Item "$rootDir\apps\ai-engine\requirements.txt" "$tempStage\apps\ai-engine\requirements.txt" -Force
if (Test-Path "$rootDir\apps\ai-engine\models") {
    Copy-Item "$rootDir\apps\ai-engine\models" "$tempStage\apps\ai-engine\models" -Recurse -Force
}

# Clean any __pycache__ from staging
Get-ChildItem -Path $tempStage -Include "__pycache__" -Recurse -Directory | Remove-Item -Recurse -Force

# Compress staged folder
Compress-Archive -Path "$tempStage\*" -DestinationPath $outZip -CompressionLevel Optimal -Force
Remove-Item $tempStage -Recurse -Force

$zipItem = Get-Item $outZip
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host "Packaging Complete!" -ForegroundColor Green
Write-Host "CCX:     $ccxPath" -ForegroundColor Yellow
Write-Host "Package: $outZip ($([math]::Round($zipItem.Length / 1MB, 2)) MB)" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan
exit 0
