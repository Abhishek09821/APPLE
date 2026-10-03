"""Optional native macOS window. Start with ./start.sh --desktop."""
from pathlib import Path
import threading
import time
import httpx
import uvicorn
try:
    import webview
except ImportError:
    raise SystemExit('Install the native window with: ./setup.sh --desktop')
from main import app

if not (Path(__file__).parent.parent / 'frontend' / 'dist' / 'index.html').exists():
    raise SystemExit('Build the interface first: cd frontend && npm run build')

# Reuse an already-running local APPLE backend (for example the browser preview).
server = None
thread = None
try:
    response = httpx.get('http://127.0.0.1:8000/api/status', timeout=5, trust_env=False)
    data = response.json()
    if response.status_code != 200 or data.get('status') != 'online' or 'ai' not in data or 'token' not in data:
        raise SystemExit('Port 8000 is occupied by another service. Stop that service before starting APPLE.')
except httpx.ConnectError:
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=8000, log_level='warning'))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.1)
    else:
        raise SystemExit('The local server could not start. Is port 8000 in use?')
except (httpx.HTTPError, ValueError):
    raise SystemExit('The service on port 8000 did not respond as APPLE. Check it before starting the desktop window.')

try:
    webview.create_window('APPLE — Your personal assistant', 'http://127.0.0.1:8000',
                          width=1440, height=940, min_size=(800, 600), background_color='#0c0e13')
    webview.start()
finally:
    if server:
        server.should_exit = True
        thread.join(timeout=5)
