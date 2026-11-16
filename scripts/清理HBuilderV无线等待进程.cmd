@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-android-waits.ps1" -ConfirmOnce
pause
