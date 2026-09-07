@echo off
REM Double-click this file in File Explorer to install (first time only) and start the app.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Install it from https://nodejs.org (LTS version) and re-run this file.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First-time setup: installing dependencies...
  call npm install
)

echo.
echo Starting Resume ATS Alignment Studio...
echo Opening http://localhost:3000 in your browser in a few seconds.
echo Leave this window open while you use the app. Close it to stop the server.
echo.

start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"
call npm start
