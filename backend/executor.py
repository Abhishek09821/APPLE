"""Explicit macOS adapters; model output is never executed as code."""
import asyncio
import platform
from pathlib import Path
from urllib.parse import quote, urlparse
from models import Action
from storage import DATA_DIR

APP_MAP = {'chrome': 'Google Chrome', 'vs code': 'Visual Studio Code', 'vscode': 'Visual Studio Code'}
DESKTOP_LOCK = asyncio.Lock()
REVIEW_ACTIONS = {'whatsapp_send', 'type_text', 'press_key', 'run_shortcut'}


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
    if a.action == 'open_app':
        await process('open', '-a', app)
        return {'message': f'Opened {app}.'}
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
        return {'message': f'Opened {url}', 'url': url}
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
        return await whatsapp(target, a.message, a.action == 'whatsapp_send')
    raise ValueError('Unsupported action.')


_whatsapp_runtime = None
_whatsapp_context = None


async def close_browser():
    global _whatsapp_runtime, _whatsapp_context
    if _whatsapp_context:
        await _whatsapp_context.close()
    if _whatsapp_runtime:
        await _whatsapp_runtime.stop()
    _whatsapp_context = _whatsapp_runtime = None


async def whatsapp(contact, message, send):
    global _whatsapp_runtime, _whatsapp_context
    from playwright.async_api import async_playwright
    if send and not message.strip():
        raise ValueError('A message is required.')
    if not _whatsapp_context or not _whatsapp_context.pages:
        await close_browser()
        _whatsapp_runtime = await async_playwright().start()
        _whatsapp_context = await _whatsapp_runtime.chromium.launch_persistent_context(
            str(DATA_DIR / 'whatsapp-profile'), headless=False)
    context = _whatsapp_context
    page = context.pages[0] if context.pages else await context.new_page()
    if not page.url.startswith('https://web.whatsapp.com'):
        await page.goto('https://web.whatsapp.com', wait_until='domcontentloaded')
    await page.bring_to_front()
    search = page.locator('#side [contenteditable="true"][role="textbox"]').first
    try:
        await search.wait_for(timeout=90000)
    except Exception as exc:
        raise RuntimeError('WhatsApp is not ready. Scan the QR code in the opened browser and try again. No message was sent.') from exc
    await search.fill(contact)
    match = page.locator('#pane-side').get_by_title(contact, exact=True)
    await match.first.wait_for(timeout=15000)
    if await match.count() != 1:
        raise ValueError('More than one chat matches this name. Use a unique contact name.')
    await match.click()
    header = page.locator('#main header').get_by_title(contact, exact=True).first
    await header.wait_for(timeout=10000)
    if not send:
        return {'message': f'Opened the exact WhatsApp chat for {contact}. The browser stays open.'}
    composer = page.locator('#main footer [contenteditable="true"][role="textbox"]')
    if (await composer.inner_text()).strip():
        raise ValueError('This chat already has a draft. Clear or send that draft in WhatsApp before trying again.')
    await composer.fill(message)
    if not await header.is_visible():
        raise ValueError('The selected chat changed. Message was not sent.')
    before = await page.locator('#main .message-out').count()
    await composer.press('Enter')
    try:
        await page.wait_for_function(
            '(count) => document.querySelectorAll("#main .message-out").length > count',
            arg=before, timeout=15000)
    except Exception as exc:
        raise RuntimeError('Send was requested, but WhatsApp did not confirm a new outgoing message. Check the chat before retrying.') from exc
    return {'message': f'WhatsApp displayed a new outgoing message to {contact}. Delivery has not been verified.'}
