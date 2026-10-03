"""Opens the native macOS window, verifies the local UI, then closes it."""
import threading
import webview

loaded = threading.Event()
result = []
window = webview.create_window('APPLE · Desktop check', 'http://127.0.0.1:8000', width=1200, height=800, background_color='#0c0e13')
window.events.loaded += loaded.set


def check():
    try:
        assert loaded.wait(20), 'Native page did not load'
        assert window.evaluate_js('document.title') == 'APPLE — Your personal assistant'
        assert window.evaluate_js('document.getElementById("root").childElementCount') > 0
        result.append(True)
    finally:
        window.destroy()


webview.start(check)
assert result, 'Native desktop rendering failed'
print('PASS: native macOS window rendered the APPLE interface and closed cleanly.')
