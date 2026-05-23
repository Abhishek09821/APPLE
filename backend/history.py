import json, os
from datetime import datetime

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "data", "history.json")
os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)


def save_command(command: str, intent: dict, result: dict):
    history = get_history()
    history.insert(0, {
        "command": command,
        "intent": intent,
        "result": result,
        "timestamp": datetime.now().isoformat(),
        "success": result.get("success", False),
    })
    history = history[:100]  # Keep last 100
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def get_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE) as f:
            return json.load(f)
    return []
