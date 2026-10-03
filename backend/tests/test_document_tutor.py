import asyncio
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import knowledge
import storage


def docx(xml):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/document.xml', xml)
    return data.getvalue()


class DocumentTutorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_patch = patch.object(storage, 'DATA_DIR', Path(self.tmp.name))
        self.data_patch.start()

    def tearDown(self):
        self.data_patch.stop()
        self.tmp.cleanup()

    def save_quiz(self):
        return storage.put('quiz', {'document_id': 'test', 'name': 'Science', 'questions': [
            {'id': 'q1', 'question': 'What does gravity do?', 'answer': 'Attracts objects.', 'page': 1, 'evidence': 'Gravity attracts objects.'},
            {'id': 'q2', 'question': 'What contains DNA?', 'answer': 'Cells.', 'page': 1, 'evidence': 'Cells contain DNA.'},
        ], 'answers': {}})

    def test_docx_extracts_paragraphs_tables_and_explicit_breaks(self):
        xml = '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
          <w:p><w:r><w:t>Gravity attracts objects.</w:t></w:r></w:p>
          <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cells contain DNA.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
          <w:p><w:r><w:br w:type="page"/><w:t>Water freezes at zero degrees Celsius.</w:t></w:r></w:p>
        </w:body></w:document>'''
        imported = knowledge.ingest('science.docx', docx(xml))
        saved = storage.get('document', imported['id'])
        self.assertEqual(imported['citation_label'], 'Section')
        self.assertEqual(imported['pages'], 2)
        self.assertEqual(imported['format'], 'docx')
        self.assertEqual(len(imported['fingerprint']), 64)
        self.assertNotIn('chunks', imported)
        self.assertIn('Gravity attracts objects.', saved['chunks'][0]['text'])
        self.assertIn('Cells contain DNA.', saved['chunks'][0]['text'])
        self.assertEqual(saved['chunks'][-1]['page'], 2)

    def test_docx_rejects_invalid_unsafe_oversize_and_image_only_data(self):
        with self.assertRaisesRegex(ValueError, 'DOCX'):
            knowledge.ingest('broken.docx', b'not a zip')
        with self.assertRaisesRegex(ValueError, 'XML declarations'):
            knowledge.ingest('entity.docx', docx('<!DOCTYPE x [<!ENTITY a "value">]><x/>'))
        with patch.object(knowledge, 'MAX_DOCX_XML', 8):
            with self.assertRaisesRegex(ValueError, 'too large'):
                knowledge.ingest('big.docx', docx('<document>long text</document>'))
        with self.assertRaisesRegex(ValueError, 'OCR'):
            knowledge.ingest('image.docx', docx('<document/>'))

    def test_utf8_bom_and_invalid_upload_feedback(self):
        imported = knowledge.ingest('notes.txt', b'\xef\xbb\xbfGravity attracts objects.')
        self.assertEqual(storage.get('document', imported['id'])['chunks'][0]['text'], 'Gravity attracts objects.')
        for filename, content, message in [('empty.txt', b'', 'empty'), ('bad.txt', b'\xff', 'UTF-8'), ('old.doc', b'data', '.docx')]:
            with self.subTest(filename=filename), self.assertRaisesRegex(ValueError, message):
                knowledge.ingest(filename, content)

    def test_retrieval_uses_whole_words_plurals_and_summary_coverage(self):
        doc = {'chunks': [{'page': 1, 'text': 'The cellar stores apples.'},
                          {'page': 2, 'text': 'Cells contain DNA.'}]}
        self.assertEqual(knowledge.retrieve(doc, 'What is inside a cell?')[0]['page'], 2)
        self.assertEqual(knowledge.retrieve(doc, 'DNA')[0]['page'], 2)
        long_doc = {'chunks': [{'page': index + 1, 'text': f'Chapter {index + 1}.'} for index in range(30)]}
        sources = knowledge.retrieve(long_doc, 'Summarize the key ideas in this document', count=4)
        self.assertEqual(len(sources), 4)
        self.assertEqual([sources[0]['page'], sources[-1]['page']], [1, 30])

    async def test_quiz_hides_source_evidence_and_starts_at_first_question(self):
        imported = knowledge.ingest('notes.txt', b'Gravity attracts objects. Cells contain DNA.')
        raw = json.dumps({'questions': [
            {'question': 'What does gravity do?', 'answer': 'Attracts objects.', 'page': 1, 'evidence': 'Gravity attracts objects.'},
            {'question': 'What does gravity do?', 'answer': 'Attracts objects.', 'page': 1, 'evidence': 'Gravity attracts objects.'},
        ]})
        with patch.object(knowledge, 'generate', AsyncMock(return_value=raw)):
            quiz = knowledge.public_quiz(await knowledge.make_quiz(imported['id']))
        self.assertEqual(len(quiz['questions']), 1)
        self.assertNotIn('answer', quiz['questions'][0])
        self.assertNotIn('evidence', quiz['questions'][0])
        self.assertEqual(quiz['next_question'], quiz['questions'][0])
        self.assertEqual(quiz['progress']['answered'], 0)
        self.assertFalse(quiz['completed'])

    async def test_hallucinated_evidence_does_not_persist_quiz(self):
        imported = knowledge.ingest('notes.txt', b'Gravity attracts objects.')
        raw = json.dumps({'questions': [{'question': 'What does gravity do?', 'answer': 'Repels objects.', 'page': 1, 'evidence': 'Gravity repels objects.'}]})
        with patch.object(knowledge, 'generate', AsyncMock(return_value=raw)):
            with self.assertRaisesRegex(ValueError, 'unsupported source evidence'):
                await knowledge.make_quiz(imported['id'])
        self.assertEqual(storage.list_records('quiz'), [])

    async def test_spoken_answer_then_skip_yields_next_question_and_final_score(self):
        quiz = self.save_quiz()
        with patch.object(knowledge, 'generate', AsyncMock()) as model:
            first = await knowledge.grade_answer(quiz['id'], 'q1', 'attracts objects')
            self.assertEqual(first['verdict'], 'correct')
            self.assertEqual(first['next_question']['id'], 'q2')
            self.assertFalse(first['completed'])
            final = await knowledge.grade_answer(quiz['id'], 'q2', "I don't know")
        model.assert_not_awaited()
        self.assertEqual(final['verdict'], 'incorrect')
        self.assertIsNone(final['next_question'])
        self.assertTrue(final['completed'])
        self.assertEqual(final['progress']['score'], 2)
        self.assertEqual(final['progress']['max_score'], 4)
        self.assertEqual(final['progress']['percent'], 50)
        self.assertIn('2 out of 4', final['spoken_feedback'])
        self.assertIn('Cells.', final['spoken_feedback'])

    async def test_partial_answer_keeps_correction_and_duplicate_attempt_is_idempotent(self):
        quiz = self.save_quiz()
        with patch.object(knowledge, 'generate', AsyncMock(return_value='{"score":1,"feedback":"You identified a force, but missed that it attracts objects."}')) as model:
            first = await knowledge.grade_answer(quiz['id'], 'q1', 'It is a force.')
            repeated = await knowledge.grade_answer(quiz['id'], 'q1', 'Attracts objects.')
        model.assert_awaited_once()
        self.assertEqual(repeated, first)
        self.assertEqual(first['verdict'], 'partial')
        self.assertIn('Partly correct.', first['spoken_feedback'])
        self.assertEqual(first['progress']['answered'], 1)

    async def test_parallel_duplicate_answers_grade_only_once(self):
        quiz = self.save_quiz()
        async def grade(*args, **kwargs):
            await asyncio.sleep(0.01)
            return '{"score":2,"feedback":"Gravity pulls objects toward one another."}'
        with patch.object(knowledge, 'generate', AsyncMock(side_effect=grade)) as model:
            first, second = await asyncio.gather(
                knowledge.grade_answer(quiz['id'], 'q1', 'It pulls objects together.'),
                knowledge.grade_answer(quiz['id'], 'q1', 'It pulls objects together.'))
        model.assert_awaited_once()
        self.assertEqual(first, second)

    async def test_cancelling_study_stops_generation_without_persisting(self):
        imported = knowledge.ingest('notes.txt', b'Gravity attracts objects.')
        started = asyncio.Event()
        async def slow(*args, **kwargs):
            started.set()
            await asyncio.sleep(60)
        with patch.object(knowledge, 'generate', AsyncMock(side_effect=slow)):
            task = asyncio.create_task(knowledge.make_quiz(imported['id']))
            await started.wait()
            await knowledge.cancel_study_tasks()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual(storage.list_records('quiz'), [])
        self.assertEqual(knowledge.STUDY_TASKS, set())

    async def test_generation_timeout_is_clear_and_cleans_tasks(self):
        async def slow(*args, **kwargs):
            await asyncio.sleep(60)
        with patch.object(knowledge, 'generate', AsyncMock(side_effect=slow)):
            with self.assertRaisesRegex(ValueError, 'too long'):
                await knowledge._study_generate('system', 'prompt', timeout=0.01)
        self.assertEqual(knowledge.STUDY_TASKS, set())

    async def test_stop_also_cancels_answers_waiting_for_the_quiz_lock(self):
        quiz = self.save_quiz()
        started = asyncio.Event()
        async def slow(*args, **kwargs):
            started.set()
            await asyncio.sleep(60)
        with patch.object(knowledge, 'generate', AsyncMock(side_effect=slow)) as model:
            first = asyncio.create_task(knowledge.grade_answer(quiz['id'], 'q1', 'A force.'))
            await started.wait()
            second = asyncio.create_task(knowledge.grade_answer(quiz['id'], 'q2', 'Maybe molecules.'))
            await asyncio.sleep(0)
            await knowledge.cancel_study_tasks()
            results = await asyncio.gather(first, second, return_exceptions=True)
        self.assertTrue(all(isinstance(result, asyncio.CancelledError) for result in results))
        model.assert_awaited_once()
        self.assertEqual(storage.get('quiz', quiz['id'])['answers'], {})


if __name__ == '__main__':
    unittest.main()
