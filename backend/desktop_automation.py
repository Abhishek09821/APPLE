"""Bounded native app inspection and exact-control operations for voice plans."""
import asyncio
import json
import re
from pathlib import Path

from desktop_apps import app_key, installed_apps, open_installed

BRIDGE = Path(__file__).with_name('desktop_ax.js')
PERMISSION_HELP = ('Enable APPLE or its launcher in System Settings → Privacy & Security → Accessibility, '
                   'then restart APPLE. I could not control the app.')
SHELL_APPS = {'com.apple.Terminal', 'com.googlecode.iterm2', 'com.apple.ScriptEditor2',
              'com.apple.Automator', 'com.mitchellh.ghostty', 'dev.warp.Warp-Stable'}
EDIT_ROLES = {'AXTextField', 'AXTextArea', 'AXSearchField', 'AXComboBox'}
CLICK_ROLES = {'AXButton', 'AXCheckBox', 'AXRadioButton', 'AXMenuItem', 'AXPopUpButton',
               'AXTab', 'AXLink', 'AXDisclosureTriangle', 'AXRow', 'AXCell'}


async def call_bridge(process, operation, **kwargs):
    try:
        result = await process('osascript', '-l', 'JavaScript', str(BRIDGE),
                               json.dumps({'operation': operation, **kwargs}), timeout=6)
        return json.loads(result)
    except RuntimeError as exc:
        if 'APPLE_ACCESSIBILITY_REQUIRED' in str(exc) or 'assistive access' in str(exc):
            raise PermissionError(PERMISSION_HELP) from exc
        message = str(exc).split('Error: ')[-1].removesuffix(' (-2700)').strip()
        raise RuntimeError(message) from exc


async def permissions_status(process):
    try:
        return await call_bridge(process, 'permissions')
    except Exception:
        return {'accessibility': False, 'checked': False}


def public_controls(snapshot):
    result = []
    for item in snapshot.get('controls', []):
        if item.get('subrole') == 'AXSecureTextField':
            continue
        if item['role'] not in EDIT_ROLES | CLICK_ROLES | {'AXStaticText', 'AXHeading'}:
            continue
        label = item.get('title') or item.get('description') or item.get('placeholder') or item.get('identifier')
        if not label and item['role'] not in EDIT_ROLES:
            continue
        result.append({'label': str(label)[:200], 'role': item['role'], 'identifier': item.get('identifier', ''),
                       'value': str(item.get('value', ''))[:300], 'enabled': item.get('enabled', True)})
        if len(result) >= 80:
            break
    return result


def select_control(controls, query, roles):
    if not query.strip():
        raise ValueError('Name the exact visible control or inspect the app first.')
    key = app_key(query)
    matches = [n for n in controls if n.get('enabled', True) and n['role'] in roles
               and n.get('subrole') != 'AXSecureTextField'
               and any(app_key(n.get(field, '')) == key for field in ('identifier', 'title', 'description', 'placeholder'))]
    # A stable Accessibility identifier is more specific than duplicated labels.
    ids = [n for n in matches if n.get('identifier') == query]
    if len(ids) == 1:
        return ids[0]
    if len(matches) != 1:
        if len(matches) > 1:
            raise ValueError(f'More than one “{query}” control is visible. Use its exact identifier from Inspect app.')
        raise ValueError(f'I could not find an enabled “{query}” control in this app. Inspect the app to see available controls.')
    return matches[0]


def safe_control(app, control, operation):
    if app.bundle_id in SHELL_APPS:
        raise ValueError('Opening and inspecting this app is supported. Running shell commands or scripts through UI automation is not supported.')
    label = ' '.join(str(control.get(k, '')) for k in ('title', 'description', 'identifier', 'placeholder'))
    if re.search(r'\b(terminal|shell|command palette|execute script|run script|console)\b', label, re.I):
        raise ValueError('Command and script execution controls are not supported by desktop automation.')
    if app.bundle_id == 'net.whatsapp.WhatsApp' and (
        control.get('identifier') in {'ChatBar_ComposerTextView', 'ChatBar_SendButton'}
        or app_key(label) in {'send', 'sendmessage'}
    ):
        raise ValueError('Use “send [message] to [contact] on WhatsApp” so I can verify the recipient and preserve existing drafts.')


async def desktop_action(action, process):
    if action.action == 'list_apps':
        apps = installed_apps()
        query = app_key(action.target)
        if query not in {'all', 'apps', 'applications', 'installed', 'myapps'}:
            apps = [a for a in apps if query in app_key(a.name)]
        return {'message': f'{len(apps)} installed applications found: ' + ', '.join(a.name for a in apps[:40]) + '.',
                'apps': [app.public() for app in apps]}
    app = await open_installed(action.target, process)
    await asyncio.sleep(.12)
    if not app.bundle_id:
        raise ValueError(f'{app.name} opened, but it has no bundle identifier for native control.')
    if action.action == 'search_app':
        if not action.message.strip() or any(ord(c) < 32 for c in action.message):
            raise ValueError('Give me a single-line search query.')
        if app.bundle_id in SHELL_APPS:
            raise ValueError('Searching inside command execution apps is not supported.')
        if app.bundle_id == 'net.whatsapp.WhatsApp':
            from whatsapp_native import NativeAX, search_field
            pids = await process('pgrep', '-x', 'WhatsApp')
            ax = NativeAX(int(pids.splitlines()[0]), process)
            await ax.show_search()
            await ax.set_value(search_field(await ax.snapshot()), action.message)
        else:
            await call_bridge(process, 'show_search', bundle_id=app.bundle_id)
            await asyncio.sleep(.15)
            current = await call_bridge(process, 'inspect', bundle_id=app.bundle_id)
            candidates = [n for n in current['controls'] if n.get('enabled', True)
                          and n['role'] in EDIT_ROLES and n.get('subrole') != 'AXSecureTextField'
                          and re.search(r'search|find', ' '.join(n.get(k, '') for k in ('title', 'description', 'identifier', 'placeholder')), re.I)]
            if len(candidates) != 1:
                raise ValueError('I could not identify one Search field. Open the app’s search view, then try again.')
            safe_control(app, candidates[0], 'set_value')
            await call_bridge(process, 'set_value', bundle_id=app.bundle_id, node=candidates[0], value=action.message)
        await asyncio.sleep(.2)
        current = await call_bridge(process, 'inspect', bundle_id=app.bundle_id)
        return {'message': f'Searched {app.name} for “{action.message}”.', 'controls': public_controls(current), 'app': app.name}
    snapshot = await call_bridge(process, 'inspect', bundle_id=app.bundle_id)
    if action.action == 'inspect_app':
        controls = public_controls(snapshot)
        return {'message': f'{app.name} is open. I can see {len(controls)} named controls in its current window.',
                'controls': controls, 'app': app.name, 'window': snapshot.get('window', '')}
    if action.action == 'click_control':
        control = select_control(snapshot['controls'], getattr(action, 'control', '') or action.message, CLICK_ROLES)
        safe_control(app, control, 'press')
        await call_bridge(process, 'press', bundle_id=app.bundle_id, node=control)
        return {'message': f'Activated {action.control or action.message} in {app.name}.'}
    if action.action == 'set_field':
        control = select_control(snapshot['controls'], action.control, EDIT_ROLES)
        safe_control(app, control, 'set_value')
        await call_bridge(process, 'set_value', bundle_id=app.bundle_id, node=control, value=action.message)
        return {'message': f'Filled {action.control} in {app.name}. Text was not submitted.'}
    raise ValueError('Unsupported native desktop action.')
