"""Short, readable speech and local PCM audio for synchronized browser playback.

Voice engine with modular personas, automatic Hindi/English language detection,
and native macOS voice support for natural Hindi pronunciation.
"""
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

# ---------------------------------------------------------------------------
# Modular voice registry – add new voices by appending to this dict.
# Each persona maps a language tag to a native macOS voice.
# The engine auto-detects Hindi vs English in the text and picks the right
# voice from the persona's mapping.
# ---------------------------------------------------------------------------

VOICE_REGISTRY = {
    'hero': {
        'label': 'Hero',
        'description': 'Young, energetic, witty English superhero-style voice',
        'voices': {
            'en': 'Rishi',     # Indian English – en_IN (energetic male)
        },
        'base_pitch': {
            'en': 145,
        },
        'languages': ['en'],
        'engine': 'macos',
    },
    'jarvis': {
        'label': 'Jarvis',
        'description': 'Deep, calm, intelligent English voice',
        'voices': {
            'en': 'Aman',      # Indian English – en_IN (deeper calm male)
        },
        'base_pitch': {
            'en': 105,
        },
        'languages': ['en'],
        'engine': 'macos',
    },
    'natural': {
        'label': 'Natural',
        'description': 'Friendly, natural Indian English voice',
        'voices': {
            'en': 'Tara',      # Indian English – en_IN (natural female)
        },
        'base_pitch': {
            'en': 180,
        },
        'languages': ['en'],
        'engine': 'macos',
    },
    'my_voice': {
        'label': 'My Voice',
        'description': 'Personalized cloned voice using local IndicF5 for natural Hindi, English, and Hinglish',
        'voices': {
            'hi': 'my_voice',
            'en': 'my_voice',
            'hinglish': 'my_voice',
        },
        'base_pitch': {
            'en': 150,
            'hi': 150,
        },
        'languages': ['hi', 'en', 'hinglish'],
        'engine': 'indicf5',
    },
}

# ---------------------------------------------------------------------------
# Hindi / Devanagari & Hinglish detection
# ---------------------------------------------------------------------------

# Devanagari Unicode range (U+0900–U+097F) plus extended (U+A8E0–U+A8FF)
_DEVANAGARI = re.compile(r'[\u0900-\u097F\uA8E0-\uA8FF]')

# Common Hindi words written in Latin script (Hinglish)
_HINDI_LATIN = re.compile(
    r'\b(?:kya|kyu|kyun|kaise|kahan|kab|kaun|kitna|kitne|kitni|'
    r'nahi|nahin|haan|ha|na|accha|theek|sahi|galat|bahut|zyada|thoda|'
    r'aur|hai|hain|ho|hoon|tha|thi|the|hoga|hogi|honge|'
    r'mein|hum|humara|humari|humare|tum|tumhara|tumhari|tumhare|'
    r'aap|aapka|aapki|aapke|main|mera|meri|mere|yeh|ye|woh|wo|'
    r'iska|uski|iske|uske|jiska|jiski|jiske|'
    r'kar|karo|karna|karunga|karenge|kiya|diya|liya|le|lo|de|do|'
    r'bolo|boliye|dekho|dekh|chalo|chal|suno|batao|'
    r'abhi|bhai|yaar|dost|sirf|sab|sabse|kuch|'
    r'namaste|namaskar|dhanyavaad|dhanyawad|shukriya|'
    r'arre|are|mat|matlab|samajh|samjha|pakka|bilkul|'
    r'lekin|magar|par|phir|waise|isliye|zaroor)\b', re.I)


def detect_language(text):
    """Detect whether text is primarily Hindi or English.

    Returns 'hi' for Hindi/Devanagari-heavy text or Hinglish, 'en' otherwise.
    Supports Hindi, English, and Hinglish code-switching in the same sentence.
    """
    if not text:
        return 'en'

    # If any Devanagari characters are present, route to Hindi voice (Lekha)
    # to guarantee native Hindi phonemes, correct retroflexes and natural tone
    if _DEVANAGARI.search(text):
        return 'hi'

    # Check for Romanised Hindi (Hinglish)
    hindi_words = len(_HINDI_LATIN.findall(text))
    all_words = len(text.split())
    if all_words > 0 and (hindi_words / all_words >= 0.2 or hindi_words >= 2):
        return 'hi'

    return 'en'


