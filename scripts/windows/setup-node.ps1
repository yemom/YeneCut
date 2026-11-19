# YeneCut AI - Node Environment & Workspaces Setup
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path "$scriptDir\..\.."

Write-Host "Installing root and workspace dependencies using npm..." -ForegroundColor Cyan
Set-Location $rootDir

npm install --no-audit

Write-Host "Node.js dependencies installed successfully!" -ForegroundColor Green
