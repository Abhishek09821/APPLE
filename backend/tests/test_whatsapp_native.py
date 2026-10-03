"""Recipient/draft/send boundary tests. Never controls or sends to a real chat."""
import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import whatsapp_native as native
import executor
from models import Action


def ui(*, contact='Rahul', draft='', duplicates=False, outgoing=False, incoming=False):
    def group(handle, role, *children, **kwargs):
        parent = native.Node(handle, role, children=list(children), **kwargs)
        for child in children:
            child.parent = parent
        return parent
    rows = [group(4, 'AXRow', native.Node(5, 'AXStaticText', value='Rahul'))]
    if duplicates:
        rows.append(group(14, 'AXRow', native.Node(15, 'AXStaticText', value='Rahul')))
    sidebar = group(2, 'AXGroup',
                    native.Node(3, 'AXTextField', description='Search or start new chat'),
                    group(6, 'AXTable', *rows))
    bubbles = []
    if outgoing or incoming:
        bubbles.append(group(20, 'AXRow', native.Node(21, 'AXStaticText', value='Hi!'),
                             description='You sent' if outgoing else 'Received from Rahul'))
    pane = group(7, 'AXGroup', native.Node(8, 'AXButton', title=contact),
                 group(19, 'AXList', *bubbles),
                 native.Node(9, 'AXTextArea', value=draft, placeholder='Type a message'),
                 native.Node(10, 'AXButton', description='Send'))
    return group(1, 'AXWindow', sidebar, pane)


class FakeAX:
    def __init__(self, *, draft='', contact='Rahul', duplicates=False,
                 switch_on_type=False, confirmed=True):
        self.draft, self.contact, self.duplicates = draft, contact, duplicates
        self.switch_on_type, self.confirmed = switch_on_type, confirmed
        self.sent = False
        self.presses, self.writes = [], []

    async def snapshot(self):
        return ui(contact=self.contact, draft=self.draft, duplicates=self.duplicates,
                  outgoing=self.sent and self.confirmed)

    async def set_value(self, node, value):
        self.writes.append((node.handle, value))
        if node.handle == 9:
            self.draft = value
            if self.switch_on_type:
                self.contact = 'Different Person'

    async def press(self, node, *, draft=None):
        self.presses.append(node.handle)
        if node.handle == 10:
            self.sent = True
            self.draft = ''


class NativeWhatsAppTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sleep = patch.object(native.asyncio, 'sleep', AsyncMock())
        self.sleep.start()

    async def asyncTearDown(self):
        self.sleep.stop()

    async def test_open_whatsapp_uses_installed_bundle_and_no_accessibility(self):
        process = AsyncMock(return_value='')
        with patch.object(native, 'NativeAX') as ax, patch.object(executor, 'process', process):
            result = await executor._execute(Action(action='open_app', target='whatsapp'))
        process.assert_awaited_once_with('open', '-b', native.BUNDLE_ID)
        ax.assert_not_called()
        self.assertIn('WhatsApp app', result['message'])

    async def test_phone_open_does_not_prefill_or_send_a_message(self):
        process = AsyncMock(return_value='')
        result = await native.whatsapp('+91 98765 43210', 'Do not type this', False, process)
        self.assertEqual(process.call_args.args,
                         ('open', '-b', native.BUNDLE_ID, 'whatsapp://send?phone=919876543210'))
        self.assertIn('Check the chat', result['message'])

    async def test_missing_permission_is_actionable_and_never_opens_browser(self):
        process = AsyncMock(side_effect=['', '123', '/Applications/WhatsApp.app/Contents/MacOS/WhatsApp'])
        with patch.object(native, 'NativeAX', side_effect=PermissionError(native.ACCESSIBILITY_HELP)):
            with self.assertRaisesRegex(PermissionError, 'Accessibility'):
                await native.whatsapp('Rahul', 'Hi!', True, process)
        self.assertFalse(any('http' in str(call) for call in process.call_args_list))

    async def test_bridge_permission_error_explains_system_setting(self):
        process = AsyncMock(side_effect=RuntimeError('APPLE_ACCESSIBILITY_REQUIRED'))
        with self.assertRaisesRegex(PermissionError, 'Privacy & Security'):
            await native.NativeAX(123, process).snapshot()

    async def test_native_open_selects_exact_recipient_without_typing_message(self):
        ax = FakeAX()
        result = await native.native_chat(ax, 'Rahul', '', False)
        self.assertEqual(ax.presses, [4])
        self.assertEqual(ax.writes, [(3, 'Rahul')])
        self.assertEqual(result['message'], 'Opened Rahul in the WhatsApp app.')

    async def test_duplicate_contacts_never_open_or_send(self):
        ax = FakeAX(duplicates=True)
        with self.assertRaisesRegex(ValueError, 'exact WhatsApp contact'):
            await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertEqual(ax.presses, [])
        self.assertFalse(any(handle == 9 for handle, _ in ax.writes))

    async def test_partial_name_does_not_match(self):
        ax = FakeAX()
        with self.assertRaisesRegex(ValueError, 'exact WhatsApp contact'):
            await native.native_chat(ax, 'Rah', 'Hi!', True)
        self.assertEqual(ax.presses, [])

    async def test_existing_draft_is_not_overwritten_or_sent(self):
        ax = FakeAX(draft='My unfinished message')
        with self.assertRaisesRegex(ValueError, 'already has a draft'):
            await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertEqual(ax.draft, 'My unfinished message')
        self.assertFalse(ax.sent)

    async def test_recipient_change_after_typing_prevents_send(self):
        ax = FakeAX(switch_on_type=True)
        with self.assertRaisesRegex(ValueError, 'selected WhatsApp recipient'):
            await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertFalse(ax.sent)
        self.assertNotIn(10, ax.presses)

    async def test_send_requires_outgoing_message_and_empty_composer(self):
        ax = FakeAX()
        result = await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertEqual(ax.presses.count(10), 1)
        self.assertIn('outgoing message', result['message'])
        self.assertIn('not yet verified', result['message'])

    async def test_cleared_composer_alone_does_not_report_success_or_retry(self):
        ax = FakeAX(confirmed=False)
        with self.assertRaisesRegex(RuntimeError, 'avoid a duplicate'):
            await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertEqual(ax.presses.count(10), 1)

    async def test_stop_before_send_leaves_draft_without_sending(self):
        ax = FakeAX()
        async def sleep(delay):
            if delay == 0:
                raise asyncio.CancelledError()
        with patch.object(native.asyncio, 'sleep', sleep):
            with self.assertRaises(asyncio.CancelledError):
                await native.native_chat(ax, 'Rahul', 'Hi!', True)
        self.assertFalse(ax.sent)
        self.assertEqual(ax.draft, 'Hi!')

    async def test_incoming_matching_message_is_not_outgoing_evidence(self):
        self.assertEqual(native.outgoing_messages(ui(incoming=True), 'Hi!'), 0)
        self.assertEqual(native.outgoing_messages(ui(outgoing=True), 'Hi!'), 1)

    async def test_installed_whatsapp_bubble_format_requires_outgoing_direction(self):
        tree = native.Node(1, 'AXGroup', children=[
            native.Node(2, 'AXStaticText', identifier='WAMessageBubbleTableViewCell',
                        description='\u200eYour message, \u200eHi!, 5:30 PM, \u200eSent to Rahul, \u200eRead'),
            native.Node(3, 'AXStaticText', identifier='WAMessageBubbleTableViewCell',
                        description='\u200emessage, \u200eHi!, 5:30 PM, \u200eReceived from Rahul'),
        ])
        self.assertEqual(native.outgoing_messages(tree, 'Hi!'), 1)
        self.assertEqual(native.outgoing_messages(tree, 'Hi'), 0)

    async def test_installed_whatsapp_identifiers_and_direction_marks(self):
        tree = ui()
        header = next(n for n in tree.walk() if n.handle == 8)
        header.identifier = 'NavigationBar_HeaderViewButton'
        header.title = '\u200eRahul'
        composer = next(n for n in tree.walk() if n.handle == 9)
        composer.identifier = 'ChatBar_ComposerTextView'
        composer.placeholder = ''
        self.assertEqual(native.verified_header(tree, 'Rahul').handle, 9)

    async def test_message_body_named_like_contact_cannot_verify_wrong_header(self):
        tree = ui(contact='Different Person')
        transcript = next(n for n in tree.walk() if n.handle == 19)
        message = native.Node(40, 'AXStaticText', value='Rahul', parent=transcript)
        transcript.children.append(message)
        with self.assertRaisesRegex(ValueError, 'selected WhatsApp recipient'):
            native.verified_header(tree, 'Rahul')

    async def test_phone_does_not_guess_a_country_code_or_accept_url_injection(self):
        self.assertEqual(native.phone_number('+91 (98765) 43210'), '919876543210')
        self.assertIsNone(native.phone_number('09876543210'))
        self.assertIsNone(native.phone_number('+919876543210&text=oops'))
        self.assertIsNone(native.phone_number('Rahul'))

    async def test_search_contact_cannot_inject_enter_or_other_controls(self):
        process = AsyncMock()
        with self.assertRaisesRegex(ValueError, 'control characters'):
            await native.whatsapp('Rahul\nSend this', 'Hi!', True, process)
        process.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
