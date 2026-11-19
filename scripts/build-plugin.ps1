param(
    [string]$PluginDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "apps\premiere-plugin")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $PluginDir "package.json"))) {
    Write-Error "Plugin package.json was not found."
    exit 1
}

Set-Location $PluginDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Plugin build failed."
    exit $LASTEXITCODE
}

if (-not (Test-Path (Join-Path $PluginDir "dist\manifest.json"))) {
    Write-Error "Build output manifest is missing."
    exit 1
}

Write-Host "Plugin build completed: $(Join-Path $PluginDir 'dist\manifest.json')"
