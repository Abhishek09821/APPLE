"""Bounded, fail-closed control of the installed macOS WhatsApp application.

Uses Apple's Accessibility API through a static JXA bridge (no browser profile,
clipboard, generated scripts, or coordinates). Unrecognised app layouts stop before
typing. Sending still requires the approval enforced by main.run_plan.
"""
import asyncio
import json
from pathlib import Path
import re
import unicodedata
from dataclasses import dataclass, field

BUNDLE_ID = 'net.whatsapp.WhatsApp'
ACCESSIBILITY_HELP = (
    'WhatsApp is open, but APPLE needs Accessibility access to select a chat. '
    'In System Settings → Privacy & Security → Accessibility, enable APPLE '
    'or the app that starts it (Codex or Terminal), then restart APPLE. No message was sent.'
)


class SendControlUnavailable(ValueError):
    """The composer may still be updating its native Send/voice controls."""


def normalise(value):
    text = ''.join(c for c in str(value or '') if unicodedata.category(c) != 'Cf')
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def contact_key(value):
    """Compare spoken names without decorative emoji; keep letters and digits."""
    return ' '.join(''.join(c if c.isalnum() or c.isspace() else ' ' for c in normalise(value)).split())


def phone_number(contact):
    """Only explicit international numbers, never infer a country code."""
    if re.fullmatch(r'\+?[1-9][0-9 ()\-]{6,22}', contact):
        digits = re.sub(r'\D', '', contact)
        if 8 <= len(digits) <= 15:
            return digits
    return None


@dataclass
class Node:
    handle: int
    role: str = ''
    title: str = ''
    description: str = ''
    value: str = ''
    placeholder: str = ''
    identifier: str = ''
    selected: bool = False
    enabled: bool = True
    children: list = field(default_factory=list)
    parent: object = field(default=None, repr=False)

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def ancestors(self):
        node = self.parent
        while node:
            yield node
            node = node.parent

    def labels(self):
        return [normalise(v) for v in (self.title, self.description, self.value) if v]


def unique(nodes, reason):
    found = {node.handle: node for node in nodes}
    if len(found) != 1:
        raise ValueError(reason)
    return next(iter(found.values()))


def search_field(tree):
    return unique([
        n for n in tree.walk()
        if n.enabled and (n.identifier in {'TokenizedSearchBar_TextView', 'PickerView_SearchBar'} or (
            n.role in {'AXTextField', 'AXSearchField', 'AXComboBox'}
            and any('search' in normalise(v) for v in (n.description, n.title, n.placeholder, n.identifier))))
    ], 'I could not identify WhatsApp’s chat search. Open its Chats tab, sign in if needed, and try again. No message was sent.')


def message_field(tree):
    return unique([
        n for n in tree.walk()
        if n.role in {'AXTextArea', 'AXTextField'} and n.enabled
        and (n.identifier == 'ChatBar_ComposerTextView' or any(re.search(r'\b(type a message|message input|message field|message composer)\b', normalise(v))
                for v in (n.description, n.title, n.placeholder, n.identifier)))
    ], 'I could not verify WhatsApp’s message field. Open the requested chat in WhatsApp and try again. No message was sent.')


def chat_region(tree, search):
    """The nearest search ancestor containing results and no message composer."""
    for node in search.ancestors():
        descendants = list(node.walk())
        has_results = any(n.role in {'AXTable', 'AXOutline', 'AXList'} or n.identifier == 'ChatListView_TableView'
                          or normalise(n.description) == 'search results' for n in descendants)
        has_composer = any(n.role == 'AXTextArea' for n in descendants)
        if has_results and not has_composer:
            return node
    raise ValueError('WhatsApp’s chat list could not be identified safely. No message was sent.')


