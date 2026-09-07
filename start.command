#!/bin/bash
# Double-click this file in Finder to install (first time only) and start the app.
# macOS may ask you to confirm opening it once, via right-click > Open.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (LTS version) and re-run this file."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup: installing dependencies..."
  npm install
fi

echo ""
echo "Starting Resume ATS Alignment Studio..."
echo "Opening http://localhost:3000 in your browser in a few seconds."
echo "Leave this window open while you use the app. Close it (or press Ctrl+C) to stop the server."
echo ""

( sleep 2 && open http://localhost:3000 ) &
npm start
