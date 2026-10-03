"""Explicit macOS adapters; model output is never executed as code."""
import asyncio
import platform
from pathlib import Path
from urllib.parse import quote, urlparse
from models import Action
from whatsapp_native import whatsapp as native_whatsapp
from desktop_apps import open_installed
from desktop_automation import desktop_action

APP_MAP = {'chrome': 'Google Chrome', 'vs code': 'Visual Studio Code', 'vscode': 'Visual Studio Code',
           'whatsapp': 'WhatsApp', 'whats app': 'WhatsApp', 'what’s app': 'WhatsApp'}
DESKTOP_LOCK = asyncio.Lock()
REVIEW_ACTIONS = {'whatsapp_send', 'type_text', 'press_key', 'run_shortcut',
                  'search_app', 'click_control', 'set_field'}


async def process(*args, timeout=20):
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout)
    except (asyncio.TimeoutError, asyncio.CancelledError):
        if proc.returncode is None:
            proc.kill()
        await proc.wait()
        raise
    if proc.returncode:
        raise RuntimeError(err.decode(errors='replace').strip()[:500] or 'The application could not complete this action.')
    return out.decode(errors='replace').strip()


async def script(source, *args):
    return await process('osascript', '-e', source, *args)


async def execute_action(action: Action):
    if platform.system() != 'Darwin':
        return {'success': False, 'message': 'Computer actions require macOS.'}
    try:
        async with DESKTOP_LOCK:
            result = await _execute(action)
        return {'success': True, **result}
    except Exception as exc:
        return {'success': False, 'message': str(exc) or 'The action timed out. Check the app and macOS permissions.'}


async def _execute(a):
    target = a.target.strip()
    app = APP_MAP.get(target.lower(), target)
    if a.action in {'list_apps', 'inspect_app', 'search_app', 'click_control', 'set_field'}:
        return await desktop_action(a, process)
    if a.action == 'open_app':
        installed = await open_installed(target, process)
        return {'message': f'Opened {installed.name}.', 'app': installed.public()}
    if a.action in {'open_website', 'google_search', 'youtube_search'}:
        if a.action == 'google_search':
            url = 'https://www.google.com/search?q=' + quote(target, safe='')
        elif a.action == 'youtube_search':
            url = 'https://www.youtube.com/results?search_query=' + quote(target, safe='')
        else:
            url = target if '://' in target else 'https://' + target
        parsed = urlparse(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username:
            raise ValueError('Use a valid http or https website address.')
        await process('open', url)
        if a.action == 'google_search':
            message = f'Opened search results for {target}.'
        elif a.action == 'youtube_search':
            message = f'Opened YouTube results for {target}.'
        else:
            message = f'Opened {parsed.hostname}.'
        return {'message': message, 'url': url}
    if a.action == 'find_file':
        output = await process('mdfind', '-name', target)
        paths = [p for p in output.splitlines() if Path(p).is_file()][:30]
        return {'message': f'Found {len(paths)} files.' if paths else 'No matching files found in the Spotlight index.', 'files': paths}
    if a.action in {'open_file', 'create_folder'}:
        path = Path(target).expanduser()
        if a.action == 'create_folder' and not path.is_absolute():
            path = Path.home() / 'Desktop' / path
        path = path.resolve()
        if not path.is_relative_to(Path.home().resolve()):
            raise ValueError('Choose a path inside your home folder.')
        if a.action == 'create_folder':
            path.mkdir(parents=True, exist_ok=True)
        elif not path.exists():
            raise ValueError('That file does not exist.')
        if a.action == 'open_file' and (path.is_dir() or path.suffix.lower() not in {'.pdf', '.txt', '.md', '.png', '.jpg', '.jpeg', '.csv', '.docx', '.xlsx', '.pptx'}):
            raise ValueError('Open-file supports documents and images only. Use open app for applications.')
        await process('open', str(path))
        return {'message': f'{"Created" if a.action == "create_folder" else "Opened"} {path}.'}
    if a.action == 'run_shortcut':
        await process('shortcuts', 'run', target, timeout=120)
        return {'message': f'Shortcut “{target}” finished.'}
    if a.action in {'type_text', 'press_key'}:
        # Constrain generic keystrokes to communication/productivity apps.
        allowed = {'notes', 'textedit', 'messages', 'whatsapp', 'mail', 'slack'}
        if app.lower() not in allowed:
            raise ValueError('Typing supports Notes, TextEdit, Messages, WhatsApp, Mail and Slack. Use a macOS Shortcut for other apps.')
        if a.action == 'type_text' and ('\n' in a.message or '\r' in a.message):
            raise ValueError('Use single-line text; sending is a separate action.')
        if a.action == 'press_key' and a.message.lower() not in {'enter', 'tab', 'escape'}:
            raise ValueError('Supported keys: enter, tab, escape.')
        source = '''on run argv
set appName to item 1 of argv
tell application "System Events"
set candidates to application processes whose name is appName
if (count candidates) is not 1 then error "Open the destination app and choose the field first."
set frontmost of item 1 of candidates to true
end tell
delay 0.4
tell application "System Events"
if name of first application process whose frontmost is true is not appName then error "Destination app is not focused."
'''
        if a.action == 'type_text':
            source += 'keystroke (item 2 of argv)\n'
            value = a.message
        else:
            source += 'key code (item 2 of argv as integer)\n'
            value = {'enter': '36', 'tab': '48', 'escape': '53'}[a.message.lower()]
        await script(source + 'end tell\nend run', app, value)
        return {'message': f'{"Typed text" if a.action == "type_text" else "Pressed " + a.message} in {app}. Check the destination field.'}
    if a.action in {'whatsapp_open', 'whatsapp_send'}:
        return await whatsapp(target, a.message, a.action == 'whatsapp_send', expected_name=a.control)
    raise ValueError('Unsupported action.')


async def close_browser():
    """Compatibility lifecycle hook: native WhatsApp owns its own process."""


async def whatsapp(contact, message, send, *, expected_name=''):
    return await native_whatsapp(contact, message, send, process, expected_name=expected_name)