def exact_chat(tree, contact):
    native_candidates = []
    for node in tree.walk():
        if node.identifier == 'PickerView_ContactCell' and node.role == 'AXStaticText':
            name = node.title or node.description
            if name:
                native_candidates.append((node, name))
        elif node.identifier in {'ChatListSearchView_ChatResult', 'ChatListSearchView_ContactResult'} and node.role == 'AXButton':
            name = node.title or node.description
            if name:
                native_candidates.append((node, name))
    if native_candidates or any(n.identifier == 'PickerView_SearchBar' for n in tree.walk()):
        query = contact_key(contact)
        exact = [(n, name) for n, name in native_candidates if contact_key(name) == query]
        # Spoken first names may resolve to one saved full name. Only consider
        # real contact rows; never navigation filters, authors, or message text.
        matches = exact or [(n, name) for n, name in native_candidates
                            if len(query) >= 2 and re.match(re.escape(query) + r'(?:\s|$)', contact_key(name))]
        if len(matches) == 1:
            return matches[0][0]
        if len(matches) > 1:
            names = list(dict.fromkeys(name for _, name in matches))[:5]
            raise ValueError('I found more than one matching WhatsApp contact: ' + ', '.join(names) + '. Say the full contact name. No message was sent.')
        names = list(dict.fromkeys(name for _, name in native_candidates))[:3]
        suggestion = ' Search results include ' + ', '.join(names) + '. Say the full contact name.' if names else ' Check the saved name or use their international phone number.'
        raise ValueError(f'I could not find a WhatsApp contact matching “{contact}”.' + suggestion + ' No message was sent.')
    region = chat_region(tree, search_field(tree))
    candidates = []
    for node in region.walk():
        if normalise(contact) not in node.labels():
            continue
        # Never interpret matching message text or the search field as a contact.
        if node.role not in {'AXStaticText', 'AXButton', 'AXRow', 'AXCell'}:
            continue
        if node.role == 'AXButton' and not node.identifier and any(normalise(p.description) == 'search results' for p in node.ancestors()):
            candidates.append(node)
            continue
        ancestry = (node, *node.ancestors())
        row = next((p for p in ancestry if p.role == 'AXRow'), None)
        row = row or next((p for p in ancestry if p.role == 'AXCell'), None)
        if row and any(p.role in {'AXTable', 'AXOutline', 'AXList'} for p in row.ancestors()):
            candidates.append(row)
    return unique(candidates, f'I need one exact WhatsApp contact named “{contact}”. Use the full, unique saved name. No message was sent.')


def verified_header(tree, contact):
    """Require an exact recipient outside both the chat list and message rows."""
    if any(n.role == 'AXSheet' for n in tree.walk()):
        raise ValueError('Close the WhatsApp dialog before sending. No message was sent.')
    composer = message_field(tree)
    native_headers = [n for n in tree.walk() if n.identifier == 'NavigationBar_HeaderViewButton']
    if native_headers:
        header = unique(native_headers, 'WhatsApp’s recipient header is ambiguous. No message was sent.')
        number = phone_number(contact)
        matches = normalise(contact) in header.labels() or (number and any(phone_number(v) == number for v in header.labels()))
        if not matches:
            raise ValueError('I could not verify the selected WhatsApp recipient. No message was sent.')
        return composer
    search = search_field(tree)
    sidebar = chat_region(tree, search)
    sidebar_ids = {n.handle for n in sidebar.walk()}
    candidates = []
    for node in tree.walk():
        if node.handle in sidebar_ids or node.role not in {'AXStaticText', 'AXButton', 'AXHeading'}:
            continue
        matches = normalise(contact) in node.labels()
        number = phone_number(contact)
        if number:
            matches = any(phone_number(v) == number for v in (node.title, node.description, node.value))
        if not matches or any(p.role in {'AXRow', 'AXCell', 'AXTable', 'AXList', 'AXOutline'} for p in node.ancestors()):
            continue
        # A title must share a content pane with the composer, excluding the window.
        shared = {p.handle for p in composer.ancestors() if p.role not in {'AXWindow', 'AXApplication'}}
        if any(p.handle in shared for p in node.ancestors()):
            candidates.append(node)
    unique(candidates, 'I could not verify the selected WhatsApp recipient. Use the exact saved contact name. No message was sent.')
    return composer


def verified_recipient(tree, contact, expected_name=''):
    try:
        return verified_header(tree, contact)
    except ValueError:
        if expected_name:
            return verified_header(tree, expected_name)
        raise


def send_button(tree, composer):
    for pane in composer.ancestors():
        if pane.role in {'AXWindow', 'AXApplication'}:
            break
        candidates = [n for n in pane.walk() if n.role == 'AXButton' and n.enabled
                      and (n.identifier == 'ChatBar_SendButton' or any(v in {'send', 'send message'} for v in n.labels()))]
        if candidates:
            return unique(candidates, 'WhatsApp’s Send button is ambiguous. The message remains a draft.')
    raise SendControlUnavailable('WhatsApp’s Send button could not be verified. The message remains a draft.')


