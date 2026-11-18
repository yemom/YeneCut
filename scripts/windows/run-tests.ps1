# YeneCut AI - Run Complete Test Suite (Frontend & Python)
$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     Running YeneCut AI Test Suite        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Python AI Engine Tests
Write-Host "`n[1/2] Running Python AI Engine tests (pytest)..." -ForegroundColor Cyan
Set-Location "$rootDir\apps\ai-engine"
python -m pytest tests/ -q
$pyExit = $LASTEXITCODE

# 2. Premiere Plugin Frontend Tests
Write-Host "`n[2/2] Running Premiere Plugin tests (vitest)..." -ForegroundColor Cyan
Set-Location "$rootDir\apps\premiere-plugin"
npm test
$jsExit = $LASTEXITCODE

Write-Host "`n------------------------------------------" -ForegroundColor Cyan
if ($pyExit -eq 0 -and $jsExit -eq 0) {
    Write-Host "ALL TESTS PASSED! Python + Frontend suites clean." -ForegroundColor Green
    exit 0
} else {
    Write-Host "TEST FAILURES DETECTED: Python ($pyExit), Frontend ($jsExit)" -ForegroundColor Red
    exit 1
}