def get_voice_for_persona(persona, text):
    """Pick the voice identifier for a persona given the text content.

    Falls back to 'natural' persona if persona is unknown.
    Returns None if an English-only persona is asked to speak Hindi/Hinglish.
    """
    entry = VOICE_REGISTRY.get(persona, VOICE_REGISTRY['natural'])
    if entry.get('engine') == 'indicf5':
        return persona
    lang = detect_language(text)
    if lang == 'hi':
        # Hero, Jarvis, Natural are English-only voices and cannot be used for Hindi or Hinglish
        return None
    voices = entry.get('voices')
    if isinstance(voices, dict):
        v = voices.get('en')
        return str(v) if v else None
    return None


def _compute_pitch_hz(persona, lang, pitch_multiplier):
    """Compute the macOS `say` base pitch in Hz.

    `pitch_multiplier` is the user's 0.5–2.0 slider value.
    Scales the persona- and language-specific base frequency.
    """
    entry = VOICE_REGISTRY.get(persona, VOICE_REGISTRY['natural'])
    base_dict = entry.get('base_pitch')
    base = base_dict.get(lang, 150) if isinstance(base_dict, dict) else 150
    hz = int(base * pitch_multiplier)
    return max(50, min(320, hz))


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


async def render_audio(text, rate, persona='natural', pitch=1.0, volume=1.0):
    """Render text to WAV audio using either IndicF5 or macOS `say`.

    Args:
        text: The text to speak.
        rate: Words per minute (100–250).
        persona: Voice persona key ('hero', 'jarvis', 'natural', 'my_voice').
        pitch: Pitch multiplier (0.5–2.0).
        volume: Output volume (0.0–1.0, scaled in 16-bit PCM).
    """
    clean = spoken_text(text)
    if not clean:
        return b'', clean
    entry = VOICE_REGISTRY.get(persona, VOICE_REGISTRY['natural'])

    # Handle local IndicF5 cloned voices (My Voice)
    if entry.get('engine') == 'indicf5' or persona == 'my_voice':
        from voice_clone import render_indicf5_audio
        return await render_indicf5_audio(clean, voice_id=persona, rate=rate, pitch=pitch, volume=volume)

    # Hero, Jarvis, and Natural are strictly English-only voices
    # Do not use Hero/Jarvis/Natural for Hindi or Hinglish
    lang = detect_language(clean)
    if lang == 'hi':
        return b'', clean

    voices = entry.get('voices')
    raw_voice = voices.get('en') if isinstance(voices, dict) else None
    if not isinstance(raw_voice, str) or not raw_voice:
        return b'', clean
    voice_name = raw_voice

    pitch_hz = _compute_pitch_hz(persona, 'en', pitch)
    key = (clean, rate, persona, pitch_hz, voice_name, round(volume, 2))
    if key in CACHE:
        CACHE.move_to_end(key)
        return CACHE[key], clean
    with tempfile.TemporaryDirectory(prefix='apple-speech-') as directory:
        source = Path(directory) / 'speech.txt'
        target = Path(directory) / 'speech.wav'
        # Prepend macOS speech synthesis pitch tag
        text_with_pitch = f'[[pbas {pitch_hz}]] {clean}' if pitch_hz else clean
        source.write_text(text_with_pitch)

        process = await asyncio.create_subprocess_exec(
            'say',
            '-v', voice_name,
            '-r', str(rate),
            '-f', str(source),
            '-o', str(target),
            '--file-format=WAVE',
            '--data-format=LEI16@22050',
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
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

    # Apply volume scaling inline if volume < 0.99 (PCM 16-bit LE samples)
    if volume < 0.99 and len(data) > 44:
        import struct
        header = data[:44]
        samples = data[44:]
        scaled = bytearray(len(samples))
        for i in range(0, len(samples) - 1, 2):
            sample = struct.unpack_from('<h', samples, i)[0]
            sample = int(sample * volume)
            sample = max(-32768, min(32767, sample))
            struct.pack_into('<h', scaled, i, sample)
        data = header + bytes(scaled)

    CACHE[key] = data
    while len(CACHE) > 20:
        CACHE.popitem(last=False)
    return data, clean


async def cancel_synthesis():
    for process in list(SYNTHESIS):
        if process.returncode is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
        await process.wait()


def list_voices():
    """Return available voice personas for the frontend settings UI."""
    return [
        {
            'id': key,
            'label': entry['label'],
            'description': entry['description'],
            'voices': entry['voices'],
            'languages': entry.get('languages', ['en']),
            'engine': entry.get('engine', 'macos'),
        }
        for key, entry in VOICE_REGISTRY.items()
    ]
