@echo off
title Commander Table - LAN server
cd /d "%~dp0"
where py >/dev/null 2>/dev/null && (py -3 lan-server.py %* & goto :end)
where python >/dev/null 2>/dev/null && (python lan-server.py %* & goto :end)
echo Python 3 is needed to host a LAN game. Install it from the Microsoft Store (search "Python") and run this again.
:end
pause
