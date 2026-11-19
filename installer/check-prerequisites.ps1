# YeneCut AI - Prerequisites Verification Script
param(
    [switch]$Quiet = $false
)

$ErrorActionPreference = "Continue"

function Write-Info {
    param([string]$Msg)
    if (-not $Quiet) { Write-Host $Msg -ForegroundColor Cyan }
}

function Write-Success {
    param([string]$Msg)
    if (-not $Quiet) { Write-Host "  [OK] $Msg" -ForegroundColor Green }
}

function Write-Fail {
    param([string]$Msg)
    Write-Host "  [FAIL] $Msg" -ForegroundColor Red
}

Write-Info "================================================="
Write-Info "     YeneCut AI - System Prerequisites Check     "
Write-Info "================================================="

$allPassed = $true

# 1. Check Operating System
Write-Info "`n[1/5] Checking Operating System..."
$os = Get-CimInstance Win32_OperatingSystem
if ($os.Caption -match "Windows (10|11|Server)") {
    Write-Success "$($os.Caption) (64-bit)"
} else {
    Write-Fail "Unsupported OS: $($os.Caption). Windows 10/11 64-bit required."
    $allPassed = $false
}

# 2. Check Node.js
Write-Info "[2/5] Checking Node.js..."
try {
    $nodeVersion = node -v 2>$null
    if ($nodeVersion -match "v(\d+)") {
        $major = [int]$matches[1]
        if ($major -ge 18) {
            Write-Success "Node.js $nodeVersion (supported)"
        } else {
            Write-Fail "Node.js 18+ required (found $nodeVersion). Please install Node.js 22 LTS."
            $allPassed = $false
        }
    } else {
        Write-Fail "Node.js is not found on PATH. Download from https://nodejs.org"
        $allPassed = $false
    }
} catch {
    Write-Fail "Node.js check encountered an error: $_"
    $allPassed = $false
}

# 3. Check Python
Write-Info "[3/5] Checking Python..."
try {
    $pyVersion = python --version 2>$null
    if ($pyVersion -match "Python (\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -eq 3 -and $minor -ge 10) {
            Write-Success "$pyVersion (supported)"
        } else {
            Write-Fail "Python 3.10+ required (found $pyVersion). Please install Python 3.11 or 3.13."
            $allPassed = $false
        }
    } else {
        Write-Fail "Python not found on PATH. Download from https://python.org"
        $allPassed = $false
    }
} catch {
    Write-Fail "Python check encountered an error: $_"
    $allPassed = $false
}

# 4. Check FFmpeg
Write-Info "[4/5] Checking FFmpeg..."
try {
    $ffOut = ffmpeg -version 2>$null | Select-Object -First 1
    if ($ffOut -match "ffmpeg version") {
        Write-Success "$ffOut"
    } else {
        Write-Host "  [WARN] FFmpeg not found on PATH. Silence detection on non-WAV media will require FFmpeg." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] FFmpeg check failed. Audio extraction for video formats may be limited." -ForegroundColor Yellow
}

# 5. Check Adobe Premiere Pro installation
Write-Info "[5/5] Checking Adobe Premiere Pro..."
$pproFound = $false
$possiblePaths = @(
    "$env:ProgramFiles\Adobe\Adobe Premiere Pro 2025\Adobe Premiere Pro.exe",
    "$env:ProgramFiles\Adobe\Adobe Premiere Pro 2024\Adobe Premiere Pro.exe",
    "$env:ProgramFiles\Adobe\Adobe Premiere Pro (Beta)\Adobe Premiere Pro.exe"
)
foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        Write-Success "Found Premiere Pro at: $p"
        $pproFound = $true
        break
    }
}
if (-not $pproFound) {
    Write-Host "  [NOTE] Premiere Pro default path not found. If installed to a custom location, UXP will still load the extension." -ForegroundColor Yellow
}

Write-Info "`n-------------------------------------------------"
if ($allPassed) {
    Write-Info "PREREQUISITES CHECK PASSED: System is ready for YeneCut AI."
    exit 0
} else {
    Write-Fail "PREREQUISITES CHECK FAILED: Please install missing prerequisites above."
    exit 1
}
