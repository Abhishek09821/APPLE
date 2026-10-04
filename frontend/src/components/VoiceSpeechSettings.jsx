import React, { useState } from 'react'
import { AudioLines, Check, Mic2, Play, Volume2, Zap, Bot, User, Sparkles } from 'lucide-react'

const VOICE_PERSONAS = [
  {
    id: 'hero',
    label: 'Hero',
    badge: 'Energetic & Witty',
    accent: 'Indian English / Native Hindi',
    description: 'Young, energetic, witty superhero-style voice with vibrant Indian intonation and cadence.',
    icon: Zap,
    color: '#e8a048',
    gradient: 'linear-gradient(135deg, rgba(232, 160, 72, 0.12), rgba(30, 25, 20, 0.8))',
    sampleHi: 'अरे भाई, tension मत लो! Main hoon na, tumhara Hero!',
    sampleEn: 'Hey! No worries, I got this. Your Hero is here to help!',
    sampleHinglish: 'Arre yaar, chill karo! Main handle kar lunga sab kuch!',
  },
  {
    id: 'jarvis',
    label: 'Jarvis',
    badge: 'Calm & Intelligent',
    accent: 'Indian English / Native Hindi',
    description: 'Deep, calm, intelligent voice crafted for precise assistance, clear reasoning, and composure.',
    icon: Bot,
    color: '#6ea8e8',
    gradient: 'linear-gradient(135deg, rgba(110, 168, 232, 0.12), rgba(20, 28, 38, 0.8))',
    sampleHi: 'सर, आपकी रिक्वेस्ट प्रोसेस हो रही है। कृपया प्रतीक्षा करें।',
    sampleEn: 'Sir, I have processed your request. Everything is in order.',
    sampleHinglish: 'Sir, aapki request process ho gayi hai. Sab kuch ready hai.',
  },
  {
    id: 'natural',
    label: 'Natural',
    badge: 'Warm & Friendly',
    accent: 'Indian English / Native Hindi',
    description: 'Friendly, natural Indian Hindi and English voice with authentic pronunciation and smooth flow.',
    icon: User,
    color: '#8ed8bb',
    gradient: 'linear-gradient(135deg, rgba(142, 216, 187, 0.12), rgba(20, 32, 28, 0.8))',
    sampleHi: 'नमस्ते! मैं आपकी मदद के लिए हमेशा तैयार हूँ।',
    sampleEn: 'Hello! I am always ready to help you with anything.',
    sampleHinglish: 'Namaste! Main aapki help ke liye hamesha ready hoon.',
  },
]

