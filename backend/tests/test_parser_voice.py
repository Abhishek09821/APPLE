"""Voice command routing: fast local plans must preserve intent and recipients."""
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ai_parser
from models import Plan


class SpokenCommandTests(unittest.TestCase):
    def assert_send(self, command, recipient, message):
        plan = ai_parser.basic_plan(command)
        self.assertIsNotNone(plan, command)
        self.assertEqual(len(plan.actions), 1, command)
        self.assertEqual(plan.actions[0].model_dump(include={'action', 'target', 'message'}), {
            'action': 'whatsapp_send', 'target': recipient, 'message': message,
        })

    def test_natural_whatsapp_message_forms(self):
        commands = [
            'send hii to Rahul',
            'send hii too Rahul',
            'send hii to Rahul on WhatsApp.',
            'Hey Apple, can you please send hii to Rahul on WhatsApp?',
            'send hii to Rahul on WhatsApp, please.',
            'send Rahul a message saying hii',
            'send a message to Rahul saying hii',
            'send a WhatsApp message to Rahul saying hii',
            'send a message saying hii to Rahul',
            'message Rahul saying hii',
            'WhatsApp Rahul: hii',
        ]
        for command in commands:
            with self.subTest(command=command):
                self.assert_send(command, 'Rahul', 'hii')

    def test_literal_message_content_is_preserved(self):
        for command, message in [
            ('WhatsApp Rahul Mehta: Meet at 7:30 PM! https://example.com/a?x=1&b=2 😊',
             'Meet at 7:30 PM! https://example.com/a?x=1&b=2 😊'),
            ('send "I want to go to the park!" to Rahul Mehta on WhatsApp', 'I want to go to the park!'),
            ('send Rahul Mehta a message saying Call me on WhatsApp.', 'Call me on WhatsApp.'),
            ('message Rahul Mehta saying Visit https://example.com/a?x=1&b=2 😊', 'Visit https://example.com/a?x=1&b=2 😊'),
            ('message Rahul Mehta saying Join me on Telegram', 'Join me on Telegram'),
            ('send "Open Notes and then send a message" to Rahul Mehta', 'Open Notes and then send a message'),
            ('WhatsApp Rahul Mehta: Open Notes and then send a message', 'Open Notes and then send a message'),
        ]:
            with self.subTest(command=command):
                self.assert_send(command, 'Rahul Mehta', message)

    def test_open_exact_whatsapp_chat(self):
        for command in ['open Rahul chat in WhatsApp', "open Rahul's chat on WhatsApp.",
                        'open Rahul’s chat in WhatsApp', 'open WhatsApp chat with Rahul',
                        'could you open chat with Rahul on WhatsApp?', 'open Rahul on WhatsApp',
                        'open Rahul chat in WhatsApp, please.']:
            with self.subTest(command=command):
                plan = ai_parser.basic_plan(command)
                self.assertEqual([(a.action, a.target) for a in plan.actions], [('whatsapp_open', 'Rahul')])

    def test_missing_or_ambiguous_message_details_do_not_run_actions(self):
        commands = [
            'send hii', 'send a message', 'message', 'send hi to him',
            'send hi to someone', 'send a message to Rahul on WhatsApp',
            'send Rahul a message', 'WhatsApp Rahul:', 'message Rahul',
            'open chat in WhatsApp', 'send hi to Rahul and Priya',
            'send hi to Rahul and open Notes', 'send hi to Rahul then search football',
            'send I want to go to Rahul', 'send this to Rahul',
            'send a photo to Rahul',
        ]
        for command in commands:
            with self.subTest(command=command):
                plan = ai_parser.basic_plan(command)
                self.assertIsNotNone(plan)
                self.assertEqual(plan.actions, [])
                self.assertTrue(plan.reply)

    def test_other_services_are_not_routed_to_whatsapp(self):
        for command in ['send hi to Rahul on Telegram', 'send an email to Rahul',
                        'send an SMS to Rahul', 'send me a summary',
                        'My friend said open Chrome']:
            with self.subTest(command=command):
                self.assertIsNone(ai_parser.basic_plan(command))

    def test_common_apps_and_search_need_no_model(self):
        for command, action, target in [
            ('Apple, please open WhatsApp.', 'open_app', 'WhatsApp'),
            ('Could you launch Notes?', 'open_app', 'Notes'),
            ('Open https://example.com', 'open_website', 'https://example.com'),
            ('Search YouTube for piano music', 'youtube_search', 'piano music'),
            ('Please search for orbital mechanics', 'google_search', 'orbital mechanics'),
            ('Learn ~/Documents/notes.pdf', 'learn_document', '~/Documents/notes.pdf'),
        ]:
            with self.subTest(command=command):
                plan = ai_parser.basic_plan(command)
                self.assertEqual([(a.action, a.target) for a in plan.actions], [(action, target)])
        self.assertIsNone(ai_parser.basic_plan('Open Notes and then send my passwords'))
        self.assertIsNone(ai_parser.basic_plan('Search cats then open Notes'))

    def test_explicit_app_click_and_search_routes_preserve_control_names(self):
        for command, target, control in [('click the plus button in Calculator', 'Calculator', 'the plus button'),
                                         ('press = in Calculator', 'Calculator', '='),
                                         ('tap Action button in Notes', 'Notes', 'Action button')]:
            with self.subTest(command=command):
                action = ai_parser.basic_plan(command).actions[0]
                self.assertEqual((action.action, action.target, action.control), ('click_control', target, control))
        action = ai_parser.basic_plan('Search Mozart on Spotify').actions[0]
        self.assertEqual((action.action, action.target, action.message), ('search_app', 'Spotify', 'Mozart'))
        self.assertIsNone(ai_parser.basic_plan('Click Add in Calculator and then open Notes'))
        for key, expected in [('Return', 'enter'), ('Tab', 'tab'), ('Esc', 'escape')]:
            action = ai_parser.basic_plan(f'Press the {key} key in Notes').actions[0]
            self.assertEqual((action.action, action.target, action.message), ('press_key', 'Notes', expected))


