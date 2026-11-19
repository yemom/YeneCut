param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

$checks = @("node", "npm", "python")
foreach ($command in $checks) {
    if (-not (Test-Command $command)) {
        Write-Error "$command is not installed or not on PATH."
        exit 1
    }
}

if (-not (Test-Command "ffmpeg")) {
    Write-Warning "ffmpeg is not on PATH. WAV processing will work, but other media formats require FFmpeg."
}

Write-Host "Prerequisites check completed."
Write-Host "Project root: $ProjectRoot"
