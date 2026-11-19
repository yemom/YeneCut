@echo off
setlocal
cd /d "%~dp0"
echo Starting YeneCut AI Setup Wizard...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-gui.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo If the GUI failed to launch, running CLI installer fallback...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-core.ps1"
    pause
)
