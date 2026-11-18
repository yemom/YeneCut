# YeneCut AI - Complete Uninstaller Script
param(
    [switch]$RemoveData = $false,
    [switch]$Quiet = $false
)

$ErrorActionPreference = "Continue"

function Write-Info {
    param([string]$Msg)
    if (-not $Quiet) { Write-Host "[YeneCut Uninstall] $Msg" -ForegroundColor Cyan }
}

function Write-Success {
    param([string]$Msg)
    if (-not $Quiet) { Write-Host "  [OK] $Msg" -ForegroundColor Green }
}

Write-Info "Starting YeneCut AI uninstallation..."

# 1. Remove UXP Extension deployments
$targetPaths = @(
    "$env:APPDATA\Adobe\UXP\Extensions\com.yenecut.ai",
    "$env:APPDATA\Adobe\UXP\Plugins\External\com.yenecut.ai",
    "$env:CommonProgramFiles\Adobe\UXP\Extensions\com.yenecut.ai"
)

foreach ($target in $targetPaths) {
    if (Test-Path $target) {
        try {
            Remove-Item -Path $target -Recurse -Force
            Write-Success "Removed UXP extension from: $target"
        } catch {
            Write-Host "  [WARN] Could not remove $target: $_" -ForegroundColor Yellow
        }
    }
}

# 2. Remove desktop shortcuts
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcuts = @(
    "$desktopPath\Start YeneCut AI Engine.lnk",
    "$desktopPath\YeneCut Setup & Diagnostics.lnk"
)
foreach ($sc in $shortcuts) {
    if (Test-Path $sc) {
        Remove-Item -Path $sc -Force
        Write-Success "Removed shortcut: $sc"
    }
}

# 3. Optionally remove appdata directory (credentials, token)
if ($RemoveData) {
    $appDataDir = "$env:LOCALAPPDATA\YeneCut"
    if (Test-Path $appDataDir) {
        Remove-Item -Path $appDataDir -Recurse -Force
        Write-Success "Removed configuration and credentials from: $appDataDir"
    }
} else {
    Write-Info "Configuration and credentials preserved in $env:LOCALAPPDATA\YeneCut (use -RemoveData to wipe)."
}

Write-Info "Uninstallation complete!"
exit 0
