# YeneCut AI - Windows FFmpeg Helper Setup
$ErrorActionPreference = "Continue"

Write-Host "Checking if winget or chocolatey can install FFmpeg..." -ForegroundColor Cyan

$hasFfmpeg = $false
try {
    $out = ffmpeg -version 2>$null
    if ($out) { $hasFfmpeg = $true }
} catch {}

if ($hasFfmpeg) {
    Write-Host "FFmpeg is already installed and available on PATH." -ForegroundColor Green
    exit 0
}

Write-Host "Attempting installation via winget..." -ForegroundColor Cyan
try {
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    Write-Host "FFmpeg installed via winget. Please restart your PowerShell window to refresh PATH." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "winget installation unavailable. Manual setup required:" -ForegroundColor Yellow
    Write-Host "1. Download FFmpeg essentials build from: https://www.gyan.dev/ffmpeg/builds/"
    Write-Host "2. Extract to C:\ffmpeg"
    Write-Host "3. Add C:\ffmpeg\bin to your User or System PATH environment variable."
}
