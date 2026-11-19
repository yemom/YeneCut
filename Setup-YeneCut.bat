@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo           YeneCut AI Windows Setup Wizard          
echo ===================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\setup-gui.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Running automated console installation fallback...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install-core.ps1"
    pause
)
