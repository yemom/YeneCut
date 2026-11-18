# YeneCut AI - Primary Installer
param(
    [switch]$CreateShortcuts = $true,
    [switch]$SkipPrereqCheck = $false,
    [switch]$Quiet = $false
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Run prerequisites check
if (-not $SkipPrereqCheck) {
    & powershell -ExecutionPolicy Bypass -File "$scriptDir\check-prerequisites.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Prerequisites check failed! Use -SkipPrereqCheck to override." -ForegroundColor Red
        exit 1
    }
}

# 2. Run core installation
& powershell -ExecutionPolicy Bypass -File "$scriptDir\install-core.ps1" -CreateShortcuts:$CreateShortcuts
exit $LASTEXITCODE
