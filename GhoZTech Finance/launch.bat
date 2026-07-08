@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Opening the app directly in your default browser.
  start "" "%~dp0index.html"
  exit /b 0
)

node "%~dp0server.js"
pause
