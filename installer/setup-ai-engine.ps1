# YeneCut AI - AI Engine Setup and Pairing Configuration
param(
    [switch]$InstallRequirements = $true
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$engineDir = "$rootDir\apps\ai-engine"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "      YeneCut AI - AI Engine Environment Setup    " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Generate or load cryptographically secure pairing token
$configDir = "$env:LOCALAPPDATA\YeneCut"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$credentialFile = "$configDir\engine-credentials.json"
if (-not (Test-Path $credentialFile)) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [System.Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")

    @{
        token = $token
        port = 8765
        host = "127.0.0.1"
        created_at = (Get-Date).ToString("o")
    } | ConvertTo-Json | Set-Content -Path $credentialFile -Encoding utf8

    Write-Host "Generated unique pairing credential at: $credentialFile" -ForegroundColor Green
} else {
    Write-Host "Found existing pairing credential at: $credentialFile" -ForegroundColor Cyan
}

# 2. Ensure models and logs directories exist
$modelsDir = "$engineDir\models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

$logsDir = "$engineDir\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# 3. Virtual environment setup (optional installation of requirements)
if ($InstallRequirements) {
    Write-Host "Checking Python dependencies in $engineDir..." -ForegroundColor Cyan
    $requirementsFile = "$engineDir\requirements.txt"
    if (Test-Path $requirementsFile) {
        Write-Host "Installing/verifying packages via pip..." -ForegroundColor Cyan
        & python -m pip install --upgrade pip -q
        & python -m pip install -r $requirementsFile -q
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Pip install reported exit code $LASTEXITCODE. Some optional models may require manual install." -ForegroundColor Yellow
        } else {
            Write-Host "AI Engine dependencies verified successfully." -ForegroundColor Green
        }
    }
}

Write-Host "AI Engine configuration complete!" -ForegroundColor Green
exit 0
