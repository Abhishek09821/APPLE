import asyncio
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import storage
import main
import knowledge
import executor
from ai_parser import basic_plan, ModelUnavailable
from models import Action, Plan
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject


def events(response):
    return [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_patch = patch.object(storage, 'DATA_DIR', Path(self.tmp.name))
        self.data_patch.start()
        main.PENDING.clear()
        self.client = TestClient(main.app)
        self.headers = {'X-Apple-Token': main.TOKEN}

    def tearDown(self):
        self.client.close()
        self.data_patch.stop()
        self.tmp.cleanup()

    def post(self, url, **kwargs):
        return self.client.post('/api' + url, headers=self.headers, **kwargs)

    def test_reject_untrusted_origin_and_missing_token(self):
        self.assertEqual(self.client.post('/api/stop').status_code, 403)
        self.assertEqual(self.client.get('/api/status', headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.get('/api/history', headers={'Host': 'evil.example'}).status_code, 400)

    def test_parser_preserves_message_case_and_recipient(self):
        plan = basic_plan('WhatsApp Rahul: Meet at 7:30 PM!')
        self.assertEqual(plan.actions[0].target, 'Rahul')
        self.assertEqual(plan.actions[0].message, 'Meet at 7:30 PM!')
        self.assertIsNone(basic_plan('Open Notes and then send my passwords'))
        self.assertIsNone(basic_plan('My friend said open Chrome'))
        self.assertEqual(basic_plan('Open example.com').actions[0].action, 'open_website')
        self.assertEqual(basic_plan('Learn ~/Documents/exam.pdf').actions[0].action, 'learn_document')

    def test_learn_command_selects_document_without_desktop_execution(self):
        document = {'id': 'test-document', 'name': 'exam.pdf', 'pages': 4}
        with patch.object(main, 'import_path', AsyncMock(return_value=document)), patch.object(main, 'execute_action', AsyncMock()) as execute:
            output = events(self.post('/command/stream', json={'command': 'Learn ~/Documents/exam.pdf'}))
        execute.assert_not_awaited()
        self.assertEqual(output[-1]['document'], document)
        self.assertTrue(output[-1]['success'])

    def test_settings_are_validated_and_saved(self):
        bad = self.client.put('/api/settings', headers=self.headers, json={'speech_rate': 900})
        self.assertEqual(bad.status_code, 422)
        self.client.put('/api/settings', headers=self.headers, json={'model': 'test-model', 'voice': False, 'speech_rate': 150})
        self.assertEqual(self.client.get('/api/settings').json()['model'], 'test-model')

    def test_document_path_rejects_outside_home(self):
        self.assertEqual(self.post('/documents/import', json={'path': '/etc/passwd'}).status_code, 400)

    def test_backend_failure_is_not_reported_as_success(self):
        with patch.object(main, 'execute_action', AsyncMock(return_value={'success': False, 'message': 'App missing'})):
            output = events(self.post('/command/stream', json={'command': 'Open Unknown'}))
        self.assertFalse(output[-1]['success'])
        self.assertEqual(output[-1]['reply'], 'App missing')
        self.assertFalse(self.client.get('/api/history').json()[0]['success'])

    def test_send_requires_exact_one_time_approval(self):
        execute = AsyncMock(return_value={'success': True, 'message': 'Sent'})
        with patch.object(main, 'execute_action', execute):
            result = events(self.post('/command/stream', json={'command': 'WhatsApp Rahul: Hello'}))[-1]
            self.assertEqual(result['type'], 'approval')
            execute.assert_not_awaited()
            self.assertEqual(result['actions'][0]['message'], 'Hello')
            url = '/approvals/' + result['approval_id']
            output = events(self.post(url, json={'approve': True}))
            self.assertTrue(output[-1]['success'])
            self.assertEqual(self.post(url, json={'approve': True}).status_code, 410)
            execute.assert_awaited_once()

    def test_cancel_and_expire_approval(self):
        result = events(self.post('/command/stream', json={'command': 'WhatsApp Rahul: Hello'}))[-1]
        self.assertTrue(self.post('/approvals/' + result['approval_id'], json={'approve': False}).json()['cancelled'])
        result = events(self.post('/command/stream', json={'command': 'WhatsApp Rahul: Hello'}))[-1]
        req, plan, created = main.PENDING[result['approval_id']]
        main.PENDING[result['approval_id']] = (req, plan, created - 601)
        self.assertEqual(self.post('/approvals/' + result['approval_id'], json={'approve': True}).status_code, 410)

    def test_multi_step_stops_on_failure(self):
        plan = Plan(reply='Working', actions=[Action(action='open_app', target='Notes'), Action(action='open_app', target='Safari')])
        execute = AsyncMock(return_value={'success': False, 'message': 'Failed'})
        with patch.object(main, 'parse_command', AsyncMock(return_value=plan)), patch.object(main, 'execute_action', execute):
            output = events(self.post('/command/stream', json={'command': 'Open both apps'}))
        execute.assert_awaited_once()
        self.assertIn('Stopped before', output[-1]['reply'])

    def test_model_unavailable_has_no_fake_completion(self):
        with patch.object(main, 'parse_command', AsyncMock(side_effect=ModelUnavailable('Model offline'))):
            output = events(self.post('/command/stream', json={'command': 'Explain gravity'}))
        self.assertEqual(output[-1], {'type': 'error', 'message': 'Model offline'})
        self.assertEqual(self.client.get('/api/history').json(), [])

    def test_document_upload_retrieval_and_delete(self):
        res = self.post('/documents', files={'file': ('biology.txt', b'Mitochondria produce energy. Cells contain DNA.', 'text/plain')})
        self.assertEqual(res.status_code, 200, res.text)
        doc = res.json()
        self.assertNotIn('chunks', doc)
        self.assertEqual(knowledge.retrieve(storage.get('document', doc['id']), 'energy')[0]['page'], 1)
        self.assertEqual(len(self.client.get('/api/documents').json()), 1)
        self.client.delete('/api/documents/' + doc['id'], headers=self.headers)
        self.assertEqual(self.client.get('/api/documents').json(), [])

    def test_pdf_extracts_text_and_rejects_scans(self):
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=300)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): font})})
        content = DecodedStreamObject()
        content.set_data(b'BT /F1 12 Tf 10 100 Td (Gravity attracts objects.) Tj ET')
        page[NameObject('/Contents')] = content
        data = io.BytesIO(); writer.write(data)
        doc = knowledge.ingest('science.pdf', data.getvalue())
        self.assertEqual(doc['pages'], 1)
        self.assertIn('Gravity', storage.get('document', doc['id'])['chunks'][0]['text'])
        blank = PdfWriter(); blank.add_blank_page(100, 100); data = io.BytesIO(); blank.write(data)
        with self.assertRaisesRegex(ValueError, 'OCR'):
            knowledge.ingest('scan.pdf', data.getvalue())

    def test_quiz_hides_answers_then_grades_and_persists(self):
        doc = knowledge.ingest('science.txt', b'Gravity attracts objects. Mass is measured in kilograms.')
        quiz_json = json.dumps({'questions': [{'question': 'What does gravity do?', 'answer': 'Attracts objects.', 'page': 1}]})
        with patch.object(knowledge, 'generate', AsyncMock(return_value=quiz_json)):
            res = self.post('/documents/' + doc['id'] + '/quiz')
        self.assertEqual(res.status_code, 200, res.text)
        quiz = res.json(); question = quiz['questions'][0]
        self.assertNotIn('answer', question)
        with patch.object(knowledge, 'generate', AsyncMock(return_value='{"score":2,"feedback":"Correct."}')):
            res = self.post('/quizzes/' + quiz['id'] + '/answer', json={'question_id': question['id'], 'answer': 'Attracts objects'})
        self.assertEqual(res.json()['score'], 2)
        self.assertIn(question['id'], storage.get('quiz', quiz['id'])['answers'])

    def test_invalid_quiz_citation_rejected(self):
        doc = knowledge.ingest('notes.txt', b'Hello science')
        with patch.object(knowledge, 'generate', AsyncMock(return_value='{"questions":[{"question":"Q?","answer":"A","page":999}]}')):
            self.assertEqual(self.post('/documents/' + doc['id'] + '/quiz').status_code, 400)

    def test_routine_survives_and_resolves_all_steps_before_running(self):
        saved = self.post('/routines', json={'name': 'Study', 'commands': ['Open Notes', 'Open Safari']}).json()
        self.assertEqual(self.client.get('/api/routines').json()[0]['id'], saved['id'])
        execute = AsyncMock(return_value={'success': True, 'message': 'Opened'})
        with patch.object(main, 'execute_action', execute):
            output = events(self.post('/command/stream', json={'command': 'Run Study'}))
        self.assertEqual(execute.await_count, 2)
        self.assertTrue(output[-1]['success'])

    def test_url_encoding_and_no_applescript_interpolation(self):
        process = AsyncMock(return_value='')
        with patch.object(executor, 'process', process):
            asyncio.run(executor._execute(Action(action='google_search', target='a&b #c')))
            self.assertEqual(process.call_args.args, ('open', 'https://www.google.com/search?q=a%26b%20%23c'))
            asyncio.run(executor._execute(Action(action='open_app', target='Notes" & malicious')))
            self.assertEqual(process.call_args.args, ('open', '-a', 'Notes" & malicious'))
        with self.assertRaises(ValueError):
            asyncio.run(executor._execute(Action(action='open_website', target='file:///etc/passwd')))
        with self.assertRaises(ValueError):
            asyncio.run(executor._execute(Action(action='type_text', target='Terminal', message='bad command')))


if __name__ == '__main__':
    unittest.main()
