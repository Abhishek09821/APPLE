# APPLE · Your local desktop assistant

A rebuilt macOS assistant with a responsive command center, local AI conversations, spoken replies, real computer actions, a document library, study quizzes, and routines you can teach.

There is no simulated execution mode. Offline connections, unsupported actions, failed steps, and uncertain message delivery are shown honestly.

## Start

Requires macOS, Python 3.10+, and Node.js 22.12+ (or 24+).

```bash
./setup.sh --desktop
./start.sh --desktop
```

For a browser window instead:

```bash
./setup.sh
./start.sh
# Open http://127.0.0.1:8000
```

For frontend development, use `./start.sh --dev` and open `http://127.0.0.1:5173`. Stop with Ctrl+C. The native window reuses an existing local APPLE server. If it starts its own server, it shuts that server down when closed. Port 8000 must otherwise be available.

### Connect local intelligence

Install [Ollama](https://ollama.com/download/mac), then download a model suited to your Mac’s available memory. For example:

```bash
ollama pull qwen3:8b
ollama serve
```

If the Ollama application already runs the server, you do not need a second `ollama serve`. In APPLE → Settings, select the exact installed model name and save. The status indicator distinguishes basic computer tools from a connected model. No model is bundled or silently downloaded. A model download can take several gigabytes.

APPLE calls only the local Ollama endpoint at `127.0.0.1:11434`. The API uses [Ollama chat and JSON schemas](https://docs.ollama.com/capabilities/structured-outputs). No Gemini key or cloud AI account is required.

## Use it

| Request | What happens |
| --- | --- |
| `Open Chrome` / `Open Notes` / `Open camera` | Resolves an installed app, including common aliases and portable apps |
| `List my apps` | Shows the discovered app inventory |
| `Search Bluetooth in System Settings` | Searches an installed app through its native controls |
| `Inspect Calculator` | Reads the app’s exposed controls |
| `Click plus in Calculator` | Resolves the spoken label to the visible native Add button |
| `Remember that I prefer short explanations` | Saves an explicit fact for future sessions |
| `Open https://example.com` | Opens an HTTP(S) website |
| `Search for orbital mechanics` | Opens search results in the browser |
| `Search YouTube for piano music` | Opens YouTube search |
| `Find file biology.pdf` | Searches the local Spotlight index |
| `Open file ~/Documents/notes.pdf` | Opens a document or image inside your home folder |
| `Create folder Revision` | Creates the folder on your Desktop |
| `Learn ~/Documents/biology.pdf` | Imports the document and selects it for follow-up questions |
| `Open Rahul chat in WhatsApp` | Finds an exact, unique chat in the installed WhatsApp Mac app |
| `WhatsApp Rahul: I will be there at 7` | Resolves a saved contact alias and attempts native sending |
| `Mummy ko hii bhejo` | Uses Mummy’s saved international phone number |
| `Run shortcut Focus time` | Reviews and runs an existing macOS Shortcut |
| `Run My morning` | Runs a routine saved in My routines |

With a model connected, you can have conversations, phrase requests naturally, give multiple steps, and ask contextual follow-up questions within the current session. The model can only select validated, supported tools. It cannot execute arbitrary shell commands or invent new automation capabilities.

### Voice

Spoken replies are synthesized locally with macOS `say` and the system’s default voice, then played in the browser through Web Audio. Microphone and playback amplitude drive the icon, glow and voice meter in real time; silence settles the meter. Emoji, raw URLs and Markdown are excluded from speech. Long replies stay on screen while the voice reads a concise version. Toggle them in the top bar, read an individual reply aloud, or adjust the speaking rate in Settings. Stop interrupts speech and active commands.

Choose **Start listening**, allow the microphone, and speak naturally. Final speech submits automatically; no Send or Enter is needed. **Settings → Spoken language** offers English (India), Hindi, English (US), and English (UK); the choice saves in this browser. Positively reported low-confidence transcripts ask you to repeat instead of executing.

On supported desktop Chrome versions, the recognizer consumes the same echo-cancelled microphone track as the visualizer. APPLE requests cancellation of all speaker output. If the browser confirms that mode, new speech interrupts playback and the final words submit your next request. Otherwise recognition pauses before playback and resumes after its acoustic tail; **Interrupt** stops the reply and resumes listening. Echo filtering uses the exact cleaned speech, including generated phrases, and retains recent replies to reject delayed transcripts. See [recognition audio tracks](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start) and [Chrome speaker echo cancellation](https://developer.chrome.com/release-notes/141#echocancellationmode_for_getusermedia).

Common spoken app/search/WhatsApp commands bypass model inference. Qwen3 uses non-thinking mode with a smaller context and stays loaded for fifteen minutes after use. Listening pauses while a command or grade is being computed and while a plan needs on-screen confirmation. **End session** releases the microphone; **Stop** cancels pending work and speech. Typed requests remain available. Browser dictation may require internet and transmit audio to the browser provider. Native spoken replies are local. System-wide wake words and offline speech recognition are not implemented.

### WhatsApp and typing

In **Settings → WhatsApp contacts**, save the exact WhatsApp display name, international phone number (for example `+91…`) and voice aliases such as `Mummy, Mom, माँ`. You can add, edit and remove contacts; they persist locally. Duplicate numbers and conflicting aliases are rejected. Spoken aliases resolve to the saved number without guessing a recipient. `Send hii to Mummy` and `Mummy ko hii bhejo` use that same saved entry.

WhatsApp opens the saved number directly in the installed Mac app, bypassing contact search. Before editing or sending, it verifies the chat against the saved display name or number and preserves drafts that differ from your requested message. An explicit retry can reuse an exactly matching draft. Composer text uses native Unicode input events so WhatsApp activates its real Send button; sending waits for that visible control and presses it once. Multiline messages are currently rejected before typing. Without a saved entry it can try the native contact picker, but an unknown or ambiguous name stops with an explanation. There is no browser fallback. An outgoing message appearing in the native UI is reported separately from delivery; check the chat before retrying an uncertain send. Native app updates can change its Accessibility layout.

One-time setup offers **Trusted automation**, which allows your requested supported actions and messages to run without repeated in-app confirmation. The choice persists and can be revoked in Settings. Without that opt-in, reviewed plans expire after ten minutes and approvals are single-use. macOS Accessibility and browser microphone permissions are separate and cannot be silently granted by APPLE.

Explicit typing/key actions support Notes, TextEdit, Messages, WhatsApp, Mail, and Slack. Open the app and choose the destination text field first. Grant the launching terminal/Python app Accessibility permission in System Settings → Privacy & Security when needed. APPLE verifies the focused application, but cannot identify an arbitrary focused field. Typing and key presses use the same trusted-automation preference. Use a named macOS Shortcut for more specialized app behavior.

### Learn from documents

Import a PDF, DOCX, UTF-8 TXT, or Markdown file in Knowledge library, drag it in, paste its local path, or use `Learn ~/Documents/file.pdf`. Imports support up to 20 MB, 1,000 PDF pages, and three million extracted characters. Encrypted PDFs must be unlocked; scanned documents require OCR first.

Uploads start a **Voice teacher** lesson by default: APPLE asks a question aloud, accepts a spoken or typed answer, explains whether it is correct, and advances to the next question. It announces the final score. Lessons use up to three short questions, validated against exact source text. Invalid generated items are discarded individually; if none are usable, a labelled source-review exercise uses statements copied from the document. Prepared questions are cached for this document and model, so **Practice again** creates a fresh score immediately without regenerating questions. Changing the source or model invalidates the cache; deleting the document removes it. Closing a lesson cancels unfinished generation/grading requests. Say “repeat question” or “end lesson”; you can also use **Teach me aloud** on an existing document. Disable **Teach me after upload** in Settings to import without starting a lesson.

All extracted pages are indexed in local SQLite storage. Questions retrieve relevant excerpts and include page references. “Quiz me” samples excerpts across the document, generates questions, hides reference answers, grades your responses, and shows a session score. You can also ask the conversational tutor to question you one prompt at a time. Natural-language question generation and semantic grading use your local model and can contain mistakes; use the source references to check them.

This is document retrieval and persistent reference knowledge, not model-weight training. A retrieved answer does not necessarily consider every page at once. Deleting a library entry removes the index, not the original file. Historical answers and saved practice sessions remain in the local database.

### Teach a routine

In My routines, choose a name and enter one command per line. Routines persist across restarts. Say `Run <name>` to use one. All steps are planned and validated before execution; execution stops at the first failed step. Plans containing sends, typing, key presses, or Shortcuts require review unless trusted automation is enabled. Use a named macOS Shortcut for actions beyond the built-in adapters.

## Boundaries

APPLE discovers installed applications and can inspect, search, click and fill controls exposed through macOS Accessibility. Multi-step app tasks use an inspect–act–inspect loop with up to six actions and require visible evidence before reporting completion. Some apps do not expose usable controls; those tasks stop with a concrete explanation. It does not have unrestricted control of every laptop application. It does not have arbitrary screen vision, click-anything navigation, automatic skill installation, OCR, model fine-tuning, wake-word listening, or background scheduled jobs. Search tools open results; they do not browse and summarize the web. Stop prevents further work but cannot undo an action already completed or reliably revoke work a separate application has already accepted.

The old demo responses, brittle notification toggles, and nonpersistent scheduled-job implementation were removed. Old JSON history remains untouched; new activity is stored in SQLite. Existing Gemini configuration is no longer used.

## Architecture

- `frontend/src/App.jsx`: session orchestration, voice input, streaming execution, navigation.
- `frontend/src/components/`: document, study, routine, activity, settings views and shared UI.
- `backend/main.py`: loopback API, stream lifecycle, single-use approvals, API authentication, native speech.
- `backend/models.py`: validated settings and bounded action-plan schemas.
- `backend/ai_parser.py`: explicit offline commands and local Ollama reasoning.
- `backend/executor.py`: asynchronous macOS actions.
- `backend/desktop_apps.py`, `desktop_automation.py`, `desktop_ax.js`: installed app inventory and native control adapters.
- `backend/app_agent.py`: bounded, observed multi-step app automation.
- `backend/contacts.py`: saved WhatsApp numbers and voice aliases.
- `backend/memory.py`: explicit persistent user facts.
- `backend/whatsapp_native.py`: verified native WhatsApp control.
- `backend/whatsapp_ax.js`: bounded native Accessibility bridge using macOS automation permissions.
- `backend/speech.py`: concise narration and local PCM speech synthesis.
- `backend/knowledge.py`: PDF extraction, local retrieval, question generation and grading.
- `backend/storage.py`: transactional SQLite persistence.
- `backend/desktop.py`: optional native pywebview window.

Local data is stored under `backend/data/apple.db`. Older `whatsapp-profile/` folders are not used by the native adapter. Set `APPLE_DATA_DIR` to a separate directory for isolated tests. The local database contains private conversations and document text; it is not encrypted by the app. Standard system account and disk protection apply.

The server binds to loopback, validates host/origin, and requires a process-scoped token for mutations. Personal records stay local; explicitly requested web navigation and messaging use the internet. Do not expose the backend to a network or run untrusted applications under the same account.

## Verification

```bash
.venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm test
npm run build
npm run format:check
npm audit
```

With the local app running and Playwright Chromium installed:

```bash
.venv/bin/python backend/tests/browser_smoke.py
# Optional native window check (opens and automatically closes a window):
.venv/bin/python backend/tests/desktop_smoke.py
```

The voice browser test (`backend/tests/voice_smoke.py`) uses synthetic microphone and PCM audio to verify the shared recognition track, amplitude/silence synchronization, delayed echo rejection, both full-duplex and turn-taking capability branches, interruption, automatic submission, microphone release, hidden navigation and a complete upload-to-spoken-lesson workflow. Recognition and capability responses are fixtures; this does not measure real microphone transcription accuracy or acoustic cancellation quality. `contacts_smoke.py` verifies the contact form with isolated fixtures; no actual contacts or messages are used.

The UI smoke test imports and removes a synthetic note, creates and removes a routine, cancels a message plan, checks settings and responsive layout, and captures screenshots under `/tmp/apple-*.png`. It never sends a message or executes a desktop action. Model-dependent unit tests use deterministic mocked model responses. Real model quality, live WhatsApp delivery, and macOS Accessibility interactions require testing on your configured machine.

The voice workspace uses Motion for React, a custom APPLE mark, an interactive ambient background and real Web Audio amplitude. Move to the top-center edge to reveal navigation, or focus/tap the navigation handle. Animations respect reduced-motion preferences.


## Home, appearance and the floating companion

The local root page opens the product introduction. Use `http://127.0.0.1:8000/#assistant` to open the voice workspace directly. About, Contact & support, FAQs and Privacy policy are separate hash routes, linked in the full-width navigation and footer. The contact page links to Abhishek Tiwari’s supplied email and LinkedIn profile; it does not submit a form or send email automatically. These pages are served locally, not published to the internet.

Use the sun/moon button or Settings to choose light or dark appearance. Theme, interface-sound switch and sound volume persist in this browser. Short, generated sound cues respond to clicks, controls and scrolling; scroll cues are throttled, and all interface sounds pause during a voice session or spoken reply. Animations respect the system’s reduced-motion preference. The **Conversational expression** setting lets the model use occasional natural “hmm” or “yeah”; save settings to apply it. Speech remains the installed macOS voice, so available vocal expression depends on that voice.

In desktop Chrome, choose **Float assistant** from the top bar or Settings. The companion uses the [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) to open a real window above other applications, with the same microphone session, audio meter, reply and Stop control. Drag its title bar to position it; Chrome manages its size and remembered position. Keep the original APPLE tab open. **Return to APPLE** preserves the session; closing the companion ends listening and speech. Other browsers and the optional WebKit desktop wrapper show a capability message rather than pretending to provide an always-on-top window.

## Manage activity history

Activity supports searching the 100 most recent entries, deleting one entry, selecting several entries (including across a search), and clearing all activity, including older entries. Deletion has an inline confirmation and permanently removes those records from the local database and future conversation context. It does not remove imported documents, saved contacts, explicit memories, study sessions or messages already sent to other apps. These have separate controls where provided. Clearing the current conversation’s records also resets its visible messages.

`backend/tests/test_history.py` checks deletion scope, authentication, input limits, records beyond the visible page, and subsequent model context with a disposable database. `backend/tests/product_smoke.py` checks the new pages, contact links, themes, sound feedback, history selection, mobile layout and a real Chrome floating window. All API responses and voice transcripts in that browser test are fixtures; it uses synthetic microphone input and does not change personal history or send messages.
