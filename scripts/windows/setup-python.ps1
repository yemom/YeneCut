# YeneCut AI - Python Virtual Environment & Dependencies Setup
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."
$engineDir = "$rootDir\apps\ai-engine"

Set-Location $engineDir

if (-not (Test-Path "$engineDir\.venv")) {
    Write-Host "Creating Python virtual environment in $engineDir\.venv..." -ForegroundColor Cyan
    python -m venv .venv
}

$venvPython = "$engineDir\.venv\Scripts\python.exe"

Write-Host "Upgrading pip..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip

Write-Host "Installing AI engine dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install -r requirements.txt

Write-Host "Python environment setup complete!" -ForegroundColor Green
