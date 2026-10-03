#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo 'Python 3.10+ is required.'; exit 1; }
command -v npm >/dev/null || { echo 'Node.js 20+ is required.'; exit 1; }
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m playwright install chromium
if [[ "${1:-}" == "--desktop" ]]; then
  .venv/bin/python -m pip install -r backend/requirements-desktop.txt
fi
cd frontend
npm ci
npm run build
echo 'Setup complete. Run ./start.sh, or ./start.sh --desktop if installed.'
echo 'For local AI, install Ollama and run: ollama pull qwen3:8b'
