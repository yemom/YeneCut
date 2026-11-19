# YeneCut AI - Windows 11 Prerequisites Check
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   YeneCut AI - Prerequisites Check     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$allPassed = $true

# 1. Check Node.js
Write-Host -NoNewline "[1/5] Checking Node.js... "
try {
    $nodeVersion = node -v 2>$null
    if ($nodeVersion -match "v(\d+)") {
        $major = [int]$matches[1]
        if ($major -ge 18) {
            Write-Host "OK ($nodeVersion)" -ForegroundColor Green
        } else {
            Write-Host "FAIL: Node.js 18+ required (found $nodeVersion)" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "FAIL: Node.js not found on PATH" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "FAIL: Node.js check error" -ForegroundColor Red
    $allPassed = $false
}

# 2. Check npm
Write-Host -NoNewline "[2/5] Checking npm... "
try {
    $npmVersion = npm -v 2>$null
    if ($npmVersion) {
        Write-Host "OK ($npmVersion)" -ForegroundColor Green
    } else {
        Write-Host "FAIL: npm not found" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "FAIL: npm check error" -ForegroundColor Red
    $allPassed = $false
}

# 3. Check Python
Write-Host -NoNewline "[3/5] Checking Python... "
try {
    $pyVersion = python --version 2>$null
    if ($pyVersion -match "Python (\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -eq 3 -and $minor -ge 10) {
            Write-Host "OK ($pyVersion)" -ForegroundColor Green
        } else {
            Write-Host "FAIL: Python 3.10+ required (found $pyVersion)" -ForegroundColor Red
            $allPassed = $false
        }
    } else {
        Write-Host "FAIL: Python not found on PATH" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "FAIL: Python check error" -ForegroundColor Red
    $allPassed = $false
}

# 4. Check FFmpeg
Write-Host -NoNewline "[4/5] Checking FFmpeg... "
try {
    $ffmpegOut = ffmpeg -version 2>$null | Select-Object -First 1
    if ($ffmpegOut -match "ffmpeg version") {
        Write-Host "OK ($($ffmpegOut.Split(' ')[2]))" -ForegroundColor Green
    } else {
        Write-Host "WARNING: FFmpeg not on PATH (run scripts/windows/setup-ffmpeg.ps1)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: FFmpeg not detected" -ForegroundColor Yellow
}

# 5. Check Git
Write-Host -NoNewline "[5/5] Checking Git... "
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Host "OK ($gitVersion)" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Git not found" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "FAIL: Git check error" -ForegroundColor Red
    $allPassed = $false
}

Write-Host "----------------------------------------" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "All core prerequisites satisfied! Ready for installation." -ForegroundColor Green
    exit 0
} else {
    Write-Host "One or more prerequisites failed. Please install missing tools." -ForegroundColor Red
    exit 1
}
