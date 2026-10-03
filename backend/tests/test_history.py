"""Deletion API tests run against a disposable database, never personal history."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import main
import storage
import ai_parser


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(storage, 'DATA_DIR', Path(self.tmp.name))
        self.data.start()
        self.client = TestClient(main.app)
        self.headers = {'X-Apple-Token': main.TOKEN}
        for i in range(3):
            storage.put('history', {'command': f'Question {i}', 'reply': f'Answer {i}',
                                   'session_id': 'test-session'}, f'h{i}')
        for kind in ['document', 'contact', 'memory', 'quiz', 'routine']:
            storage.put(kind, {'name': 'Keep me', 'text': 'Keep this memory'}, kind)

    def tearDown(self):
        self.client.close()
        self.data.stop()
        self.tmp.cleanup()

    def test_selected_deletion_is_atomic_scoped_and_idempotent(self):
        ids = ['h0', 'h2', 'h0', 'contact', "' OR 1=1 --"]
        result = self.client.post('/api/history/delete', json={'ids': ids}, headers=self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {'deleted': 2})
        self.assertEqual([h['id'] for h in storage.list_records('history')], ['h1'])
        self.assertIsNotNone(storage.get('contact', 'contact'))
        self.assertEqual(self.client.post('/api/history/delete', json={'ids': ids}, headers=self.headers).json(), {'deleted': 0})

    def test_clear_all_includes_records_beyond_visible_page_and_preserves_other_data(self):
        for i in range(101):
            storage.put('history', {'command': 'Older'}, f'old{i}')
        self.assertEqual(len(self.client.get('/api/history').json()), 100)
        result = self.client.delete('/api/history', headers=self.headers)
        self.assertEqual(result.json(), {'deleted': 104})
        self.assertEqual(storage.list_records('history'), [])
        for kind in ['document', 'contact', 'memory', 'quiz', 'routine']:
            self.assertIsNotNone(storage.get(kind, kind))

    def test_one_entry_deletion_and_missing_entry(self):
        self.assertEqual(self.client.delete('/api/history/h0', headers=self.headers).json(), {'deleted': 1})
        self.assertEqual(self.client.delete('/api/history/h0', headers=self.headers).json(), {'deleted': 0})
        self.assertEqual(len(storage.list_records('history')), 2)

    def test_authentication_origin_and_input_limits(self):
        for path in ['/api/history', '/api/history/h0']:
            self.assertEqual(self.client.delete(path).status_code, 403)
        self.assertEqual(self.client.post('/api/history/delete', json={'ids': ['h0']}).status_code, 403)
        self.assertEqual(self.client.delete('/api/history', headers={**self.headers, 'Origin': 'https://foreign.example'}).status_code, 403)
        for ids in [[], ['h0'] * 1001]:
            self.assertEqual(self.client.post('/api/history/delete', json={'ids': ids}, headers=self.headers).status_code, 422)
        self.assertEqual(len(storage.list_records('history')), 3)

    def test_deleted_entries_are_absent_from_next_model_context(self):
        self.client.delete('/api/history/h0', headers=self.headers)
        generate = AsyncMock(return_value=json.dumps({'reply': 'A thoughtful answer.', 'actions': []}))
        with patch.object(ai_parser, 'generate', generate):
            import asyncio
            asyncio.run(ai_parser.parse_command('Why does rain happen?', 'test-session'))
        context = generate.await_args.args[3]
        self.assertNotIn('Question 0', str(context))
        self.assertIn('Question 1', str(context))

    def test_expressive_setting_round_trip_and_prompt(self):
        self.assertTrue(storage.settings().expressive_voice)
        result = self.client.put('/api/settings', headers=self.headers, json={'expressive_voice': False})
        self.assertEqual(result.status_code, 200)
        self.assertFalse(self.client.get('/api/settings').json()['expressive_voice'])
        generate = AsyncMock(return_value=json.dumps({'reply': 'A thoughtful answer.', 'actions': []}))
        with patch.object(ai_parser, 'generate', generate):
            import asyncio
            asyncio.run(ai_parser.parse_command('Why does rain happen?'))
        self.assertNotIn('occasional brief', generate.await_args.args[0])


if __name__ == '__main__':
    unittest.main()
