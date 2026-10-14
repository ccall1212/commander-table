@echo off
title Commander Table - LAN server
cd /d "%~dp0"
where py >nul 2>nul && (py -3 lan-server.py %* & goto :done)
where python >nul 2>nul && (python lan-server.py %* & goto :done)
echo Python 3 is needed to host a LAN game. Install it from the Microsoft Store (search "Python") and run this again.
pause
goto :end
:done
if errorlevel 1 pause
:end
