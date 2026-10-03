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
from urllib.parse import quote
from pathlib import Path
from playwright.async_api import async_playwright

MOCK_RECOGNITION = '''
window.voiceInstances = [];
window.SpeechRecognition = class {
  constructor() { window.voiceInstances.push(this); }
  start(track) { this.track = track; this.active = true; this.onstart?.(); }
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

async def main(duplex=False):
    with tempfile.TemporaryDirectory(prefix='apple-voice-test-') as tmp:
        microphone = Path(tmp) / 'microphone.wav'
        microphone.write_bytes(pcm())
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={microphone}', '--mute-audio'])
            page = await browser.new_page(viewport={'width':1440, 'height':960})
            await page.add_init_script(MOCK_RECOGNITION)
            # Exercise both browser capability branches. PCM capture is real;
            # acoustic cancellation itself cannot be measured with fake audio.
            await page.add_init_script('''
              const original = MediaStreamTrack.prototype.getSettings;
              MediaStreamTrack.prototype.getSettings = function() {
                return {...original.call(this), echoCancellation: %s};
              };
            ''' % ('"all"' if duplex else 'true'))
            errors, commands, speeches, answers = [], [], [], []
            docs = []
            attempts = []
            doc = {'id':'voice-doc','name':'Voice lesson.txt','pages':1,'characters':150}
            quiz = {'id':'voice-quiz','name':doc['name'],'answers':{},'questions':[
                {'id':'q1','question':'What gives plants energy?','page':1},
                {'id':'q2','question':'What pulls objects toward Earth?','page':1}]}
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def routes(route):
                path = route.request.url.split('/api')[-1]
                if path == '/status':
                    return await route.fulfill(json={'token':'test-only','ai':{'ready':True,'models':['test']},
                        'profile':{'name':'Test User','tutorial_completed':True},'settings':{'model':'test','speech_rate':175,'automation_enabled':True,'setup_completed':True,'auto_tutor':True}})
                if path in ['/history','/routines','/memories']: return await route.fulfill(json=[])
                if path == '/documents':
                    if route.request.method == 'POST': docs.append(doc); return await route.fulfill(json=doc)
                    return await route.fulfill(json=docs)
                if path == '/documents/voice-doc/quiz':
                    attempts.append(True)
                    if not duplex and len(attempts) == 1:
                        return await route.fulfill(status=400, json={'detail':'The model supplied unsupported source evidence. Please generate the quiz again.'})
                    return await route.fulfill(json=quiz)
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
                    return await route.fulfill(content_type='audio/wav',
                        headers={'X-Apple-Spoken-Text': quote(speeches[-1] + ' The details are on screen.')},
                        body=pcm(.55 if docs else 4, interrupted=not docs))
                if path in ['/stop','/speech/stop']: return await route.fulfill(json={'stopped':True})
                await route.fulfill(status=404, json={'detail':'Unexpected test request '+path})

            await page.route('**/api/**', routes)
            await page.goto('http://127.0.0.1:8000/#assistant')
            await page.get_by_role('button', name='Start listening', exact=True).click()
            await page.wait_for_function(ACTIVE)
            assert await page.evaluate("window.voiceInstances.at(-1).track instanceof MediaStreamTrack")
            assert await page.evaluate("window.voiceInstances.at(-1).lang") == 'en-IN'
            track_id = await page.evaluate("window.voiceInstances.at(-1).track.id")
            await page.wait_for_function(SIGNAL + ' > .15')
            await page.evaluate("window.voiceInstances.at(-1).finish('Hello APPLE')")
            await page.locator('[data-voice-state="speaking"]').wait_for()
            if duplex:
                await page.wait_for_function(ACTIVE)
            else:
                assert not await page.evaluate(ACTIVE), 'No recognizer may hear playback when full AEC is unavailable'
            # Real PCM silence must settle even though the mic remains active.
            await page.wait_for_function(SIGNAL + ' < .02 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await page.wait_for_function(SIGNAL + ' > .15 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            if duplex:
                await page.evaluate("window.voiceInstances.at(-1).interim('Hello from the voice test')")
                await page.evaluate("window.voiceInstances.at(-1).interim('The details are on screen')")
                assert await page.locator('[data-voice-state="speaking"]').count()
                await page.evaluate("window.voiceInstances.at(-1).interim('Actually explain gravity')")
            else:
                await page.get_by_role('button', name='Interrupt', exact=True).click()
            await page.locator('[data-voice-state="speaking"]').wait_for(state='hidden')
            await page.wait_for_function(ACTIVE)
            assert await page.evaluate("window.voiceInstances.at(-1).track.id") == track_id
            await page.evaluate("window.voiceInstances.at(-1).finish('Actually explain gravity')")
            await page.wait_for_function('!!document.querySelector(\'[data-voice-state="speaking"]\')')
            assert [c['command'] for c in commands] == ['Hello APPLE','Actually explain gravity']
            await page.wait_for_function(ACTIVE)
            if not duplex:
                # Delayed STT callback after the old 650 ms guard would have expired.
                await page.evaluate("window.voiceInstances.at(-1).finish('Hello from the voice test')")
                await page.wait_for_function(ACTIVE)
                assert len(commands) == 2
            await page.evaluate("window.voiceInstances.at(-1).finish('stop listening')")
            await page.get_by_role('button', name='Start listening', exact=True).wait_for()
            assert not await page.evaluate(ACTIVE)
            assert await page.evaluate("window.voiceInstances.every(r => !r.track || r.track.readyState === 'ended')")

            # Desktop links are visible; narrow screens use the keyboard-accessible menu.
            if await page.locator('.global-nav-toggle').is_visible():
                await page.get_by_role('button', name='Show navigation').focus()
                await page.keyboard.press('ArrowDown')
            await page.get_by_role('button', name='Knowledge library', exact=True).click()
            await page.locator('input[type=file]').set_input_files({'name':doc['name'],'mimeType':'text/plain',
                'buffer':b'Plants use sunlight for energy. Gravity pulls objects toward Earth.'})
            lesson = page.get_by_role('region', name='Voice lesson')
            if not duplex:
                await lesson.get_by_role('button', name='Try lesson again').click()
            await lesson.get_by_role('heading', name='What gives plants energy?').wait_for()
            assert not await page.get_by_role('alert').filter(has_text='unsupported source evidence').count()
            await page.set_viewport_size({'width':440, 'height':956})
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.screenshot(path='/tmp/apple-document-lesson.png', full_page=True)
            await page.set_viewport_size({'width':1440, 'height':960})
            await page.wait_for_function(ACTIVE)
            await page.evaluate("window.voiceInstances.at(-1).finish('Sunlight')")
            await lesson.get_by_role('heading', name='What pulls objects toward Earth?').wait_for()
            assert not await lesson.locator('.tutor-feedback').count(), 'Previous grading must not appear under the next question'
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
            print(f'PASS ({"full-duplex capability" if duplex else "safe turn-taking"}): shared processed track, PCM motion, actual spoken-text echo rejection, interruption, Stop releases microphone, voice lesson, permission errors.', flush=True)

asyncio.run(main())
asyncio.run(main(duplex=True))
