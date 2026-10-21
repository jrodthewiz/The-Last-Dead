@echo off
rem Standalone Three.js browser edition. Does not open or build Unity.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause
