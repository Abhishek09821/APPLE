"""IndicF5 Local Voice Cloning Engine.

Provides voice cloning using AI4Bharat IndicF5 architecture for natural
Hindi, English, and Hinglish speech synthesis with authentic Indian pronunciation
and code-switching. Modular design allows adding more voices in backend/assets/voices/<voice_id>.
"""
import asyncio
from collections import OrderedDict
import io
import os
from pathlib import Path
import re
import subprocess
import threading
import numpy as np
import soundfile as sf
import torch
import torchaudio

# Monkey-patch torchaudio.load and save using soundfile to prevent TorchCodec requirement in Python 3.14
def _sf_load(uri, **kwargs):
    data, sr = sf.read(str(uri), dtype='float32')
    if data.ndim == 1:
        tensor = torch.from_numpy(data).unsqueeze(0)
    else:
        tensor = torch.from_numpy(data.T)
    return tensor, sr

def _sf_save(uri, src, sample_rate, **kwargs):
    arr = src.detach().cpu().numpy()
    if arr.ndim == 2:
        arr = arr.T
    sf.write(str(uri), arr, sample_rate)

setattr(torchaudio, 'load', _sf_load)
setattr(torchaudio, 'save', _sf_save)

VOICES_DIR = Path(__file__).parent / 'assets' / 'voices'
DEFAULT_VOICE_ID = 'my_voice'
CACHE = OrderedDict()
CACHE_LOCK = threading.Lock()

# Global model singletons
_INDICF5_MODEL = None
_INDICF5_VOCODER = None
_MODEL_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.Lock()
_DEVICE = None


def get_device():
    global _DEVICE
    if _DEVICE is None:
        if torch.backends.mps.is_available():
            _DEVICE = torch.device('mps')
        elif torch.cuda.is_available():
            _DEVICE = torch.device('cuda')
        else:
            _DEVICE = torch.device('cpu')
    return _DEVICE


def preprocess_reference_voice(voice_id=DEFAULT_VOICE_ID):
    """Automatically convert and preprocess reference audio for a voice persona.

    Converts reference.m4a (or .mp3/.aac) to 24kHz mono PCM WAV.
    Extracts optimal 6-12s reference clips for Hindi/Hinglish and English prompts.
    """
    vdir = VOICES_DIR / voice_id
    vdir.mkdir(parents=True, exist_ok=True)

    ref_m4a = vdir / 'reference.m4a'
    ref_wav = vdir / 'reference.wav'
    ref_txt_file = vdir / 'reference.txt'

    # Convert .m4a to 24kHz mono WAV if needed
    if ref_m4a.exists() and (not ref_wav.exists() or ref_wav.stat().st_mtime < ref_m4a.stat().st_mtime):
        cmd = [
            'ffmpeg', '-y',
            '-i', str(ref_m4a),
            '-ar', '24000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            str(ref_wav)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)

    ref_text = ''
    if ref_txt_file.exists():
        ref_text = ref_txt_file.read_text(encoding='utf-8').strip()

    # Create optimal clip for IndicF5 (F5-TTS requires ~6-14s reference audio)
    clip_wav = vdir / 'reference_clip.wav'
    clip_txt = vdir / 'reference_clip.txt'
    clip_en_wav = vdir / 'reference_en.wav'
    clip_en_txt = vdir / 'reference_en.txt'

    if ref_wav.exists():
        data, sr = sf.read(ref_wav)
        total_sec = len(data) / sr

        if total_sec <= 14.0:
            if not clip_wav.exists():
                sf.write(clip_wav, data, sr)
            if not clip_txt.exists() and ref_text:
                clip_txt.write_text(ref_text, encoding='utf-8')
        else:
            # Multi-sentence long reference audio (e.g. 58s file)
            # Clip 1: Primary Hindi/Hinglish clip (2.0s to 11.2s: "Namaste, mera naam Abhishek hai...")
            if not clip_wav.exists():
                seg_hi = data[int(2.0 * sr):int(11.2 * sr)]
                sf.write(clip_wav, seg_hi, sr)
            if not clip_txt.exists():
                clip_txt.write_text(
                    "Namaste, mera naam Abhishek hai. Main apne personal AI assistant ke liye apni voice ka model bana raha hoon.",
                    encoding='utf-8'
                )

            # Clip 2: English clip (44.2s to 54.4s: "Hello, I am Abhishek. I am currently in 12th standard.")
            if not clip_en_wav.exists():
                seg_en = data[int(44.2 * sr):int(54.4 * sr)]
                sf.write(clip_en_wav, seg_en, sr)
            if not clip_en_txt.exists():
                clip_en_txt.write_text(
                    "Hello, I am Abhishek. I am currently in 12th standard.",
                    encoding='utf-8'
                )

    return {
        'ref_wav': ref_wav if ref_wav.exists() else None,
        'clip_wav': clip_wav if clip_wav.exists() else ref_wav,
        'clip_txt': clip_txt.read_text(encoding='utf-8') if clip_txt.exists() else ref_text,
        'clip_en_wav': clip_en_wav if clip_en_wav.exists() else clip_wav,
        'clip_en_txt': clip_en_txt.read_text(encoding='utf-8') if clip_en_txt.exists() else ref_text,
    }


def get_indicf5_model():
    """Load IndicF5 DiT model + CFM pipeline on demand (singleton)."""
    global _INDICF5_MODEL
    if _INDICF5_MODEL is not None:
        return _INDICF5_MODEL

    with _MODEL_LOCK:
        if _INDICF5_MODEL is not None:
            return _INDICF5_MODEL

        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file
        from f5_tts.model.cfm import CFM
        from f5_tts.model.backbones.dit import DiT
        from f5_tts.model.utils import get_tokenizer

        device = get_device()

        # Try mirror or primary HF repo
        repo_id = os.getenv('INDICF5_REPO_ID', 'rsolanki1822/IndicF5-mirror')
        try:
            vocab_path = hf_hub_download(repo_id=repo_id, filename='checkpoints/vocab.txt')
        except Exception:
            vocab_path = hf_hub_download(repo_id='ai4bharat/IndicF5', filename='checkpoints/vocab.txt')

        try:
            ckpt_path = hf_hub_download(repo_id=repo_id, filename='model.safetensors')
        except Exception:
            ckpt_path = hf_hub_download(repo_id='ai4bharat/IndicF5', filename='model.safetensors')

        vocab_char_map, vocab_size = get_tokenizer(vocab_path, tokenizer='custom')

        transformer = DiT(
            dim=1024,
            depth=22,
            heads=16,
            ff_mult=2,
            text_dim=512,
            conv_layers=4,
            text_num_embeds=vocab_size,
            mel_dim=100,
        )

        model = CFM(
            transformer=transformer,
            mel_spec_kwargs=dict(
                n_fft=1024,
                hop_length=256,
                win_length=1024,
                n_mel_channels=100,
                target_sample_rate=24000,
                mel_spec_type='vocos',
            ),
            odeint_kwargs=dict(method='euler'),
            vocab_char_map=vocab_char_map,
        )

        state_dict = load_file(ckpt_path)
        cleaned = {}
        for k, v in state_dict.items():
            if k.startswith('ema_model.'):
                k = k[10:]
            if k in ('initted', 'step', 'mel_spec.mel_stft.mel_scale.fb', 'mel_spec.mel_stft.spectrogram.window'):
                continue
            cleaned[k] = v

        model.load_state_dict(cleaned, strict=False)

        try:
            model = model.to(device).eval()
        except Exception:
            # Fall back to CPU if MPS encounters tensor allocation issues
            device = torch.device('cpu')
            model = model.to(device).eval()

        _INDICF5_MODEL = model
        return _INDICF5_MODEL


def get_indicf5_vocoder():
    """Load vocos vocoder on demand (singleton)."""
    global _INDICF5_VOCODER
    if _INDICF5_VOCODER is not None:
        return _INDICF5_VOCODER

    with _MODEL_LOCK:
        if _INDICF5_VOCODER is not None:
            return _INDICF5_VOCODER

        from f5_tts.infer.utils_infer import load_vocoder
        device = get_device()
        vocoder = load_vocoder('vocos', is_local=False, device=device)
        _INDICF5_VOCODER = vocoder
        return _INDICF5_VOCODER


def _synthesize_sync(text, voice_id=DEFAULT_VOICE_ID, rate=175, pitch=1.0, volume=1.0):
    """Synchronous inference worker executed in a worker thread.

    Thread-safe serialization via _INFERENCE_LOCK prevents Apple Silicon
    MTLCommandBuffer concurrent encoder collisions.
    """
    with _INFERENCE_LOCK:
        from f5_tts.infer.utils_infer import infer_process
        from speech import detect_language

        # Prepare reference audio and clip
        info = preprocess_reference_voice(voice_id)
        lang = detect_language(text)

        # Use pure English clip when speaking pure English, otherwise use Hindi/Hinglish clip
        if lang == 'en' and info.get('clip_en_wav') and info['clip_en_wav'].exists():
            ref_file = str(info['clip_en_wav'])
            ref_text = info['clip_en_txt']
        else:
            ref_file = str(info['clip_wav'])
            ref_text = info['clip_txt']

        model = get_indicf5_model()
        vocoder = get_indicf5_vocoder()
        device = next(model.parameters()).device

        # Calculate speed factor based on speech rate (baseline 175 wpm = 1.0)
        speed = max(0.7, min(1.5, rate / 175.0))

        if device.type == 'mps':
            torch.mps.synchronize()

        try:
            audio, sr, _ = infer_process(
                ref_file,
                ref_text,
                text,
                model,
                vocoder,
                mel_spec_type='vocos',
                speed=speed,
                device=device,
                nfe_step=16,
                show_info=lambda *a: None,
            )
            if device.type == 'mps':
                torch.mps.synchronize()
        except Exception:
            # Fall back to CPU execution if device ran out of memory or encountered MPS issue
            if device.type != 'cpu':
                cpu_device = torch.device('cpu')
                model.to(cpu_device)
                vocoder.to(cpu_device)
                audio, sr, _ = infer_process(
                    ref_file,
                    ref_text,
                    text,
                    model,
                    vocoder,
                    mel_spec_type='vocos',
                    speed=speed,
                    device=cpu_device,
                    nfe_step=16,
                    show_info=lambda *a: None,
                )
                # Restore device
                model.to(device)
                vocoder.to(device)
            else:
                raise
        finally:
            if device.type == 'mps':
                torch.mps.empty_cache()

    audio_arr = np.array(audio, dtype=np.float32)

    # Apply volume scaling
    if volume < 0.99:
        audio_arr = audio_arr * volume

    # Export to WAV bytes in memory
    buf = io.BytesIO()
    sf.write(buf, audio_arr, samplerate=24000, format='WAV', subtype='PCM_16')
    return buf.getvalue()


async def render_indicf5_audio(text, voice_id=DEFAULT_VOICE_ID, rate=175, pitch=1.0, volume=1.0):
    """Render spoken audio using IndicF5 zero-shot voice cloning.

    Returns:
        tuple[bytes, str]: (wav_data, clean_text)
    """
    if not text or not text.strip():
        return b'', ''

    key = (voice_id, text.strip(), rate, round(pitch, 2), round(volume, 2))
    with CACHE_LOCK:
        if key in CACHE:
            CACHE.move_to_end(key)
            return CACHE[key], text

    # Run heavy synthesis in a thread pool to avoid blocking the event loop
    wav_bytes = await asyncio.to_thread(_synthesize_sync, text, voice_id, rate, pitch, volume)

    with CACHE_LOCK:
        CACHE[key] = wav_bytes
        while len(CACHE) > 20:
            CACHE.popitem(last=False)

    return wav_bytes, text


def warm_up_indicf5():
    """Pre-warm IndicF5 model in the background on startup."""
    try:
        preprocess_reference_voice(DEFAULT_VOICE_ID)
        get_indicf5_model()
        get_indicf5_vocoder()
    except Exception:
        pass
