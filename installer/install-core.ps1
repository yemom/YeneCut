# YeneCut AI - Core Installation Engine
param(
    [string]$SourceDist = (Resolve-Path "$PSScriptRoot\..\apps\premiere-plugin\dist").Path,
    [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path,
    [switch]$CreateShortcuts = $true,
    [switch]$InstallCcx = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Msg)
    Write-Host "[YeneCut Setup] $Msg" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Msg)
    Write-Host "[SUCCESS] $Msg" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Msg)
    Write-Host "[WARNING] $Msg" -ForegroundColor Yellow
}

Write-Step "Starting YeneCut AI installation..."

# 1. Detect Adobe Premiere Pro and UXP Extension paths
$targetPaths = @()

$userUxpExt = "$env:APPDATA\Adobe\UXP\Extensions\com.yenecut.ai"
$userUxpPlugins = "$env:APPDATA\Adobe\UXP\Plugins\External\com.yenecut.ai"
$systemUxpExt = "$env:CommonProgramFiles\Adobe\UXP\Extensions\com.yenecut.ai"

$targetPaths += $userUxpExt
$targetPaths += $userUxpPlugins

# 2. Deploy Plugin to UXP Locations
foreach ($target in $targetPaths) {
    try {
        if (-not (Test-Path $target)) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
        }
        Copy-Item -Path "$SourceDist\*" -Destination $target -Recurse -Force
        Write-Success "Deployed plugin assets to: $target"
    } catch {
        Write-Warn "Could not copy to $($target): $_"
    }
}

# 3. Setup Local AI Engine Directory & Credentials
$appDataDir = "$env:LOCALAPPDATA\YeneCut"
if (-not (Test-Path $appDataDir)) {
    New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null
}

$credPath = "$appDataDir\engine-credentials.json"
if (-not (Test-Path $credPath)) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [System.Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
    
    @{
        token = $token
        port = 8765
        host = "127.0.0.1"
        installed_at = (Get-Date).ToString("o")
    } | ConvertTo-Json | Set-Content -Path $credPath -Encoding utf8
    Write-Success "Generated pairing credentials at: $credPath"
} else {
    Write-Step "Found existing pairing credentials at: $credPath"
}

# 4. Create Desktop & Start Menu Shortcuts if requested
if ($CreateShortcuts) {
    try {
        $wsh = New-Object -ComObject WScript.Shell
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        
        # Shortcut 1: Start AI Engine
        $engineShortcut = $wsh.CreateShortcut("$desktopPath\Start YeneCut AI Engine.lnk")
        $engineShortcut.TargetPath = "powershell.exe"
        $engineShortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$ProjectRoot\scripts\windows\start-ai-engine.ps1`""
        $engineShortcut.WorkingDirectory = "$ProjectRoot\apps\ai-engine"
        $engineShortcut.Description = "Start YeneCut AI Engine Service"
        $engineShortcut.Save()
        
        # Shortcut 2: Setup & Diagnostics
        $diagShortcut = $wsh.CreateShortcut("$desktopPath\YeneCut Setup & Diagnostics.lnk")
        $diagShortcut.TargetPath = "$ProjectRoot\installer\Setup.bat"
        $diagShortcut.WorkingDirectory = "$ProjectRoot\installer"
        $diagShortcut.Description = "YeneCut AI Setup & Diagnostics Wizard"
        $diagShortcut.Save()

        Write-Success "Created Desktop shortcuts."
    } catch {
        Write-Warn "Could not create desktop shortcuts: $_"
    }
}

# 5. Optional CCX Installation
if ($InstallCcx) {
    $ccxPath = "$ProjectRoot\YeneCut-AI.ccx"
    if (Test-Path $ccxPath) {
        Write-Step "Launching Creative Cloud package installer..."
        Start-Process -FilePath $ccxPath
    }
}

Write-Success "YeneCut AI installation completed successfully!"
return $true
