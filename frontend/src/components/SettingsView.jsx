import React, { useEffect, useState } from 'react'
import {
  AudioLines,
  Check,
  ShieldCheck,
  Sparkles,
  Volume2,
  Sun,
  Moon,
  PictureInPicture2,
} from 'lucide-react'
import { api } from '../utils/api'
import SavedContacts from './SavedContacts'
import ProfileCard from './ProfileCard'
import { colorThemes } from '../hooks/usePreferences'

export default function SettingsView({
  status,
  profile,
  onSaveProfile,
  onTour,
  model,
  setModel,
  refresh,
  setNotice,
  voice,
  toggleVoice,
  speechRate,
  setSpeechRate,
  speechLanguage,
  setSpeechLanguage,
  speak,
  working,
  doWork,
  memories = [],
  automation,
  setAutomation,
  autoTutor,
  setAutoTutor,
  preferences,
  onSound,
  onFloat,
  floatingSupported,
  expressiveVoice,
  setExpressiveVoice,
}) {
  const [permissions, setPermissions] = useState(null)
  useEffect(() => {
    api('/permissions')
      .then(setPermissions)
      .catch(() => setPermissions(null))
  }, [])
  return (
    <div className="page-content settings-page">
      <div className="page-heading">
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>
          Your assistant. Your way<span>.</span>
        </h1>
        <p>Connect your local intelligence and find your voice.</p>
      </div>
      <ProfileCard profile={profile} onSave={onSaveProfile} onTour={onTour} />
      <div className="settings-card">
        <h3>Make it feel like you</h3>
        <p className="field-hint">
          Appearance and interface sound preferences save automatically in this browser.
        </p>
        <div className="preference-grid" role="group" aria-label="Appearance">
          <button
            className={`preference-choice ${preferences.theme === 'light' ? 'selected' : ''}`}
            aria-pressed={preferences.theme === 'light'}
            onClick={() => preferences.setTheme('light')}
          >
            <Sun size={22} />
            Light
          </button>
          <button
            className={`preference-choice ${preferences.theme === 'dark' ? 'selected' : ''}`}
            aria-pressed={preferences.theme === 'dark'}
            onClick={() => preferences.setTheme('dark')}
          >
            <Moon size={22} />
            Dark
          </button>
        </div>
        <div className="color-theme-heading">Color theme</div>
        <div className="color-theme-grid" role="group" aria-label="Color theme">
          {colorThemes.map(({ id, label, color }) => (
            <button
              key={id}
              className="color-theme-choice"
              aria-label={`${label} color theme`}
              aria-pressed={preferences.palette === id}
              onClick={() => preferences.setPalette(id)}
            >
              <span className="color-theme-swatch" style={{ '--swatch': color }}>
                {preferences.palette === id && <Check size={14} />}
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="setting-row">
          <div>
            <strong>App sound</strong>
            <p>
              The speaker button mutes speech and clicks together. Your individual settings stay
              saved.
            </p>
          </div>
          <button
            className={`toggle ${!preferences.muted ? 'on' : ''}`}
            role="switch"
            aria-checked={!preferences.muted}
            aria-label="App sound"
            data-audio-toggle
            onClick={onSound}
          >
            <span />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Interface sounds</strong>
            <p>
              Optional, quiet taps on buttons and controls. Scrolling is always silent; voice
              sessions stay quiet too.
            </p>
          </div>
          <button
            className={`toggle ${preferences.sounds ? 'on' : ''}`}
            role="switch"
            aria-checked={preferences.sounds}
            aria-label="Interface sounds"
            onClick={() => preferences.setSounds(!preferences.sounds)}
          >
            <span />
          </button>
        </div>
        <label>
          Sound level <span>{Math.round(preferences.soundVolume * 100)}%</span>
          <input
            aria-label="Interface sound volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={preferences.soundVolume}
            onChange={(e) => preferences.setSoundVolume(Number(e.target.value))}
          />
        </label>
        <div className="setting-row">
          <div>
            <strong>A companion above your other windows</strong>
            <p>
              {floatingSupported
                ? 'Drag its title bar anywhere. Voice and replies stay in sync with this tab.'
                : 'Open APPLE in desktop Chrome to use the floating companion.'}
            </p>
          </div>
        </div>
        <button className="secondary-button" disabled={!floatingSupported} onClick={onFloat}>
          <PictureInPicture2 size={16} />
          Float assistant
        </button>
        <p className="field-hint">
          Keep this tab open. Closing the companion ends its voice session; Return to APPLE keeps it
          going.
        </p>
      </div>
      <div className="settings-card">
        <div className="settings-card-heading">
          <span className="suggestion-icon purple">
            <Sparkles size={20} />
          </span>
          <div>
            <h3>Local intelligence</h3>
            <p>Powered by Ollama on this computer</p>
          </div>
          <span className={`tag ${status?.ai?.ready ? 'green' : 'amber'}`}>
            {status?.ai?.ready ? 'CONNECTED' : 'SETUP NEEDED'}
          </span>
        </div>
        <p>
          Start Ollama and download a model. Basic searches and app launches also work without a
          model.
        </p>
        <div className="code-block">
          ollama pull qwen3:8b
          <br />
          ollama serve
        </div>
        <label>
          Model name
          <input
            list="models"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="qwen3:8b"
          />
          <datalist id="models">
            {status?.ai?.models?.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <p className="field-hint">
          Use the exact name of a downloaded model. Choose a model that fits your Mac’s memory.
        </p>
        <button
          className="secondary-button"
          onClick={async () => {
            await refresh()
            setNotice('Connection checked.')
          }}
        >
          Check connection
        </button>
      </div>
      <div className="settings-card">
        <div className="settings-card-heading">
          <span className="suggestion-icon blue">
            <AudioLines size={20} />
          </span>
          <div>
            <h3>A voice to go with the ideas</h3>
            <p>Spoken replies through the native macOS voice</p>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <strong>Read replies aloud</strong>
            <p>Uses your Mac’s default voice.</p>
          </div>
          <button
            className={`toggle ${voice ? 'on' : ''}`}
            role="switch"
            aria-checked={voice}
            aria-label="Read replies aloud"
            onClick={toggleVoice}
          >
            <span />
          </button>
        </div>
        <label>
          Speaking rate <span>{speechRate} words / minute</span>
          <input
            type="range"
            min="100"
            max="250"
            value={speechRate}
            onChange={(e) => setSpeechRate(Number(e.target.value))}
          />
        </label>
        <div className="setting-row">
          <div>
            <strong>Conversational expression</strong>
            <p>Natural, occasional “hmm” and “yeah” when they fit. Save settings to apply.</p>
          </div>
          <button
            className={`toggle ${expressiveVoice ? 'on' : ''}`}
            role="switch"
            aria-checked={expressiveVoice}
            aria-label="Conversational expression"
            onClick={() => setExpressiveVoice(!expressiveVoice)}
          >
            <span />
          </button>
        </div>
        <label>
          Spoken language
          <select
            aria-label="Spoken language"
            value={speechLanguage}
            onChange={(e) => setSpeechLanguage(e.target.value)}
          >
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (India)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </label>
        <p className="field-hint">
          Choose the language you speak most. This setting saves automatically.
        </p>
        <button
          className="secondary-button"
          disabled={preferences.muted}
          onClick={() =>
            speak(
              expressiveVoice
                ? 'Hmm… yeah, I can help with that. I’m Apple. What shall we do today?'
                : 'Hello. I’m Apple, your personal assistant. What shall we do today?',
            )
          }
        >
          <Volume2 size={15} />
          Try the voice
        </button>
        <p className="field-hint">
          Microphone dictation uses your browser’s speech service and may send audio to its
          provider. Start a voice session to submit speech automatically, hear replies, and continue
          hands-free. With speaker echo cancellation available, speak during a reply to interrupt.
          Otherwise, APPLE listens between replies and offers an Interrupt button.
        </p>
      </div>
      <div className="settings-card">
        <div className="settings-card-heading">
          <span className="suggestion-icon amber">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h3>Connected to your world</h3>
            <p>Explicit tools for real computer actions</p>
          </div>
        </div>
        <div className="capability-row">
          <span>Apps, web search & local files</span>
          <span className="tag green">macOS</span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Trusted automation</strong>
            <p>
              Run your requested app actions and messages without asking again. You can stop or
              revoke this anytime.
            </p>
          </div>
          <button
            className={`toggle ${automation ? 'on' : ''}`}
            role="switch"
            aria-checked={automation}
            aria-label="Trusted automation"
            onClick={() => setAutomation(!automation)}
          >
            <span />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Teach me after upload</strong>
            <p>Ask questions aloud, listen to your answers, and explain the result.</p>
          </div>
          <button
            className={`toggle ${autoTutor ? 'on' : ''}`}
            role="switch"
            aria-checked={autoTutor}
            aria-label="Teach me after upload"
            onClick={() => setAutoTutor(!autoTutor)}
          >
            <span />
          </button>
        </div>
        <div className="capability-row">
          <span>WhatsApp messaging</span>
          <span className="tag amber">INSTALLED MAC APP</span>
        </div>
        <div className="capability-row">
          <span>Typing in supported apps</span>
          <span className="tag">ACCESSIBILITY PERMISSION</span>
        </div>
        <p className="field-hint">
          Allow the launching terminal or Python app in System Settings → Privacy & Security →
          Accessibility when using typing controls. WhatsApp uses the installed Mac app and requires
          Accessibility access to select chats. App layouts can change; failures are reported
          without claiming success.
        </p>
        <div className="capability-row">
          <span>Accessibility connection</span>
          <span className={`tag ${permissions?.accessibility ? 'green' : 'amber'}`}>
            {permissions?.accessibility ? 'CONNECTED' : 'CHECK ACCESS'}
          </span>
        </div>
        {!permissions?.accessibility && (
          <button
            className="secondary-button"
            onClick={() =>
              doWork(async () => {
                await api('/permissions/accessibility', { method: 'POST' })
                setNotice('Enable the app that starts APPLE in Accessibility, then check again.')
              })
            }
          >
            Open Accessibility settings
          </button>
        )}
        <button
          className="subtle-button"
          onClick={() => doWork(async () => setPermissions(await api('/permissions')))}
        >
          Check permissions
        </button>
        <p className="field-hint">
          APPLE can discover installed apps and work with their accessible controls. Some apps do
          not expose controls; a macOS Shortcut can cover those workflows. System permission prompts
          are managed by macOS.
        </p>
      </div>
      <div className="settings-card">
        <h3>Memory</h3>
        <p>
          Say “remember that…” to save a fact for future conversations. Documents stay in your
          library.
        </p>
        {memories.length ? (
          memories.map((memory) => (
            <div className="setting-row" key={memory.id}>
              <p>{memory.text}</p>
              <button
                className="subtle-button"
                onClick={() =>
                  doWork(async () => {
                    await api(`/memories/${memory.id}`, { method: 'DELETE' })
                    await refresh()
                  })
                }
              >
                Forget
              </button>
            </div>
          ))
        ) : (
          <p className="field-hint">No saved facts yet.</p>
        )}
      </div>
      <SavedContacts />
      <button
        className="primary-button"
        disabled={working || !model.trim()}
        onClick={() =>
          doWork(async () => {
            await api('/settings', {
              method: 'PUT',
              body: JSON.stringify({
                model: model.trim(),
                voice,
                speech_rate: speechRate,
                expressive_voice: expressiveVoice,
                automation_enabled: automation,
                setup_completed: true,
                auto_tutor: autoTutor,
              }),
            })
            await refresh()
            setNotice('Your settings are saved.')
          })
        }
      >
        <Check size={15} />
        Save settings
      </button>
    </div>
  )
}
