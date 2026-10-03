import React, { useEffect, useState } from 'react'
import { AudioLines, Check, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import { api } from '../utils/api'
import SavedContacts from './SavedContacts'

export default function SettingsView({
  status,
  model,
  setModel,
  refresh,
  setNotice,
  voice,
  toggleVoice,
  speechRate,
  setSpeechRate,
  speak,
  working,
  doWork,
  memories = [],
  automation,
  setAutomation,
  autoTutor,
  setAutoTutor,
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
        <button
          className="secondary-button"
          onClick={() =>
            speak('Hello. I’m Apple, your personal assistant. What shall we do today?')
          }
        >
          <Volume2 size={15} />
          Try the voice
        </button>
        <p className="field-hint">
          Microphone dictation uses your browser’s speech service and may send audio to its
          provider. Start a voice session to submit speech automatically, hear replies, and continue
          hands-free. Chrome is recommended. Speak during a reply to interrupt it; headphones help
          prevent speaker echo from being mistaken for your voice.
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