async def ready_to_send(ax, contact, message, expected_name=''):
    """Wait for a visible Send control while continuously rechecking the draft."""
    for attempt in range(6):
        tree = await ax.snapshot()
        composer = verified_recipient(tree, contact, expected_name)
        if composer.value != message:
            raise ValueError('WhatsApp’s draft does not match the approved message. Check the draft; nothing was sent.')
        try:
            return send_button(tree, composer)
        except SendControlUnavailable:
            if attempt == 5:
                raise
            await asyncio.sleep(.06)


def outgoing_messages(tree, message):
    """Count explicit outgoing bubbles; a cleared composer alone is not proof."""
    matches = set()
    for node in tree.walk():
        if node.identifier == 'WAMessageBubbleTableViewCell':
            # WhatsApp 26.x: "Your message, <text>, <time>, Sent to <name>, <status>".
            # Incoming bubbles instead start "message" and say "Received from".
            label = ''.join(c for c in node.description if unicodedata.category(c) != 'Cf')
            prefix = 'Your message, '
            if label.startswith(prefix + message + ',') and re.search(r',\s*Sent to [^,]+,', label):
                matches.add(node.handle)
            continue
        if message not in (node.value, node.title, node.description):
            continue
        bubble = next((p for p in (node, *node.ancestors()) if p.role in {'AXRow', 'AXCell'}), None)
        if bubble and any(re.search(r'\b(outgoing|sent by you|you said|you sent|delivered|sent message)\b', label)
                          for n in bubble.walk() for label in n.labels()):
            matches.add(bubble.handle)
    return len(matches)


class NativeAX:
    """Async JXA bridge uses the launcher's granted macOS Accessibility access."""
    def __init__(self, pid, process):
        self.pid, self.process = pid, process
        self.contact = ''
        self.expected_name = ''

    async def call(self, operation, **kwargs):
        try:
            result = await self.process('osascript', '-l', 'JavaScript', str(Path(__file__).with_name('whatsapp_ax.js')),
                                        str(self.pid), json.dumps({'operation': operation, **kwargs}), timeout=5)
            return json.loads(result)
        except RuntimeError as exc:
            if 'APPLE_ACCESSIBILITY_REQUIRED' in str(exc) or 'assistive access' in str(exc):
                raise PermissionError(ACCESSIBILITY_HELP) from exc
            raise

    async def snapshot(self):
        def build(data, parent=None):
            children = data.pop('children', [])
            node = Node(**data, parent=parent)
            node.children = [build(child, node) for child in children]
            return node
        return build(await self.call('snapshot'))

    async def show_search(self):
        await self.call('show_search')

    async def show_contacts(self):
        await self.call('show_contacts')

    async def close_contacts(self):
        await self.call('close_contacts')

    def data(self, node):
        return {key: getattr(node, key) for key in ('handle', 'role', 'identifier', 'title', 'description', 'value')}

    async def set_value(self, node, value):
        operation = 'type_composer' if node.identifier == 'ChatBar_ComposerTextView' else 'set_value'
        await self.call(operation, node=self.data(node), value=value,
                        contact=self.contact if node.identifier == 'ChatBar_ComposerTextView' else '',
                        expected_name=self.expected_name if node.identifier == 'ChatBar_ComposerTextView' else '')

    async def press(self, node, *, draft=None):
        extra = {'draft': draft, 'contact': self.contact, 'expected_name': self.expected_name} if draft is not None else {}
        await self.call('press', node=self.data(node), **extra)