class LocalPlannerTests(unittest.IsolatedAsyncioTestCase):
    async def test_commands_and_greetings_skip_model_and_history(self):
        with patch.object(ai_parser, 'generate', AsyncMock()) as model, \
             patch.object(ai_parser, 'list_records') as history:
            for command in ['hii', 'Hey Apple', 'Thank you!', 'open WhatsApp',
                            'send hii to Rahul', 'open Rahul chat in WhatsApp']:
                self.assertIsInstance(await ai_parser.parse_command(command), Plan)
        model.assert_not_awaited()
        history.assert_not_called()

    async def test_unsupported_model_action_is_rejected(self):
        raw = json.dumps({'reply': 'Working', 'actions': [{'action': 'shell', 'target': 'anything'}]})
        with patch.object(ai_parser, 'generate', AsyncMock(return_value=raw)), \
             patch.object(ai_parser, 'list_records', return_value=[]):
            with self.assertRaises(ai_parser.ModelUnavailable):
                await ai_parser.parse_command('Do something complex')

    async def test_qwen_request_disables_hidden_thinking_and_keeps_schema(self):
        response = httpx.Response(200, json={'message': {'content': '{"reply":"Ready","actions":[]}'}},
                                  request=httpx.Request('POST', 'http://127.0.0.1:11434/api/chat'))
        client = AsyncMock()
        client.post.return_value = response
        context = AsyncMock()
        context.__aenter__.return_value = client
        with patch.object(ai_parser, 'settings', return_value=SimpleNamespace(model='qwen3:8b')), \
             patch.object(ai_parser.httpx, 'AsyncClient', return_value=context):
            result = await ai_parser.generate('Be concise.', 'Hello', Plan.model_json_schema())
        payload = client.post.call_args.kwargs['json']
        self.assertFalse(payload['think'])
        self.assertEqual(payload['format'], Plan.model_json_schema())
        self.assertLess(payload['options']['num_ctx'], 16384)
        self.assertEqual(payload['keep_alive'], '15m')
        self.assertEqual(Plan.model_validate_json(result).reply, 'Ready')

    async def test_model_history_is_limited_to_current_session(self):
        records = [
            {'session_id': 'other', 'command': 'secret', 'reply': 'secret'},
            *[{'session_id': 'voice', 'command': str(i), 'reply': 'response'} for i in range(6)],
        ]
        model = AsyncMock(return_value='{"reply":"Ready","actions":[]}')
        with patch.object(ai_parser, 'generate', model), \
             patch.object(ai_parser, 'list_records', return_value=records):
            await ai_parser.parse_command('Explain gravity', 'voice')
        history = model.call_args.args[3]
        self.assertEqual([item['content'] for item in history if item['role'] == 'user'], ['2', '1', '0'])
        self.assertNotIn('secret', str(history))


if __name__ == '__main__':
    unittest.main()
