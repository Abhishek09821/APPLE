import React, { useState } from 'react'
import { AudioLines, Check, Mic2, Play, Volume2, Zap, Bot, User, Sparkles } from 'lucide-react'

const VOICE_PERSONAS = [
  {
    id: 'hero',
    label: 'Hero',
    badge: 'Energetic & Witty',
    accent: 'English',
    description: 'Young, energetic, witty English superhero-style voice with vibrant cadence.',
    icon: Zap,
    color: '#e8a048',
    gradient: 'linear-gradient(135deg, rgba(232, 160, 72, 0.12), rgba(30, 25, 20, 0.8))',
    sampleEn: 'Hey! No worries, I got this. Your Hero is here to help!',
  },
  {
    id: 'jarvis',
    label: 'Jarvis',
    badge: 'Calm & Intelligent',
    accent: 'English',
    description: 'Deep, calm, intelligent English voice crafted for precise assistance.',
    icon: Bot,
    color: '#6ea8e8',
    gradient: 'linear-gradient(135deg, rgba(110, 168, 232, 0.12), rgba(20, 28, 38, 0.8))',
    sampleEn: 'Sir, I have processed your request. Everything is in order.',
  },
  {
    id: 'natural',
    label: 'Natural',
    badge: 'Warm & Friendly',
    accent: 'English',
    description: 'Friendly, natural English voice with clear articulation and smooth flow.',
    icon: User,
    color: '#8ed8bb',
    gradient: 'linear-gradient(135deg, rgba(142, 216, 187, 0.12), rgba(20, 32, 28, 0.8))',
    sampleEn: 'Hello! I am always ready to help you with anything.',
  },
  {
    id: 'my_voice',
    label: 'My Voice',
    badge: 'Voice Clone • IndicF5',
    accent: 'Hindi / English / Hinglish',
    description: 'Personalized cloned voice powered by local IndicF5 with natural Hindi, English, and Hinglish pronunciation.',
    icon: Mic2,
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.16), rgba(32, 22, 45, 0.85))',
    sampleHi: 'नमस्ते! मैं आपका पर्सनल AI असिस्टेंट हूँ। आज हम क्या करेंगे?',
    sampleEn: 'Hello Abhishek! Your personal voice clone is ready. How can I help you today?',
    sampleHinglish: 'Namaste! Main aapka AI assistant hoon. Aaj ka task start karein?',
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
              onClick={() => {
                setVoicePersona(persona.id)
                if (!playingKey && !muted) {
                  if (persona.id === 'my_voice') {
                    previewVoice(persona, 'hi', persona.sampleHi)
                  } else {
                    previewVoice(persona, 'en', persona.sampleEn)
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setVoicePersona(persona.id)
                  if (!playingKey && !muted) {
                    if (persona.id === 'my_voice') {
                      previewVoice(persona, 'hi', persona.sampleHi)
                    } else {
                      previewVoice(persona, 'en', persona.sampleEn)
                    }
                  }
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
                  {persona.sampleHi && (
                    <button
                      type="button"
                      className={`voice-preview-btn ${isHiPlaying ? 'playing' : ''}`}
                      disabled={muted || (!!playingKey && !isHiPlaying)}
                      onClick={(e) => {
                        e.stopPropagation()
                        previewVoice(persona, 'hi', persona.sampleHi)
                      }}
                      title="Preview Hindi pronunciation"
                    >
                      {isHiPlaying ? (
                        <AudioLines size={12} className="pulse-icon" />
                      ) : (
                        <Play size={11} />
                      )}
                      <span>हिन्दी</span>
                    </button>
                  )}

                  {persona.sampleEn && (
                    <button
                      type="button"
                      className={`voice-preview-btn ${isEnPlaying ? 'playing' : ''}`}
                      disabled={muted || (!!playingKey && !isEnPlaying)}
                      onClick={(e) => {
                        e.stopPropagation()
                        previewVoice(persona, 'en', persona.sampleEn)
                      }}
                      title="Preview English pronunciation"
                    >
                      {isEnPlaying ? (
                        <AudioLines size={12} className="pulse-icon" />
                      ) : (
                        <Play size={11} />
                      )}
                      <span>English</span>
                    </button>
                  )}

                  {persona.sampleHinglish && (
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
                  )}
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
