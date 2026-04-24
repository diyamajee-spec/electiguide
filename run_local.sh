#!/bin/bash

# run_local.sh - ElectiGuide Local Server Starter
# -----------------------------------------------
# This script initializes the ElectiGuide environment 
# and starts a local development server for testing.

echo "==============================================="
echo "🗳️  Starting ElectiGuide (India Edition) Server"
echo "==============================================="

# Try npx serve first (modern JS approach)
if command -v npx &>/dev/null; then
    echo "✅ npx detected. Launching high-performance server..."
    npx -y serve .
    exit 0
fi

# Fallback to Python 3
if command -v python3 &>/dev/null; then
    echo "✅ Python 3 detected. Starting server on http://localhost:8000"
    python3 -m http.server 8000
elif command -v python &>/dev/null; then
    # Check if it's Python 3 or 2
    PY_VER=$(python -c 'import sys; print(sys.version_info[0])')
    if [ "$PY_VER" -eq 3 ]; then
        echo "✅ Python 3 detected. Starting server on http://localhost:8000"
        python -m http.server 8000
    else
        echo "✅ Python 2 detected. Starting legacy server on http://localhost:8000"
        python -m SimpleHTTPServer 8000
    fi
else
    echo "❌ Error: Neither 'npx' nor 'python' was found."
    echo "Please install Node.js (npx) or Python to run this project locally."
    exit 1
fi


