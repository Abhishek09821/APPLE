"""Browser integration: real PCM motion, barge-in and a hands-free document lesson.
Recognition text and server responses are fixtures. No desktop actions or messages.
"""
import asyncio
import io
import json
import math
import struct
import tempfile
import wave
from pathlib import Path
from playwright.async_api import async_playwright

MOCK_RECOGNITION = '''
window.voiceInstances = [];
window.SpeechRecognition = class {
  constructor() { window.voiceInstances.push(this); }
  start() { this.active = true; this.onstart?.(); }
  abort() { this.active = false; this.onend?.(); }
  interim(text) { const r = [{transcript: text}]; r.isFinal = false; this.onresult?.({results: [r]}); }
  finish(text) {
    const r = [{transcript: text}]; r.isFinal = true;
    this.onresult?.({results: [r]}); this.active = false; this.onend?.();
  }
};
'''
SIGNAL = "parseFloat(getComputedStyle(document.querySelector('.vc-instrument')).getPropertyValue('--audio-level'))"
ACTIVE = 'window.voiceInstances.some(r => r.active)'

def pcm(duration=3, interrupted=False):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(22050)
        output.writeframes(b''.join(struct.pack('<h', int(9000 * math.sin(2 * math.pi * 320 * i / 22050))
            if not interrupted or i / 22050 < .9 or i / 22050 > 1.7 else 0) for i in range(int(22050 * duration))))
    return buffer.getvalue()

async def main():
    with tempfile.TemporaryDirectory(prefix='apple-voice-test-') as tmp:
        microphone = Path(tmp) / 'microphone.wav'
        microphone.write_bytes(pcm())
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={microphone}', '--mute-audio'])
            page = await browser.new_page(viewport={'width':1440, 'height':960})
            await page.add_init_script(MOCK_RECOGNITION)
            errors, commands, speeches, answers = [], [], [], []
            docs = []
            doc = {'id':'voice-doc','name':'Voice lesson.txt','pages':1,'characters':150}
            quiz = {'id':'voice-quiz','name':doc['name'],'answers':{},'questions':[
                {'id':'q1','question':'What gives plants energy?','page':1},
                {'id':'q2','question':'What pulls objects toward Earth?','page':1}]}
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def routes(route):
                path = route.request.url.split('/api')[-1]
                if path == '/status':
                    return await route.fulfill(json={'token':'test-only','ai':{'ready':True,'models':['test']},
                        'settings':{'model':'test','speech_rate':175,'automation_enabled':True,'setup_completed':True,'auto_tutor':True}})
                if path in ['/history','/routines','/memories']: return await route.fulfill(json=[])
                if path == '/documents':
                    if route.request.method == 'POST': docs.append(doc); return await route.fulfill(json=doc)
                    return await route.fulfill(json=docs)
                if path == '/documents/voice-doc/quiz': return await route.fulfill(json=quiz)
                if path == '/quizzes/voice-quiz/answer':
                    answer = route.request.post_data_json; answers.append(answer)
                    done = answer['question_id'] == 'q2'
                    return await route.fulfill(json={'score':2 if not done else 0, 'feedback':'Sunlight is right.' if not done else 'Gravity pulls objects toward Earth.',
                        'spoken_feedback':'Correct. Sunlight gives plants energy.' if not done else 'Not quite. Gravity pulls objects toward Earth. You finished with 2 out of 4 points.',
                        'completed':done, 'reference':'sunlight' if not done else 'gravity'})
                if path == '/command/stream':
                    commands.append(route.request.post_data_json)
                    events = [{'type':'plan','reply':'Hello from the voice test.','actions':[]},
                              {'type':'done','reply':'Hello from the voice test.','success':True}]
                    return await route.fulfill(content_type='text/event-stream', body=''.join('data: '+json.dumps(e)+'\n\n' for e in events))
                if path == '/speech/audio':
                    speeches.append(route.request.post_data_json['text'])
                    return await route.fulfill(content_type='audio/wav', body=pcm(.55 if docs else 3, interrupted=not docs))
                if path in ['/stop','/speech/stop']: return await route.fulfill(json={'stopped':True})
                await route.fulfill(status=404, json={'detail':'Unexpected test request '+path})

            await page.route('**/api/**', routes)
            await page.goto('http://127.0.0.1:8000')
            await page.get_by_role('button', name='Start listening', exact=True).click()
            await page.wait_for_function(SIGNAL + ' > .15')
            await page.evaluate("window.voiceInstances.at(-1).finish('Hello APPLE')")
            await page.locator('[data-voice-state="speaking"]').wait_for()
            await page.wait_for_function(ACTIVE)
            # Real PCM silence must settle even though the mic remains active.
            await page.wait_for_function(SIGNAL + ' < .02 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await page.wait_for_function(SIGNAL + ' > .15 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await page.evaluate("window.voiceInstances.at(-1).interim('Hello from the voice test')")
            assert await page.locator('[data-voice-state="speaking"]').count()
            await page.evaluate("window.voiceInstances.at(-1).interim('Actually explain gravity')")
            await page.locator('[data-voice-state="speaking"]').wait_for(state='hidden')
            assert await page.evaluate(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).finish('Actually explain gravity')")
            await page.wait_for_function('!!document.querySelector(\'[data-voice-state="speaking"]\')')
            assert [c['command'] for c in commands] == ['Hello APPLE','Actually explain gravity']
            await page.wait_for_function(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).finish('stop listening')")
            await page.get_by_role('button', name='Start listening', exact=True).wait_for()
            assert not await page.evaluate(ACTIVE)

            # Navigation really starts hidden and is reachable by keyboard and hover.
            await page.keyboard.press('Tab')
            await page.get_by_role('button', name='Show navigation').focus()
            await page.get_by_role('button', name='Knowledge library', exact=True).click()
            await page.locator('input[type=file]').set_input_files({'name':doc['name'],'mimeType':'text/plain',
                'buffer':b'Plants use sunlight for energy. Gravity pulls objects toward Earth.'})
            lesson = page.get_by_role('region', name='Voice lesson')
            await lesson.get_by_role('heading', name='What gives plants energy?').wait_for()
            await page.wait_for_function(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).finish('Sunlight')")
            await lesson.get_by_role('heading', name='What pulls objects toward Earth?').wait_for()
            await page.wait_for_function(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).finish('Magnets')")
            await lesson.get_by_role('heading', name='Lesson complete.').wait_for()
            await lesson.get_by_text('2 / 4 points', exact=True).wait_for()
            assert [a['answer'] for a in answers] == ['Sunlight','Magnets']
            assert any('Correct.' in t for t in speeches) and any('Not quite.' in t for t in speeches)
            assert len(commands) == 2, 'Quiz answers must not become desktop commands'
            await page.screenshot(path='/tmp/apple-voice-teacher.png', full_page=True)
            await page.get_by_role('button', name='End lesson', exact=True).click()
            await page.get_by_role('button', name='End session', exact=True).click()
            await page.get_by_role('button', name='Start listening', exact=True).click()
            await page.wait_for_function(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).onerror({error:'not-allowed'})")
            await page.get_by_role('alert').filter(has_text='Microphone permission was denied').wait_for()
            assert not await page.evaluate(ACTIVE)
            assert not errors, errors
            await browser.close()
            print('PASS: PCM/mic motion, silence, echo rejection, interruption without ending listening, voice Stop, hidden navigation, upload → spoken questions → oral answers → grading → next question → final score, permission errors.')

asyncio.run(main())
