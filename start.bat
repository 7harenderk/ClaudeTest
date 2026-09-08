@echo off
setlocal
REM Double-click this file in File Explorer to install (first time only) and start the app.
cd /d "%~dp0"

echo Resume ATS Alignment Studio - startup
echo Working folder: %cd%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on this computer.
  echo Install it from https://nodejs.org ^(choose the LTS version^), then run this file again.
  echo.
  pause
  exit /b 1
)

echo Node.js found:
node -v
echo.

if not exist node_modules (
  echo First-time setup: installing dependencies. This can take a minute...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed - see the messages above for the reason.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting the server...
echo Once you see "running at http://localhost:3000" below, open that address in your browser.
echo Leave THIS window open while you use the app. Close it to stop the server.
echo.

start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"
call npm start

echo.
echo The server has stopped.
pause
