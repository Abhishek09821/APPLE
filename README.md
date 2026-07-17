# 🍎 APPLE — Personal AI Action Assistant

> Natural Language → Real Computer Actions on macOS

---

## What is APPLE?

APPLE is a full-stack AI desktop automation assistant. You type (or speak) a command in plain English, and APPLE executes it on your Mac — opening apps, sending WhatsApp messages, searching the web, managing files, and running multi-step workflows.

---

## Requirements

- macOS 10+
- Python 3.10+
- Node.js 18+
- Gemini API key (free at https://aistudio.google.com/app/apikey)

---

## Quick Start (3 steps)

### Step 1 — Setup (run once)
```bash
chmod +x setup.sh start.sh
./setup.sh
```

### Step 2 — Add Gemini API Key
Open `backend/.env` and replace:
```
GEMINI_API_KEY=your_gemini_api_key_here
```
Get a free key at: https://aistudio.google.com/app/apikey

### Step 3 — Start APPLE
```bash
./start.sh
```
Then open **http://localhost:5173** in your browser.

---

## Manual Start (if start.sh doesn't work)

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

---

## What APPLE Can Do

### App Control
```
Open VS Code
Open Spotify
Open Chrome
Open Finder
```

### Web Automation
```
Search React roadmap on Google
Open github.com
Search YouTube for lo-fi music
```

### WhatsApp (requires WhatsApp Web login)
```
Send hello to Rahul
Message John: Meeting at 7pm
```

### File System
```
Create a folder named Projects on Desktop
Create folder named DSA
```

### System Control
```
Mute notifications
Enable Do Not Disturb
```

### Workflows (multi-step)
```
Start coding mode       → VS Code + LeetCode + Spotify + DND
Start DSA mode          → LeetCode + NeetCode + DND  
Start work mode         → Slack + Notion + Gmail + DND
Start morning mode      → HN + GitHub + Spotify
```

### Scheduling
```
Every morning open my trading dashboard
Schedule: open Gmail at 09:00
```

---

## Project Structure

```
APPLE/
├── backend/
│   ├── main.py          ← FastAPI server (port 8000)
│   ├── ai_parser.py     ← Gemini NLP intent parser
│   ├── executor.py      ← macOS automation engine
│   ├── scheduler.py     ← APScheduler recurring tasks
│   ├── history.py       ← Command history storage
│   ├── requirements.txt
│   └── .env             ← Add your Gemini key here
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          ← Main app logic
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Message.jsx
│   │   │   ├── RightPanel.jsx
│   │   │   ├── WorkflowsView.jsx
│   │   │   └── HistoryView.jsx
│   │   └── utils/api.js     ← Backend API calls
│   └── index.html
│
├── setup.sh             ← One-time setup
└── start.sh             ← Launch both servers
```

---

## Demo Mode

If the backend is not running, the frontend operates in **DEMO mode** (shown in the top bar). Commands still show realistic execution logs — but no real actions are performed. Start the backend to enable real automation.

---

## WhatsApp Setup

1. Run APPLE and send a WhatsApp command
2. A Chrome window will open with WhatsApp Web
3. Scan the QR code with your phone (first time only)
4. WhatsApp Web stays logged in for future commands

---

## Adding Custom Workflows

Edit `backend/executor.py`, find the `WORKFLOWS` dict and add:
```python
"my_mode": [
    {"action": "open_app", "target": "Safari", "params": {}, "message": ""},
    {"action": "open_website", "target": "https://notion.so", "params": {}, "message": ""},
],
```

Then say: `Start my mode`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /command | Execute a command |
| POST | /command/stream | Execute with live updates (SSE) |
| GET | /history | Command history |
| POST | /schedule | Add scheduled task |
| GET | /schedule | List scheduled tasks |
| GET | /status | Backend health check |

---

## Troubleshooting

**Backend won't start:**
```bash
cd backend && source venv/bin/activate && pip install -r requirements.txt
```

**WhatsApp automation fails:**
- Make sure you're logged into WhatsApp Web
- First run opens a visible Chrome window for QR scan

**App not opening:**
- Check the app name — try exact name e.g. "Visual Studio Code" not "vscode"
- The executor has common aliases built in

**Gemini not working:**
- APPLE falls back to keyword matching automatically
- Check your API key in backend/.env

---

## Built With

- **Frontend:** React 18, Vite, Framer Motion
- **Backend:** Python FastAPI, Uvicorn
- **AI:** Google Gemini 1.5 Flash
- **Automation:** Playwright (browser), AppleScript (macOS apps), subprocess (system)
- **Scheduler:** APScheduler

---

*APPLE — Your Personal AI Action Engine*
