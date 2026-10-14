#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 lan-server.py "$@"; fi
if command -v python >/dev/null 2>&1; then exec python lan-server.py "$@"; fi
echo "Python 3 is needed to host a LAN game. Install it from https://www.python.org/downloads/ and run this again."
printf "Press Enter to close..."; read -r _
