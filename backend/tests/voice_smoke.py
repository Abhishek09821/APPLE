"""Hands-free loop + real PCM amplitude visualization, with no desktop actions."""
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
  finish(text) {
    const result = [{transcript: text}]; result.isFinal = true;
    this.onresult?.({results: [result]}); this.active = false; this.onend?.();
  }
};
'''
SIGNAL = "parseFloat(getComputedStyle(document.querySelector('.vc-instrument')).getPropertyValue('--audio-level'))"

def pcm(interrupted=False):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(22050)
        samples = []
        for i in range(22050 * 3):
            t = i / 22050
            audible = not interrupted or .2 < t < .9 or 1.7 < t < 2.5
            samples.append(struct.pack('<h', int(9000 * math.sin(2 * math.pi * 320 * t)) if audible else 0))
        output.writeframes(b''.join(samples))
    return buffer.getvalue()

async def main():
    with tempfile.TemporaryDirectory(prefix='apple-voice-test-') as tmp:
        microphone = Path(tmp) / 'microphone.wav'
        microphone.write_bytes(pcm())
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=[
                '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
                f'--use-file-for-fake-audio-capture={microphone}', '--mute-audio',
            ])
            page = await browser.new_page(viewport={'width': 1440, 'height': 960})
            await page.add_init_script(MOCK_RECOGNITION)
            errors, commands, speeches = [], [], []
            speech_requested = asyncio.Event()
            release_audio = asyncio.Event()
            page.on('pageerror', lambda error: errors.append(str(error)))

            async def command(route):
                commands.append(route.request.post_data_json)
                events = [{'type': 'plan', 'reply': 'Hello from the voice test.', 'actions': []},
                          {'type': 'done', 'reply': 'Hello from the voice test.', 'success': True}]
                if commands[-1]['command'] == 'Send a test message':
                    events = [{'type': 'approval', 'approval_id': 'voice-test-only', 'reply': 'Review this test message.',
                               'actions': [{'action': 'whatsapp_send', 'target': 'Test contact', 'message': 'A test message'}]}]
                body = ''.join('data: ' + json.dumps(event) + '\n\n' for event in events)
                await route.fulfill(content_type='text/event-stream', body=body)

            async def speech(route):
                speeches.append(route.request.post_data_json)
                speech_requested.set()
                await release_audio.wait()
                await route.fulfill(content_type='audio/wav', body=pcm(interrupted=True))

            await page.route('**/api/command/stream', command)
            await page.route('**/api/speech/audio', speech)
            await page.route('**/api/approvals/voice-test-only', lambda route: route.fulfill(json={'cancelled': True}))
            await page.goto('http://127.0.0.1:8000')
            start = page.get_by_role('button', name='Start listening', exact=True)
            await start.click()
            await page.locator('[data-voice-state="listening"]').wait_for()
            await page.wait_for_function(SIGNAL + ' > 0.15')
            await page.screenshot(path='/tmp/apple-listening.png', full_page=True)
            await page.evaluate("window.voiceInstances.at(-1).finish('Hello APPLE')")
            await asyncio.wait_for(speech_requested.wait(), 10)
            assert commands[0]['command'] == 'Hello APPLE'
            assert not await page.evaluate('window.voiceInstances.some(r => r.active)')
            release_audio.set()
            await page.locator('[data-voice-state="speaking"]').wait_for()
            await page.wait_for_function(SIGNAL + ' > 0.15')
            await page.screenshot(path='/tmp/apple-speaking.png', full_page=True)
            # The actual audio has a silent gap, so animation must settle while
            # still speaking, then rise again with the next PCM segment.
            await page.wait_for_function(SIGNAL + ' < 0.02 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await page.wait_for_function(SIGNAL + ' > 0.15 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await page.locator('[data-voice-state="listening"]').wait_for()
            assert await page.evaluate('window.voiceInstances.at(-1).active')
            await page.evaluate("window.voiceInstances.at(-1).finish('Send a test message')")
            await page.get_by_text('Ready for your review', exact=True).wait_for()
            assert not await page.evaluate('window.voiceInstances.some(r => r.active)')
            await page.get_by_role('button', name='Cancel', exact=True).click()
            await page.locator('[data-voice-state="listening"]').wait_for()
            await page.get_by_role('button', name='End session', exact=True).click()
            assert not await page.evaluate('window.voiceInstances.some(r => r.active)')
            assert len(commands) == 2
            await page.wait_for_function(SIGNAL + ' < 0.02')
            await start.click()
            await page.locator('[data-voice-state="listening"]').wait_for()
            await page.evaluate("window.voiceInstances.at(-1).onerror({error:'not-allowed'})")
            await page.get_by_role('alert').filter(has_text='Microphone permission was denied').wait_for()
            assert not await page.evaluate('window.voiceInstances.some(r => r.active)')
            # Grant microphone access only after output has started. A stale
            # permission request must release its tracks without stealing the
            # playback analyser or stopping the waveform for the whole reply.
            late = await browser.new_page()
            late.on('pageerror', lambda error: errors.append(str(error)))
            await late.add_init_script(MOCK_RECOGNITION + '''
                const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                window.lateStreams = [];
                navigator.mediaDevices.getUserMedia = async (...args) => {
                    const media = await acquire(...args);
                    window.lateStreams.push(media);
                    await new Promise(resolve => { window.releaseLateMic = resolve; });
                    return media;
                };
            ''')
            await late.route('**/api/command/stream', command)
            await late.route('**/api/speech/audio', speech)
            await late.goto('http://127.0.0.1:8000')
            await late.get_by_role('button', name='Start listening', exact=True).click()
            await late.wait_for_function('typeof window.releaseLateMic === "function"')
            await late.evaluate("window.voiceInstances.at(-1).finish('Hello again')")
            await late.locator('[data-voice-state="speaking"]').wait_for()
            await late.wait_for_function(SIGNAL + ' > 0.15')
            await late.evaluate('window.releaseLateMic()')
            await late.wait_for_function('window.lateStreams.every(s => s.getTracks().every(t => t.readyState === "ended"))')
            await late.wait_for_function(SIGNAL + ' < 0.02 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await late.wait_for_function(SIGNAL + ' > 0.15 && !!document.querySelector(\'[data-voice-state="speaking"]\')')
            await late.get_by_role('button', name='End session', exact=True).click()
            await late.close()
            assert not errors, errors
            await browser.close()
            print('PASS: real microphone/PCM levels, silence sync, delayed permission cleanup, automatic submission, audio completion, approval pause, Stop and permission errors.')

asyncio.run(main())
