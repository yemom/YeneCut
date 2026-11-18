param(
    [string]$ManifestPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "apps\premiere-plugin\dist\manifest.json")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ManifestPath)) {
    Write-Error "Manifest not found. Run scripts/build-plugin.ps1 first."
    exit 1
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.manifestVersion -ne 5) {
    Write-Error "Unexpected manifest version: $($manifest.manifestVersion)"
    exit 1
}
if ($manifest.host.app -ne "premierepro") {
    Write-Error "Manifest host is not Premiere Pro."
    exit 1
}

Write-Host "Manifest validation passed: $($manifest.name) v$($manifest.version)"
