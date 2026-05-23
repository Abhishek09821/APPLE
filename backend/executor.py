import subprocess
import asyncio
import os
import webbrowser
from pathlib import Path
from typing import Optional

# ─── macOS App name mappings ────────────────────────────────────────────────
APP_MAP = {
    "vs code": "Visual Studio Code",
    "vscode": "Visual Studio Code",
    "code": "Visual Studio Code",
    "chrome": "Google Chrome",
    "safari": "Safari",
    "firefox": "Firefox",
    "spotify": "Spotify",
    "whatsapp": "WhatsApp",
    "terminal": "Terminal",
    "finder": "Finder",
    "notion": "Notion",
    "slack": "Slack",
    "discord": "Discord",
    "zoom": "zoom.us",
    "notes": "Notes",
    "calendar": "Calendar",
    "mail": "Mail",
    "messages": "Messages",
    "xcode": "Xcode",
    "postman": "Postman",
    "figma": "Figma",
}


def resolve_app_name(target: str) -> str:
    return APP_MAP.get(target.lower().strip(), target)


async def execute_action(intent: dict) -> dict:
    action = intent.get("action", "unknown")
    target = intent.get("target", "")
    params = intent.get("parameters", {})
    message = intent.get("message", "")

    handlers = {
        "open_app": open_app,
        "open_website": open_website,
        "google_search": google_search,
        "whatsapp_send": whatsapp_send,
        "create_folder": create_folder,
        "delete_file": delete_file,
        "mute_notifs": mute_notifications,
        "unmute_notifs": unmute_notifications,
        "workflow": run_workflow,
        "youtube_search": youtube_search,
        "system_settings": system_settings,
    }

    handler = handlers.get(action)
    if handler:
        return await handler(target, params, message)
    else:
        return {"success": False, "message": f"Unknown action: {action}. Try rephrasing your command."}


