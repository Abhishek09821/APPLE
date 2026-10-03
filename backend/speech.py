"""Short, readable speech and local PCM audio for synchronized browser playback."""
import asyncio
from collections import OrderedDict
from pathlib import Path
import re
import tempfile

EMOJI = re.compile('[\U0001f000-\U0001faff\u2600-\u27bf\u2300-\u23ff\ufe0e\ufe0f\u200d\u20e3]')
URL = re.compile(
    r'(?:https?://|www\.)\S+|\b[a-z0-9.-]+\.'
    r'(?:com|org|net|io|dev|company|network|app|ai|co|edu|gov|me|info|biz|xyz)'
    r'(?![\w-])(?:/\S*)?', re.I)
CACHE = OrderedDict()
SYNTHESIS = set()


def spoken_text(text, limit=440):
    """Keep content on screen; narrate a short plain-language version."""
    text = re.sub(r'```[\s\S]*?```', ' Code is on screen. ', text)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    text = URL.sub('', text)
    text = EMOJI.sub('', text)
    text = re.sub(r'^\s*(?:#{1,6}\s*|[-*>]\s+|\d+[.)]\s+)', '', text, flags=re.M)
    text = re.sub(r'[`*_~|]', '', text)
    text = re.sub(r'\s+([,.;:!?])', r'\1', text)
    text = re.sub(r'\s+', ' ', text).strip(' ,;:-')
    if not text or not any(c.isalnum() for c in text):
        return ''
    sentences = re.split(r'(?<=[.!?])\s+', text)
    short = ' '.join(sentences[:3])
    if len(short) > limit:
        short = short[:limit].rsplit(' ', 1)[0].rstrip(',;:-') + '.'
    if len(short) < len(text):
        short += ' The details are on screen.'
    return short


def spoken_result(reply, results):
    failed = next((result for result in results if result.get('success') is False), None)
    if failed:
        return spoken_text(failed.get('message') or reply)
    if len(results) > 1 and all(result.get('success') for result in results):
        return f'Done. Completed {len(results)} actions.'
    if len(results) == 1 and results[0].get('success'):
        result = results[0]
        action = result.get('action')
        target = result.get('target', '')
        if action in {'google_search', 'youtube_search'}:
            return spoken_text(f'Opened {"YouTube" if action == "youtube_search" else "search"} results for {target}.')
        if action == 'open_website':
            return 'Opened the website.'
        if action == 'open_file':
            return spoken_text(f'Opened {Path(target).name}.')
        if action == 'create_folder':
            return spoken_text(f'Created the folder {Path(target).name}.')
    return spoken_text(reply)


async def render_audio(text, rate):
    clean = spoken_text(text)
    if not clean:
        return b''
    key = (clean, rate)
    if key in CACHE:
        CACHE.move_to_end(key)
        return CACHE[key]
    with tempfile.TemporaryDirectory(prefix='apple-speech-') as directory:
        source = Path(directory) / 'speech.txt'
        target = Path(directory) / 'speech.wav'
        source.write_text(clean)
        process = await asyncio.create_subprocess_exec(
            'say', '-r', str(rate), '-f', str(source), '-o', str(target),
            '--file-format=WAVE', '--data-format=LEI16@22050',
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
        SYNTHESIS.add(process)
        try:
            _, error = await asyncio.wait_for(process.communicate(), 25)
            if process.returncode:
                raise ValueError('Could not prepare the spoken reply. Try again.')
            data = target.read_bytes()
        finally:
            SYNTHESIS.discard(process)
            if process.returncode is None:
                process.kill()
                await process.wait()
    CACHE[key] = data
    while len(CACHE) > 20:
        CACHE.popitem(last=False)
    return data


async def cancel_synthesis():
    for process in list(SYNTHESIS):
        if process.returncode is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
        await process.wait()