async def native_chat(ax, contact, message, send, *, phone=False, expected_name=''):
    if send and any(ord(c) < 32 or c in '\x7f\u2028\u2029' for c in message):
        raise ValueError('Use a single-line WhatsApp message. No message was sent.')
    if not phone:
        using_picker = hasattr(ax, 'show_contacts')
        if using_picker:
            await ax.show_contacts()
        elif hasattr(ax, 'show_search'):
            await ax.show_search()
        await ax.set_value(search_field(await ax.snapshot()), contact_key(contact))
        await asyncio.sleep(0.35)
        # Wait briefly for native search; never spend 90 seconds on a browser login.
        row = None
        for attempt in range(6):
            try:
                row = exact_chat(await ax.snapshot(), contact)
                break
            except ValueError:
                if attempt == 5:
                    if using_picker:
                        await ax.close_contacts()
                    raise
                await asyncio.sleep(0.2)
        await ax.press(row)
        await asyncio.sleep(0.2)
        if row.identifier in {'PickerView_ContactCell', 'ChatListSearchView_ChatResult', 'ChatListSearchView_ContactResult'}:
            contact = row.title or row.description
            ax.contact = contact
    for attempt in range(4 if phone else 1):
        tree = await ax.snapshot()
        try:
            composer = verified_recipient(tree, contact, expected_name)
            break
        except ValueError:
            if attempt == (3 if phone else 0):
                raise
            await asyncio.sleep(.2)
    if not send:
        return {'message': f'Opened {expected_name or contact} in the WhatsApp app.'}
    if composer.value and composer.value != message:
        raise ValueError('This WhatsApp chat already has a draft. Clear or send it in WhatsApp before trying again. No message was sent.')
    before = outgoing_messages(tree, message)
    # Recheck recipient and draft immediately before modifying the selected field.
    composer = verified_recipient(await ax.snapshot(), contact, expected_name)
    if composer.value and composer.value != message:
        raise ValueError('A WhatsApp draft appeared. I left it untouched. No message was sent.')
    await ax.set_value(composer, message)
    await ready_to_send(ax, contact, message, expected_name)
    # Yield before the single irreversible action so Stop can cancel it.
    await asyncio.sleep(0)
    button = await ready_to_send(ax, contact, message, expected_name)
    await ax.press(button, draft=message)
    for _ in range(10):
        await asyncio.sleep(0.25)
        try:
            tree = await ax.snapshot()
            current = verified_recipient(tree, contact, expected_name)
        except (ValueError, RuntimeError, PermissionError, asyncio.TimeoutError):
            break
        if not current.value and outgoing_messages(tree, message) > before:
            return {'message': f'WhatsApp displayed an outgoing message to {expected_name or contact}. Delivery is not yet verified.'}
    raise RuntimeError('I pressed Send in WhatsApp, but could not verify an outgoing message. Check the chat before retrying to avoid a duplicate.')


async def whatsapp(contact, message, send, process, *, expected_name=''):
    contact = contact.strip()
    if len(contact) > 120 or any(unicodedata.category(c) == 'Cc' for c in contact):
        raise ValueError('Use a single contact name or international phone number, without line breaks or control characters.')
    if send and (not contact or not message.strip()):
        raise ValueError('A WhatsApp recipient and message are required.')
    try:
        await process('open', '-b', BUNDLE_ID)
    except RuntimeError as exc:
        raise RuntimeError('Install and sign in to the WhatsApp Mac app, then try again. No message was sent.') from exc
    if not contact:
        return {'message': 'Opened the WhatsApp app.'}
    number = phone_number(contact)
    expected_name = expected_name.strip() if number else ''
    if number and not send and not expected_name:
        # Do not prefill text: this must never replace an existing chat draft.
        await process('open', '-b', BUNDLE_ID, f'whatsapp://send?phone={number}')
        return {'message': f'Opened WhatsApp for +{number}. Check the chat in the app.'}
    await asyncio.sleep(0.2)
    # Verify the process belongs to WhatsApp.app, never an unrelated same-name app.
    candidates = await process('pgrep', '-x', 'WhatsApp')
    pid = None
    for value in candidates.splitlines():
        if value.isdigit():
            path = await process('ps', '-p', value, '-o', 'comm=')
            if path.endswith('/WhatsApp.app/Contents/MacOS/WhatsApp'):
                pid = int(value)
                break
    if pid is None:
        raise RuntimeError('WhatsApp is still opening. Wait until its Chats screen appears, then try again. No message was sent.')
    ax = NativeAX(pid, process)
    ax.contact = contact
    ax.expected_name = expected_name.strip()
    if number:
        await ax.close_contacts()
        await process('open', '-b', BUNDLE_ID, f'whatsapp://send?phone={number}')
        await asyncio.sleep(.15)
    return await native_chat(ax, contact, message, send, phone=bool(number), expected_name=ax.expected_name)