# ─── App Launcher ────────────────────────────────────────────────────────────
async def open_app(target: str, params: dict, message: str) -> dict:
    app_name = resolve_app_name(target)
    try:
        script = f'tell application "{app_name}" to activate'
        result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"success": True, "message": f"✅ Opened {app_name}", "steps": [f"Resolved app: {app_name}", "Sent activate signal via AppleScript", f"{app_name} is now open"]}
        else:
            # Try open command as fallback
            result2 = subprocess.run(["open", "-a", app_name], capture_output=True, text=True, timeout=10)
            if result2.returncode == 0:
                return {"success": True, "message": f"✅ Opened {app_name}", "steps": [f"Launched via open -a", f"{app_name} started"]}
            return {"success": False, "message": f"Could not open {app_name}. Make sure it's installed.", "steps": [f"App not found: {app_name}"]}
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Timeout: App took too long to open."}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Website Opener ──────────────────────────────────────────────────────────
async def open_website(target: str, params: dict, message: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    try:
        subprocess.run(["open", url], check=True)
        return {"success": True, "message": f"✅ Opened {url}", "steps": [f"Resolved URL: {url}", "Opened in default browser"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Google Search ───────────────────────────────────────────────────────────
async def google_search(target: str, params: dict, message: str) -> dict:
    query = target.replace(" ", "+")
    url = f"https://www.google.com/search?q={query}"
    try:
        subprocess.run(["open", url], check=True)
        return {"success": True, "message": f"✅ Searching Google for: {target}", "steps": [f"Query: {target}", "Encoded URL", "Opened Chrome with search results"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── YouTube Search ──────────────────────────────────────────────────────────
async def youtube_search(target: str, params: dict, message: str) -> dict:
    query = target.replace(" ", "+")
    url = f"https://www.youtube.com/results?search_query={query}"
    try:
        subprocess.run(["open", url], check=True)
        return {"success": True, "message": f"✅ Searching YouTube for: {target}", "steps": ["Opened YouTube", f"Searched: {target}", "Results loaded in browser"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── WhatsApp Automation ─────────────────────────────────────────────────────
async def whatsapp_send(target: str, params: dict, message: str) -> dict:
    """
    Opens WhatsApp Web in Chrome and uses Playwright to send a message.
    Requires: pip install playwright && playwright install chromium
    """
    try:
        from playwright.async_api import async_playwright

        steps = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, slow_mo=500)
            context = await browser.new_context()
            page = await context.new_page()

            steps.append("Browser launched")
            await page.goto("https://web.whatsapp.com")
            steps.append("Opened WhatsApp Web")

            # Wait for WhatsApp to load (user must be logged in)
            await page.wait_for_selector('[data-testid="chat-list"]', timeout=30000)
            steps.append("WhatsApp Web loaded")

            # Search for contact
            search_box = await page.wait_for_selector('[data-testid="search-container"]', timeout=10000)
            await search_box.click()
            await page.keyboard.type(target)
            steps.append(f"Searched for: {target}")
            await asyncio.sleep(2)

            # Click first result
            first_result = await page.wait_for_selector('[data-testid="cell-frame-container"]', timeout=10000)
            await first_result.click()
            steps.append(f"Opened chat with {target}")

            # Type and send message
            msg_box = await page.wait_for_selector('[data-testid="conversation-compose-box-input"]', timeout=10000)
            await msg_box.click()
            await msg_box.type(message or f"Hello from APPLE!")
            steps.append("Message typed")
            await page.keyboard.press("Enter")
            steps.append("Message sent ✓")

            await asyncio.sleep(1)
            await browser.close()

        return {"success": True, "message": f"✅ Message sent to {target}", "steps": steps}

    except ImportError:
        return {"success": False, "message": "Playwright not installed. Run: pip install playwright && playwright install chromium", "steps": []}
    except Exception as e:
        return {"success": False, "message": f"WhatsApp error: {str(e)}. Make sure you're logged into WhatsApp Web.", "steps": []}


# ─── File System ─────────────────────────────────────────────────────────────
async def create_folder(target: str, params: dict, message: str) -> dict:
    path_str = params.get("path", f"~/Desktop/{target}")
    path = Path(path_str).expanduser()
    try:
        path.mkdir(parents=True, exist_ok=True)
        subprocess.run(["open", str(path)])  # Open in Finder
        return {"success": True, "message": f"✅ Created folder: {path}", "steps": [f"Path resolved: {path}", "Directory created", "Opened in Finder"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def delete_file(target: str, params: dict, message: str) -> dict:
    path = Path(target).expanduser()
    if not path.exists():
        return {"success": False, "message": f"Path not found: {path}"}
    try:
        # Move to trash instead of permanent delete (safer)
        script = f'tell application "Finder" to delete POSIX file "{path}"'
        subprocess.run(["osascript", "-e", script], check=True)
        return {"success": True, "message": f"✅ Moved to Trash: {path}", "steps": ["Located file", "Moved to Trash (recoverable)"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Notifications ───────────────────────────────────────────────────────────
async def mute_notifications(target: str, params: dict, message: str) -> dict:
    try:
        # Enable Do Not Disturb via AppleScript
        script = '''
        tell application "System Events"
            tell process "Control Center"
                set frontmost to true
            end tell
        end tell
        '''
        # Simpler: toggle via defaults
        subprocess.run(["defaults", "-currentHost", "write", "com.apple.notificationcenterui", "doNotDisturb", "-boolean", "true"])
        subprocess.run(["killall", "NotificationCenter"])
        return {"success": True, "message": "✅ Notifications muted (Do Not Disturb ON)", "steps": ["Applied DND setting via defaults", "Restarted NotificationCenter"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def unmute_notifications(target: str, params: dict, message: str) -> dict:
    try:
        subprocess.run(["defaults", "-currentHost", "write", "com.apple.notificationcenterui", "doNotDisturb", "-boolean", "false"])
        subprocess.run(["killall", "NotificationCenter"])
        return {"success": True, "message": "✅ Notifications restored", "steps": ["Removed DND setting", "Restarted NotificationCenter"]}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ─── Workflows ───────────────────────────────────────────────────────────────
WORKFLOWS = {
    "coding_mode": [
        {"action": "open_app", "target": "VS Code", "params": {}, "message": ""},
        {"action": "open_website", "target": "https://leetcode.com", "params": {}, "message": ""},
        {"action": "open_app", "target": "Spotify", "params": {}, "message": ""},
        {"action": "mute_notifs", "target": "system", "params": {}, "message": ""},
    ],
    "dsa_mode": [
        {"action": "open_website", "target": "https://leetcode.com", "params": {}, "message": ""},
        {"action": "open_website", "target": "https://web.whatsapp.com", "params": {}, "message": ""},
        {"action": "mute_notifs", "target": "system", "params": {}, "message": ""},
    ],
    "work_mode": [
        {"action": "open_app", "target": "Safari", "params": {}, "message": ""},
        {"action": "open_app", "target": "WhatsApp", "params": {}, "message": ""},
        {"action": "open_website", "target": "https://mail.google.com", "params": {}, "message": ""},
        {"action": "mute_notifs", "target": "system", "params": {}, "message": ""},
    ],
    "morning_mode": [
        {"action": "open_website", "target": "https://news.ycombinator.com", "params": {}, "message": ""},
        {"action": "open_website", "target": "https://sharkexchange.in/futures/btcusdt", "params": {}, "message": ""},
        {"action": "open_app", "target": "Spotify", "params": {}, "message": ""},
    ],
}


async def run_workflow(target: str, params: dict, message: str) -> dict:
    workflow_key = target.lower().replace(" ", "_")
    steps_data = WORKFLOWS.get(workflow_key)

    if not steps_data:
        # Try partial match
        for k in WORKFLOWS:
            if k in workflow_key or workflow_key in k:
                steps_data = WORKFLOWS[k]
                workflow_key = k
                break

    if not steps_data:
        return {"success": False, "message": f"Workflow '{target}' not found. Available: {', '.join(WORKFLOWS.keys())}"}

    completed = []
    for step in steps_data:
        result = await execute_action({
            "action": step["action"],
            "target": step["target"],
            "parameters": step["params"],
            "message": step["message"],
        })
        completed.append(f"{'✅' if result['success'] else '❌'} {step['target']}")
        await asyncio.sleep(0.8)  # Small delay between steps

    return {
        "success": True,
        "message": f"✅ Workflow '{workflow_key}' completed — {len(completed)} steps",
        "steps": completed,
    }


async def system_settings(target: str, params: dict, message: str) -> dict:
    try:
        subprocess.run(["open", "-a", "System Preferences"], check=True)
        return {"success": True, "message": "✅ Opened System Preferences", "steps": ["Launched System Preferences"]}
    except Exception as e:
        return {"success": False, "message": str(e)}
