import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE"))
model = genai.GenerativeModel("gemini-1.5-flash")

SYSTEM_PROMPT = """
You are APPLE's intent parser. Given a natural language command, extract the structured intent.

Return ONLY valid JSON (no markdown, no backticks, no explanation) with this exact structure:
{
  "action": "<action_type>",
  "target": "<app, website, contact, folder name, etc.>",
  "parameters": {<extra params>},
  "message": "<optional message to send>",
  "confidence": <0.0 to 1.0>
}

Action types:
- open_app        → open_app (VS Code, Chrome, Spotify, etc.)
- open_website    → open browser to URL
- google_search   → search Google
- whatsapp_send   → send WhatsApp message
- create_folder   → create a folder
- delete_file     → delete file/folder
- mute_notifs     → mute system notifications
- unmute_notifs   → unmute system notifications
- workflow        → multi-step named workflow (coding_mode, dsa_mode, etc.)
- schedule        → schedule a recurring task
- youtube_search  → search YouTube
- system_settings → change system settings

Examples:
"Open VS Code" → {"action":"open_app","target":"VS Code","parameters":{},"message":"","confidence":0.99}
"Send hello to Rahul" → {"action":"whatsapp_send","target":"Rahul","parameters":{},"message":"hello","confidence":0.97}
"Start coding mode" → {"action":"workflow","target":"coding_mode","parameters":{},"message":"","confidence":0.95}
"Search React roadmap on Google" → {"action":"google_search","target":"React roadmap","parameters":{},"message":"","confidence":0.98}
"Create folder named Projects" → {"action":"create_folder","target":"Projects","parameters":{"path":"~/Desktop/Projects"},"message":"","confidence":0.96}
"""


async def parse_command(command: str) -> dict:
    """Parse natural language command into structured intent using Gemini."""
    try:
        prompt = f"{SYSTEM_PROMPT}\n\nCommand: {command}"
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Clean up in case Gemini adds markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        intent = json.loads(raw)
        intent["original_command"] = command
        return intent

    except json.JSONDecodeError:
        # Fallback: basic keyword matching
        return fallback_parse(command)
    except Exception as e:
        print(f"Gemini error: {e}")
        return fallback_parse(command)


def fallback_parse(command: str) -> dict:
    """Keyword-based fallback parser if Gemini fails."""
    cmd = command.lower()

    if any(w in cmd for w in ["whatsapp", "send message", "message to"]):
        parts = command.split("to", 1)
        target = parts[1].strip() if len(parts) > 1 else "unknown"
        msg_parts = command.lower().split("send", 1)
        message = msg_parts[1].split("to")[0].strip() if len(msg_parts) > 1 else command
        return {"action": "whatsapp_send", "target": target, "parameters": {}, "message": message, "confidence": 0.7}

    if "open" in cmd:
        target = command.replace("open", "").replace("Open", "").strip()
        return {"action": "open_app", "target": target, "parameters": {}, "message": "", "confidence": 0.75}

    if "search" in cmd or "google" in cmd:
        query = command.lower().replace("search", "").replace("google", "").strip()
        return {"action": "google_search", "target": query, "parameters": {}, "message": "", "confidence": 0.8}

    if "folder" in cmd or "create" in cmd:
        name = command.replace("create", "").replace("folder", "").replace("named", "").replace("Create", "").strip()
        return {"action": "create_folder", "target": name, "parameters": {"path": f"~/Desktop/{name}"}, "message": "", "confidence": 0.75}

    if "mute" in cmd or "silent" in cmd:
        return {"action": "mute_notifs", "target": "system", "parameters": {}, "message": "", "confidence": 0.85}

    if "coding" in cmd or "dsa" in cmd or "practice" in cmd:
        return {"action": "workflow", "target": "coding_mode", "parameters": {}, "message": "", "confidence": 0.8}

    if "youtube" in cmd or "music" in cmd or "play" in cmd:
        query = command.lower().replace("play", "").replace("search", "").replace("youtube", "").strip()
        return {"action": "youtube_search", "target": query, "parameters": {}, "message": "", "confidence": 0.75}

    return {"action": "unknown", "target": command, "parameters": {}, "message": "", "confidence": 0.3}