export default function VoiceSpeechSettings({
  voicePersona,
  setVoicePersona,
  speechRate,
  setSpeechRate,
  speechPitch,
  setSpeechPitch,
  speechVolume,
  setSpeechVolume,
  speak,
  muted,
}) {
  const [playingKey, setPlayingKey] = useState(null)

  async function previewVoice(persona, langKey, sampleText) {
    if (playingKey) return
    const key = `${persona.id}:${langKey}`
    setPlayingKey(key)
    try {
      await speak(sampleText, {
        persona: persona.id,
        speechRate,
        speechPitch,
        speechVolume,
      })
    } finally {
      setPlayingKey(null)
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-card-heading">
        <span className="suggestion-icon green">
          <Mic2 size={20} />
        </span>
        <div>
          <h3>Voice &amp; Speech</h3>
          <p>Select your persona and customize pronunciation, pitch, and speed</p>
        </div>
      </div>

      <div className="voice-persona-grid" role="radiogroup" aria-label="Voice persona">
        {VOICE_PERSONAS.map((persona) => {
          const Icon = persona.icon
          const selected = voicePersona === persona.id
          const isHiPlaying = playingKey === `${persona.id}:hi`
          const isEnPlaying = playingKey === `${persona.id}:en`
          const isHinglishPlaying = playingKey === `${persona.id}:hinglish`

          return (
            <div
              key={persona.id}
              className={`voice-persona-card ${selected ? 'selected' : ''}`}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              style={{ '--persona-color': persona.color, '--persona-bg': persona.gradient }}
              onClick={() => setVoicePersona(persona.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setVoicePersona(persona.id)
                }
              }}
            >
              <div className="voice-persona-header">
                <span className="voice-persona-icon">
                  <Icon size={18} />
                </span>
                <div className="voice-persona-meta">
                  <span className="voice-persona-name">{persona.label}</span>
                  <span className="voice-persona-badge">{persona.badge}</span>
                </div>
                {selected && (
                  <span className="voice-persona-check" title="Active Voice">
                    <Check size={14} />
                  </span>
                )}
              </div>

              <p className="voice-persona-desc">{persona.description}</p>
              <div className="voice-accent-tag">{persona.accent}</div>

              <div className="voice-preview-section">
                <span className="voice-preview-label">Preview Voice:</span>
                <div className="voice-preview-buttons">
                  <button
                    type="button"
                    className={`voice-preview-btn ${isHiPlaying ? 'playing' : ''}`}
                    disabled={muted || (!!playingKey && !isHiPlaying)}
                    onClick={(e) => {
                      e.stopPropagation()
                      previewVoice(persona, 'hi', persona.sampleHi)
                    }}
                    title="Preview Native Hindi pronunciation"
                  >
                    {isHiPlaying ? (
                      <AudioLines size={12} className="pulse-icon" />
                    ) : (
                      <Play size={11} />
                    )}
                    <span>हिन्दी</span>
                  </button>

                  <button
                    type="button"
                    className={`voice-preview-btn ${isEnPlaying ? 'playing' : ''}`}
                    disabled={muted || (!!playingKey && !isEnPlaying)}
                    onClick={(e) => {
                      e.stopPropagation()
                      previewVoice(persona, 'en', persona.sampleEn)
                    }}
                    title="Preview Indian English pronunciation"
                  >
                    {isEnPlaying ? (
                      <AudioLines size={12} className="pulse-icon" />
                    ) : (
                      <Play size={11} />
                    )}
                    <span>English</span>
                  </button>

                  <button
                    type="button"
                    className={`voice-preview-btn ${isHinglishPlaying ? 'playing' : ''}`}
                    disabled={muted || (!!playingKey && !isHinglishPlaying)}
                    onClick={(e) => {
                      e.stopPropagation()
                      previewVoice(persona, 'hinglish', persona.sampleHinglish)
                    }}
                    title="Preview Hinglish code-switching in the same sentence"
                  >
                    {isHinglishPlaying ? (
                      <AudioLines size={12} className="pulse-icon" />
                    ) : (
                      <Play size={11} />
                    )}
                    <span>Hinglish</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="voice-controls-section">
        <div className="voice-control-heading">
          <Volume2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Fine-tune Voice Dynamics
        </div>

        <label>
          Speed <span>{speechRate} words / min</span>
          <input
            aria-label="Speech speed"
            type="range"
            min="100"
            max="250"
            value={speechRate}
            onChange={(e) => setSpeechRate(Number(e.target.value))}
          />
        </label>

        <label>
          Pitch <span>{Math.round(speechPitch * 100)}%</span>
          <input
            aria-label="Speech pitch"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={speechPitch}
            onChange={(e) => setSpeechPitch(Number(e.target.value))}
          />
        </label>

        <label>
          Volume <span>{Math.round(speechVolume * 100)}%</span>
          <input
            aria-label="Speech volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={speechVolume}
            onChange={(e) => setSpeechVolume(Number(e.target.value))}
          />
        </label>
      </div>

      <p className="field-hint">
        Voice persona, speed, pitch and volume are saved when you press <strong>Save settings</strong>.
        Hindi pronunciation uses a native Indian Hindi voice with authentic phonemes, pauses, and intonation.
        Sentences with code-switching between Hindi, English, and Hinglish are automatically detected and spoken naturally.
      </p>
    </div>
  )
}
