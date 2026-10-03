#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  echo 'Run ./setup.sh first.'; exit 1
fi
if [[ "${1:-}" == "--desktop" ]]; then
  exec .venv/bin/python backend/desktop.py
fi
pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT
trap 'exit 130' INT TERM
.venv/bin/python backend/main.py &
pids+=("$!")
if [[ "${1:-}" == "--dev" ]]; then
  (cd frontend && exec npm run dev) &
  pids+=("$!")
  echo 'APPLE development UI: http://127.0.0.1:5173'
else
  if [[ ! -f frontend/dist/index.html ]]; then echo 'Build the interface: cd frontend && npm run build'; exit 1; fi
  echo 'APPLE is running at http://127.0.0.1:8000'
fi
wait
