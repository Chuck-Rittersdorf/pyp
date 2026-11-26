@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scores\update-scores-manifest.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to update scores-manifest.js
    pause
    exit /b %ERRORLEVEL%
)
echo Done! Refresh the PYP webapp in your browser to see the updated names.
timeout /t 4
