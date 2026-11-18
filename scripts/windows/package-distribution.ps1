# YeneCut AI - Create Distribution Package for Testing & Sharing
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..\..").Path
$outZip = "$rootDir\YeneCut-AI-Windows-Package.zip"

Write-Host "Building fresh plugin distribution..." -ForegroundColor Cyan
& npm run build --prefix "$rootDir\apps\premiere-plugin"

Write-Host "Creating YeneCut-AI.ccx package..." -ForegroundColor Cyan
$distDir = "$rootDir\apps\premiere-plugin\dist"
$tempCcxZip = "$rootDir\temp_ccx.zip"
if (Test-Path $tempCcxZip) { Remove-Item $tempCcxZip -Force }
Compress-Archive -Path "$distDir\*" -DestinationPath $tempCcxZip -Force
Move-Item -Path $tempCcxZip -Destination "$rootDir\YeneCut-AI.ccx" -Force

Write-Host "Packaging clean distribution for Windows users..." -ForegroundColor Cyan
if (Test-Path $outZip) { Remove-Item $outZip -Force }

$tempStage = "$env:TEMP\YeneCut-Stage"
if (Test-Path $tempStage) { Remove-Item $tempStage -Recurse -Force }
New-Item -ItemType Directory -Path $tempStage -Force | Out-Null

# Copy root entry files
Copy-Item "$rootDir\Setup-YeneCut.bat" "$tempStage\" -Force
Copy-Item "$rootDir\YeneCut-AI.ccx" "$tempStage\" -Force
Copy-Item "$rootDir\README.md" "$tempStage\" -Force

# Copy installer
Copy-Item "$rootDir\installer" "$tempStage\installer" -Recurse -Force

# Copy scripts
Copy-Item "$rootDir\scripts" "$tempStage\scripts" -Recurse -Force

# Copy apps without node_modules or pycache
New-Item -ItemType Directory -Path "$tempStage\apps\premiere-plugin" -Force | Out-Null
Copy-Item "$rootDir\apps\premiere-plugin\dist" "$tempStage\apps\premiere-plugin\dist" -Recurse -Force
if (Test-Path "$rootDir\apps\premiere-plugin\public") {
    Copy-Item "$rootDir\apps\premiere-plugin\public" "$tempStage\apps\premiere-plugin\public" -Recurse -Force
}

New-Item -ItemType Directory -Path "$tempStage\apps\ai-engine" -Force | Out-Null
Copy-Item "$rootDir\apps\ai-engine\app" "$tempStage\apps\ai-engine\app" -Recurse -Force
Copy-Item "$rootDir\apps\ai-engine\models" "$tempStage\apps\ai-engine\models" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$rootDir\apps\ai-engine\requirements.txt" "$tempStage\apps\ai-engine\requirements.txt" -Force

# Copy documentation
Copy-Item "$rootDir\docs" "$tempStage\docs" -Recurse -Force

# Compress staged folder to final zip
Compress-Archive -Path "$tempStage\*" -DestinationPath $outZip -CompressionLevel Optimal -Force
Remove-Item $tempStage -Recurse -Force

$zipItem = Get-Item $outZip
Write-Host "Successfully generated Windows Distribution Package!" -ForegroundColor Green
Write-Host "Location: $outZip ($([math]::Round($zipItem.Length / 1MB, 2)) MB)" -ForegroundColor Yellow
