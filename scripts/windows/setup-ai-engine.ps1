# YeneCut AI - Complete AI Engine Setup & Pairing Secret Generation
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."

# Generate a cryptographically secure pairing token
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [System.Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")

$configDir = "$env:LOCALAPPDATA\YeneCut"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$credentialFile = "$configDir\engine-credentials.json"
@{
    token = $token
    port = 8765
    host = "127.0.0.1"
    created_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $credentialFile -Encoding utf8

Write-Host "Generated unique pairing credential at: $credentialFile" -ForegroundColor Green
Write-Host "Pairing Token: $token" -ForegroundColor Yellow

# Ensure models directory exists
$modelsDir = "$rootDir\apps\ai-engine\models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

Write-Host "AI Engine configuration complete!" -ForegroundColor Green
