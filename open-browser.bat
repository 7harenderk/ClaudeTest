@echo off
REM Helper for start.bat: waits a couple seconds for the server to come up,
REM then opens the app in the default browser. Kept in its own file so
REM start.bat never has to nest quotes/operators inside a "cmd /c ..." string.
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
