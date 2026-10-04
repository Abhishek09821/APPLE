import SettingsView from './components/SettingsView'
import ActivityView from './components/ActivityView'
import RoutinesView from './components/RoutinesView'
import LibraryView from './components/LibraryView'
import React, { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import VoiceStage from './components/VoiceStage'
import VoiceTutor from './components/VoiceTutor'
import AutomationSetup from './components/AutomationSetup'
import WelcomeFlow from './components/WelcomeFlow'
import './tutor.css'
import AmbientField from './components/AmbientField'
import RevealNav from './components/RevealNav'
import ProductPages, { publicViews } from './components/ProductPages'
import FloatingAssistant from './components/FloatingAssistant'
import { useFloatingAssistant } from './hooks/useFloatingAssistant'
import { usePreferences } from './hooks/usePreferences'
import { useInterfaceSounds } from './hooks/useInterfaceSounds'
import { useVoiceTutor } from './hooks/useVoiceTutor'
import { PlaybackEchoGuard } from './utils/speech-echo'
import { useVoiceSession } from './hooks/useVoiceSession'
import { useAudioEngine } from './hooks/useAudioEngine'
import './console-shell.css'
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  HelpCircle as CircleHelp,
  Command,
  FileText,
  History,
  Home,
  Mail,
  Layers,
  Loader2,
  Mic,
  Plus,
  Settings2,
  ShieldCheck,
  Square,
  Volume2,
  X,
} from 'lucide-react'
import { api, stream } from './utils/api'
import { IconButton } from './components/ui'

const navigation = [
  { id: 'home', label: 'About APPLE', icon: Home },
  { id: 'assistant', label: 'Assistant', icon: Command },
  { id: 'library', label: 'Knowledge library', icon: BookOpen },
  { id: 'routines', label: 'My routines', icon: Layers },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'contact', label: 'Contact & support', icon: Mail },
  { id: 'faq', label: 'FAQs', icon: CircleHelp },
  { id: 'privacy', label: 'Privacy policy', icon: ShieldCheck },
]
const routeView = () => {
  const id = window.location.hash.slice(1)
  return [...navigation.map((item) => item.id), 'settings'].includes(id) ? id : 'home'
}
const initialMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'A little less doing.\nA little more living.',
  welcome: true,
}
const actionLabel = (a) =>
  ({
    open_app: 'Open application',
    open_website: 'Open website',
    google_search: 'Search Google',
    youtube_search: 'Search YouTube',
    find_file: 'Find files',
    open_file: 'Open file',
    create_folder: 'Create folder',
    whatsapp_send: 'Send WhatsApp message',
    whatsapp_open: 'Find WhatsApp chat',
    type_text: 'Type into app',
    press_key: 'Press key',
    run_shortcut: 'Run Shortcut',
    learn_document: 'Learn document',
    list_apps: 'Find installed apps',
    inspect_app: 'Read app controls',
    search_app: 'Search inside app',
    click_control: 'Use app control',
    set_field: 'Enter text',
    automate_app: 'Work in app',
    remember_fact: 'Save memory',
    recall_memory: 'Recall memories',
  })[a] || a

export default function App() {
  const [view, setView] = useState(routeView)
  const preferences = usePreferences()
  const isPublic = publicViews.includes(view)
  const [status, setStatus] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tourOpen, setTourOpen] = useState(false)
  const profileRevision = useRef(0)
  const showWelcome = Boolean(profile && (!profile.name || !profile.tutorial_completed || tourOpen))
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([initialMessage])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [voice, setVoice] = useState(() => localStorage.getItem('apple-voice') !== 'false')
  const [speechPending, setSpeechPending] = useState(false)
  const [speechTail, setSpeechTail] = useState(false)
  const speechTailTimer = useRef(null)
  const playbackSequence = useRef(0)
  const [speechLanguage, setSpeechLanguage] = useState(
    () => localStorage.getItem('apple-speech-language') || 'en-IN',
  )
  const audio = useAudioEngine()
  const speaking = audio.speaking
  const [documents, setDocuments] = useState([])
  const [routines, setRoutines] = useState([])
  const [history, setHistory] = useState([])
  const [memories, setMemories] = useState([])
  const [automation, setAutomation] = useState(false)
  const [autoTutor, setAutoTutor] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [quiz, setQuiz] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [grade, setGrade] = useState(null)
  const [routineForm, setRoutineForm] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [routineSteps, setRoutineSteps] = useState('')
  const [model, setModel] = useState('qwen3:8b')
  const [librarySearch, setLibrarySearch] = useState('')
  const [filePath, setFilePath] = useState('')
  const [speechRate, setSpeechRate] = useState(175)
  const [speechPitch, setSpeechPitch] = useState(
    () => (localStorage.getItem('apple-speech-pitch') !== null ? Number(localStorage.getItem('apple-speech-pitch')) : 1.0),
  )
  const [speechVolume, setSpeechVolume] = useState(
    () => (localStorage.getItem('apple-speech-volume') !== null ? Number(localStorage.getItem('apple-speech-volume')) : 1.0),
  )
  const [voicePersona, setVoicePersona] = useState(
    () => localStorage.getItem('apple-voice-persona') || 'natural',
  )
  const [expressiveVoice, setExpressiveVoice] = useState(true)
  const controller = useRef(null)
  const speechQueue = useRef(Promise.resolve())
  const speechEpoch = useRef(0)
  const audioMuted = useRef(preferences.muted)
  audioMuted.current = preferences.muted
  const audioEnabled = useRef(voice && !preferences.muted)
  audioEnabled.current = voice && !preferences.muted
  const inputRef = useRef(null)
  const bottom = useRef(null)
  const fileInput = useRef(null)
  const session = useRef(crypto.randomUUID())
  const busyRef = useRef(false)
  const echoGuard = useRef(new PlaybackEchoGuard())
  const tutor = useVoiceTutor({
    speak,
    cancelSpeech,
    onError: setError,
    onStart: () => {
      setError('')
      setView('assistant')
      setVoice(true)
      localStorage.setItem('apple-voice', 'true')
      audio.prepare().catch((e) => setError(e.message))
      voiceSession.start()
    },
  })

  const approvalPending = messages.some((m) => m.approval)
  const voiceSession = useVoiceSession({
    suspended:
      showWelcome ||
      busy ||
      ['preparing', 'grading'].includes(tutor.lesson?.stage) ||
      approvalPending ||
      view !== 'assistant' ||
      !connected ||
      (!audio.canInterrupt && (speaking || speechTail)),
    acquireInput: audio.acquireInput,
    language: speechLanguage,
    onCommand: handleVoiceCommand,
    acceptTranscript: (text) => echoGuard.current.accepts(text),
    onSpeech: () => {
      if (speaking || speechPending) {
        tutor.interrupt()
        cancelSpeech()
      }
    },
    onError: setError,
  })
  const listening = voiceSession.listening
  const floating = useFloatingAssistant({
    theme: preferences.theme,
    palette: preferences.palette,
    onError: setError,
    onClose: () => {
      voiceSession.stop()
      tutor.stop()
    },
  })
  useInterfaceSounds({
    extraDocument: floating.floatingWindow?.document,
    enabled: preferences.sounds,
    volume: preferences.soundVolume,
    muted: preferences.muted || voiceSession.enabled || speaking || speechPending,
  })
  function navigate(id) {
    if (id !== 'assistant') tutor.stop()
    setView(id)
    setError('')
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`)
    document.querySelector('.primary-content')?.scrollTo(0, 0)
  }
  function openFloating() {
    navigate('assistant')
    floating.open()
  }
  function openTour() {
    voiceSession.stop()
    tutor.stop()
    floating.close(true)
    setTourOpen(true)
  }
  async function saveProfile(value) {
    profileRevision.current += 1
    const saved = await api('/profile', { method: 'PUT', body: JSON.stringify(value) })
    setProfile(saved)
    return saved
  }
  useEffect(() => {
    const update = () => {
      const id = routeView()
      if (id !== 'assistant') tutor.stop()
      setView(id)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    if (window.location.hash !== `#${view}`) window.history.replaceState(null, '', `#${view}`)
  }, [view])
  async function historyDeleted(selection) {
    if (
      selection === 'all' ||
      history.some((item) => selection.includes(item.id) && item.session_id === session.current)
    ) {
      await stop()
      setMessages([initialMessage])
      session.current = crypto.randomUUID()
    }
    setHistory((previous) =>
      selection === 'all' ? [] : previous.filter((item) => !selection.includes(item.id)),
    )
    await refresh()
    setNotice('History deleted.')
  }
  useEffect(() => () => clearTimeout(speechTailTimer.current), [])
  function handleVoiceCommand(text) {
    if (/^(?:wait|pause|stop talking|listen)[.!?]?$/i.test(text.trim())) {
      cancelSpeech()
      return
    }
    if (/^(?:stop|stop listening|end voice session)[.!?]?$/i.test(text.trim())) return stop()
    if (/^(?:end|stop|cancel) (?:the )?(?:lesson|quiz)[.!?]?$/i.test(text.trim()))
      return tutor.stop()
    if (
      tutor.lesson &&
      /^(?:continue|next|next question|continue lesson)[.!?]?$/i.test(text.trim())
    )
      return tutor.resume()
    if (['question', 'answer'].includes(tutor.lesson?.stage)) return tutor.submit(text)
    return send(text)
  }

  async function refresh() {
    try {
      const revision = profileRevision.current
      const s = await api('/status')
      setStatus(s)
      if (revision === profileRevision.current && s.profile) setProfile(s.profile)
      setConnected(true)
      const results = await Promise.allSettled([
        api('/documents'),
        api('/routines'),
        api('/history'),
        api('/memories'),
      ])
      if (results[0].status === 'fulfilled') setDocuments(results[0].value)
      if (results[1].status === 'fulfilled') setRoutines(results[1].value)
      if (results[2].status === 'fulfilled') setHistory(results[2].value)
      if (results[3].status === 'fulfilled') setMemories(results[3].value)
      return s
    } catch {
      setConnected(false)
      return null
    }
  }
  useEffect(() => {
    let live = true
    refresh().then((s) => {
      if (s && live) {
        setModel(s.settings.model)
        setSpeechRate(s.settings.speech_rate)
        setSpeechPitch(s.settings.speech_pitch ?? 1.0)
        setSpeechVolume(s.settings.speech_volume ?? 1.0)
        setVoicePersona(s.settings.voice_persona || 'natural')
        setExpressiveVoice(s.settings.expressive_voice !== false)
        setAutomation(s.settings.automation_enabled)
        setAutoTutor(s.settings.auto_tutor !== false)
      }
    })
    const timer = setInterval(refresh, 15000)
    return () => {
      live = false
      clearInterval(timer)
      controller.current?.abort()
      speechEpoch.current += 1
      speechQueue.current = Promise.resolve()
    }
  }, [])
  useEffect(() => {
    const panel = bottom.current?.parentElement
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [messages, phase])
  useEffect(() => {
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setView('assistant')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [notice])

  function patchMessage(id, values) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...values } : m)))
  }
  function speak(text, options) {
    if (audioMuted.current || !text?.trim()) return Promise.resolve()
    const epoch = speechEpoch.current
    audio.prepare().catch((e) => setError(e.message))
    setSpeechPending(true)
    const task = speechQueue.current
      .catch(() => {})
      .then(async () => {
        if (audioMuted.current || epoch !== speechEpoch.current) return
        let ended, playback
        try {
          await audio.play(
            text,
            (reference) => {
              ended = echoGuard.current.begin(reference)
              playback = ++playbackSequence.current
              // Pause synchronously before the first audio sample, not after a
              // React render. Unsupported browsers use safe turn-taking.
              if (!audio.canInterrupt) voiceSession.pause()
              clearTimeout(speechTailTimer.current)
              setSpeechTail(true)
            },
            {
              persona: voicePersona,
              speechRate,
              speechPitch,
              speechVolume,
              ...options,
            },
          )
        } finally {
          ended?.()
          if (playback === playbackSequence.current) {
            clearTimeout(speechTailTimer.current)
            speechTailTimer.current = setTimeout(() => setSpeechTail(false), 900)
          }
        }
      })
      .catch((e) => {
        if (epoch === speechEpoch.current) setError(e.message)
      })
      .finally(() => {
        if (speechQueue.current === task && epoch === speechEpoch.current) setSpeechPending(false)
      })
    speechQueue.current = task
    return task
  }
  function cancelSpeech() {
    speechEpoch.current += 1
    audio.stop()
    const stopped = api('/speech/stop', { method: 'POST' }).catch(() => {})
    speechQueue.current = stopped
    setSpeechPending(false)
    return stopped
  }
  function toggleSession() {
    if (showWelcome) return
    audio.prepare().catch((e) => setError(e.message))
    if (voiceSession.enabled) {
      voiceSession.stop()
      tutor.stop()
    } else {
      setError('')
      setView('assistant')
      setVoice(true)
      localStorage.setItem('apple-voice', 'true')
      voiceSession.start()
    }
  }
  function eventHandler(id) {
    return (event) => {
      if (event.type === 'status') setPhase(event.message)
      if (event.type === 'agent_step')
        setPhase(`${actionLabel(event.action?.action)} · ${event.action?.target || ''}`)
      if (event.type === 'plan') {
        patchMessage(id, { text: event.reply, actions: event.actions })
        setPhase(event.actions.length ? 'Working on your request…' : 'Preparing a response…')
      }
      if (event.type === 'step') {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== id) return m
            const steps = [...(m.steps || [])]
            steps[event.index] = event
            return { ...m, steps }
          }),
        )
      }
      if (event.type === 'approval') {
        if (audioEnabled.current) speak('Please confirm the recipient and message on screen.')
        patchMessage(id, {
          text: event.reply,
          approval: event.approval_id,
          actions: event.actions,
          pending: false,
        })
      }
      if (event.type === 'done') {
        if (event.document) setSelectedDoc(event.document)
        patchMessage(id, {
          text: event.reply,
          pending: false,
          approval: null,
          success: event.success,
          sources: event.sources,
          results: event.steps,
        })
        if (audioEnabled.current) speak(event.spoken_reply ?? event.reply)
        refresh()
      }
      if (event.type === 'error') {
        if (audioEnabled.current) speak(event.message)
        patchMessage(id, {
          text: event.message,
          pending: false,
          success: false,
          approval: null,
        })
      }
    }
  }
  async function send(text = input) {
    if (showWelcome) return
    if (!text.trim() || busyRef.current || approvalPending) return
    if (['question', 'answer'].includes(tutor.lesson?.stage)) {
      setInput('')
      return tutor.submit(text)
    }
    voiceSession.pause()
    audio.prepare().catch((e) => setError(e.message))
    const id = crypto.randomUUID()
    setView('assistant')
    setInput('')
    setError('')
    setPhase('Connecting…')
    setBusy(true)
    busyRef.current = true
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: text.trim() },
      { id, role: 'assistant', text: '', pending: true },
    ])
    controller.current = new AbortController()
    try {
      await stream(
        '/command/stream',
        {
          command: text.trim(),
          session_id: session.current,
          document_id: selectedDoc?.id || null,
        },
        eventHandler(id),
        controller.current.signal,
      )
    } catch (e) {
      patchMessage(id, {
        text:
          e.name === 'AbortError'
            ? 'Stopped. Already completed actions remain in place.'
            : `I couldn’t complete that request. ${e.message}`,
        pending: false,
        success: false,
      })
    } finally {
      setBusy(false)
      busyRef.current = false
      setPhase('')
    }
  }
  async function approve(message, value) {
    if (busyRef.current) return
    setBusy(true)
    busyRef.current = true
    setError('')
    patchMessage(message.id, { approval: null, pending: value })
    controller.current = new AbortController()
    try {
      if (value)
        await stream(
          `/approvals/${message.approval}`,
          { approve: true },
          eventHandler(message.id),
          controller.current.signal,
        )
      else {
        await api(`/approvals/${message.approval}`, {
          method: 'POST',
          body: JSON.stringify({ approve: false }),
        })
        patchMessage(message.id, {
          text: 'Cancelled. No actions from this plan were run.',
          actions: [],
          cancelled: true,
        })
      }
    } catch (e) {
      patchMessage(message.id, {
        text:
          e.name === 'AbortError'
            ? 'Stopped. Check the destination app before retrying.'
            : e.message,
        pending: false,
        success: false,
      })
    } finally {
      setBusy(false)
      busyRef.current = false
      setPhase('')
    }
  }
  async function stop() {
    controller.current?.abort()
    voiceSession.stop()
    await tutor.stop()
    try {
      await api('/stop', { method: 'POST' })
      setMessages((prev) =>
        prev.map((m) =>
          m.approval ? { ...m, approval: null, actions: [], text: 'Cancelled by Stop.' } : m,
        ),
      )
    } catch (e) {
      setError(e.message)
    }
  }
  function toggleVoice() {
    setVoice(!voice)
    localStorage.setItem('apple-voice', String(!voice))
    if (voice) {
      voiceSession.stop()
      tutor.stop()
    }
  }
  function toggleSound() {
    const muted = !audioMuted.current
    // Gate queued replies immediately, before React renders the new icon.
    audioMuted.current = muted
    audioEnabled.current = voice && !muted
    preferences.setMuted(muted)
    if (muted) cancelSpeech()
    setNotice(muted ? 'All app sounds muted.' : 'Sound on. Your saved audio settings are restored.')
  }
  async function doWork(fn) {
    setWorking(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(false)
    }
  }
  async function upload(file) {
    if (!file) return
    audio.prepare().catch(() => {})
    await doWork(async () => {
      const form = new FormData()
      form.append('file', file)
      const document = await api('/documents', { method: 'POST', body: form })
      await afterImport(document)
    })
    if (fileInput.current) fileInput.current.value = ''
  }
  async function afterImport(document) {
    setDocuments((previous) => [document, ...previous.filter((item) => item.id !== document.id)])
    void refresh()
    setSelectedDoc(document)
    setNotice('Document added to your local library.')
    if (autoTutor) await tutor.start(document)
  }
  async function startQuiz(doc) {
    await doWork(async () => {
      const data = await api(`/documents/${doc.id}/quiz`, { method: 'POST' })
      setQuiz(data)
      setQuestionIndex(0)
      setAnswer('')
      setGrade(null)
    })
  }
  const welcome = messages.length === 1

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`app-shell console-shell ${isPublic ? 'public-shell' : ''} ${view === 'home' ? 'home-shell' : ''} ${view === 'assistant' ? 'console-active' : ''}`}
      >
        <AmbientField audioLevel={audio.level} />
        {showWelcome && (
          <WelcomeFlow
            profile={profile}
            onSave={saveProfile}
            onFinish={(destination) => {
              setTourOpen(false)
              if (destination) navigate(destination)
            }}
          />
        )}
        {!showWelcome && !isPublic && status && !status.settings.setup_completed && (
          <AutomationSetup
            working={working}
            onChoose={(enabled) =>
              doWork(async () => {
                await api('/settings', {
                  method: 'PUT',
                  body: JSON.stringify({
                    ...status.settings,
                    automation_enabled: enabled,
                    setup_completed: true,
                  }),
                })
                setAutomation(enabled)
                await refresh()
              })
            }
          />
        )}
        <RevealNav
          view={view}
          navigation={navigation}
          onNavigate={navigate}
          theme={preferences.theme}
          onTheme={preferences.toggleTheme}
          onFloat={openFloating}
          connected={connected}
          aiReady={status?.ai?.ready}
          muted={preferences.muted}
          onSound={toggleSound}
          onStop={stop}
        />

        <main className="main-shell">
          <div className="global-nav-spacer" />
          {error && (
            <div className="banner error" role="alert">
              <CircleHelp size={17} />
              <span>{error}</span>
              <IconButton label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          <div className="content-layout">
            <div className={`primary-content ${view === 'assistant' ? 'chat-content' : ''}`}>
              {isPublic && (
                <ProductPages
                  view={view}
                  navigate={navigate}
                  onTour={openTour}
                  name={profile?.name}
                />
              )}
              {view === 'assistant' && (
                <>
                  <div className="section-heading">
                    <span className="session-label">
                      <span className="workspace-owner">{profile?.name || 'Your workspace'}</span>
                      <span className="session-divider">/</span>ASSISTANT
                    </span>
                    <button
                      className="subtle-button"
                      disabled={busy || speechPending || messages.some((m) => m.approval)}
                      onClick={() => {
                        tutor.stop()
                        setMessages([initialMessage])
                        session.current = crypto.randomUUID()
                        setSelectedDoc(null)
                      }}
                    >
                      <Plus size={15} /> New session
                    </button>
                  </div>
                  <div className="chat-scroll">
                    <VoiceTutor
                      tutor={tutor}
                      transcript={voiceSession.transcript}
                      listening={listening}
                    />
                    <VoiceStage
                      compact={!welcome || !!tutor.lesson}
                      enabled={voiceSession.enabled}
                      listening={listening}
                      speaking={speaking}
                      audioLevel={audio.level}
                      busy={busy || speechPending}
                      phase={speechPending && !speaking ? 'Preparing voice…' : phase}
                      transcript={voiceSession.transcript}
                      ready={status?.ai?.ready}
                      connected={connected}
                      approval={approvalPending}
                      onToggle={toggleSession}
                      onStop={stop}
                      onInterrupt={cancelSpeech}
                      canInterrupt={audio.canInterrupt}
                      onLibrary={() => setView('library')}
                      onPrompt={send}
                    />
                    {!welcome && !tutor.lesson && (
                      <div className="messages">
                        {messages
                          .filter((m) => !m.welcome)
                          .slice(-2)
                          .map((m) => (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`message ${m.role}`}
                              key={m.id}
                            >
                              {m.role === 'assistant' && (
                                <span className="assistant-avatar">
                                  <AudioLines size={16} />
                                </span>
                              )}
                              <div className="message-body">
                                <div className="message-meta">
                                  {m.role === 'assistant' ? 'APPLE' : 'YOU'}
                                  {m.pending && (
                                    <span className="working-label">
                                      <Loader2 size={12} className="spin" />
                                      {phase || 'Working…'}
                                    </span>
                                  )}
                                </div>
                                {m.text && (
                                  <div
                                    className={`message-text ${m.success === false ? 'failed-text' : ''}`}
                                  >
                                    {m.text}
                                  </div>
                                )}
                                {m.steps?.length > 0 && (
                                  <div className="execution-steps">
                                    {m.steps.map((step, i) => (
                                      <div key={i}>
                                        {step.status === 'running' ? (
                                          <Loader2 className="spin" size={13} />
                                        ) : step.status === 'done' ? (
                                          <Check size={13} />
                                        ) : (
                                          <X size={13} />
                                        )}
                                        <span>
                                          {actionLabel(step.action.action)} · {step.action.target}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {m.approval && (
                                  <div className="approval-card">
                                    <div className="approval-title">
                                      <ShieldCheck size={17} />
                                      Ready for your review
                                    </div>
                                    <p>
                                      Check the destination and content before these actions run.
                                    </p>
                                    {m.actions.map((a, i) => (
                                      <div className="approval-action" key={i}>
                                        <span>{i + 1}</span>
                                        <div>
                                          <strong>
                                            {actionLabel(a.action)} · {a.target}
                                          </strong>
                                          {a.message && <blockquote>{a.message}</blockquote>}
                                        </div>
                                      </div>
                                    ))}
                                    <div className="button-row">
                                      <button
                                        className="primary-button"
                                        disabled={busy}
                                        onClick={() => approve(m, true)}
                                      >
                                        <Check size={14} />
                                        Run these actions
                                      </button>
                                      <button
                                        className="secondary-button"
                                        disabled={busy}
                                        onClick={() => approve(m, false)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {m.sources?.length > 0 && (
                                  <div className="sources">
                                    {[...new Map(m.sources.map((s) => [s.page, s])).values()].map(
                                      (s) => (
                                        <span title={s.text} key={s.page}>
                                          <FileText size={12} />
                                          {s.name} · p. {s.page}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                                {m.results?.some((r) => r.files?.length) && (
                                  <div className="file-results">
                                    {m.results
                                      .flatMap((r) => r.files || [])
                                      .map((path) => (
                                        <button
                                          key={path}
                                          onClick={() => setInput(`Open file ${path}`)}
                                        >
                                          <FileText size={14} />
                                          {path}
                                          <ArrowUpRight size={13} />
                                        </button>
                                      ))}
                                  </div>
                                )}
                                {m.role === 'assistant' && m.text && !m.pending && (
                                  <IconButton
                                    label="Read this reply aloud"
                                    onClick={() => speak(m.text)}
                                  >
                                    <Volume2 size={13} />
                                  </IconButton>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        <div ref={bottom} />
                      </div>
                    )}
                  </div>
                  <div className="composer-area">
                    {selectedDoc && (
                      <div className="context-chip">
                        <FileText size={14} />
                        Asking about {selectedDoc.name}
                        <button
                          aria-label="Remove document context"
                          onClick={() => setSelectedDoc(null)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    <form
                      className={`composer ${listening ? 'listening' : ''}`}
                      onSubmit={(e) => {
                        e.preventDefault()
                        send()
                      }}
                    >
                      <textarea
                        ref={inputRef}
                        aria-label="Message APPLE"
                        placeholder={
                          listening
                            ? 'Type a command…'
                            : selectedDoc
                              ? 'Ask a question about this document…'
                              : 'Type a command…'
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            send()
                          }
                        }}
                      />
                      <div className="composer-tools">
                        <div>
                          <IconButton
                            label="Add a document"
                            onClick={() => {
                              setView('library')
                              fileInput.current?.click()
                            }}
                            type="button"
                          >
                            <Plus size={20} />
                          </IconButton>
                        </div>
                        <div>
                          <IconButton
                            label={
                              voiceSession.enabled ? 'End voice session' : 'Start voice session'
                            }
                            onClick={toggleSession}
                            disabled={busy}
                            type="button"
                          >
                            {listening ? <AudioLines size={19} /> : <Mic size={18} />}
                          </IconButton>
                          {busy ? (
                            <button
                              className="send-button"
                              type="button"
                              aria-label="Stop request"
                              onClick={stop}
                            >
                              <Square size={16} />
                            </button>
                          ) : (
                            <button
                              className="send-button"
                              type="submit"
                              aria-label="Send command"
                              disabled={!input.trim() || approvalPending}
                            >
                              <ArrowUp size={19} />
                            </button>
                          )}
                        </div>
                      </div>
                    </form>
                    <div className="composer-caption">
                      <span>On your Mac. In your control.</span>
                      <span>⌘ K to type</span>
                    </div>
                  </div>
                </>
              )}

              {view === 'library' && (
                <LibraryView
                  quiz={quiz}
                  setQuiz={setQuiz}
                  questionIndex={questionIndex}
                  setQuestionIndex={setQuestionIndex}
                  answer={answer}
                  setAnswer={setAnswer}
                  grade={grade}
                  setGrade={setGrade}
                  working={working}
                  doWork={doWork}
                  fileInput={fileInput}
                  upload={upload}
                  filePath={filePath}
                  setFilePath={setFilePath}
                  refresh={refresh}
                  setNotice={setNotice}
                  documents={documents}
                  librarySearch={librarySearch}
                  setLibrarySearch={setLibrarySearch}
                  setSelectedDoc={setSelectedDoc}
                  setView={setView}
                  setInput={setInput}
                  startQuiz={startQuiz}
                  startVoiceLesson={(doc) => {
                    setSelectedDoc(doc)
                    tutor.start(doc)
                  }}
                  afterImport={afterImport}
                  selectedDoc={selectedDoc}
                />
              )}

              {view === 'routines' && (
                <RoutinesView
                  setRoutineForm={setRoutineForm}
                  routineForm={routineForm}
                  routineName={routineName}
                  setRoutineName={setRoutineName}
                  routineSteps={routineSteps}
                  setRoutineSteps={setRoutineSteps}
                  doWork={doWork}
                  refresh={refresh}
                  setNotice={setNotice}
                  working={working}
                  routines={routines}
                  busy={busy}
                  setSelectedDoc={setSelectedDoc}
                  setView={setView}
                  setInput={setInput}
                />
              )}

              {view === 'activity' && <ActivityView history={history} onDeleted={historyDeleted} />}

              {view === 'settings' && (
                <SettingsView
                  profile={profile}
                  onSaveProfile={saveProfile}
                  onTour={openTour}
                  preferences={preferences}
                  onSound={toggleSound}
                  onFloat={openFloating}
                  floatingSupported={floating.supported}
                  expressiveVoice={expressiveVoice}
                  setExpressiveVoice={setExpressiveVoice}
                  voicePersona={voicePersona}
                  setVoicePersona={(v) => {
                    setVoicePersona(v)
                    localStorage.setItem('apple-voice-persona', v)
                  }}
                  speechPitch={speechPitch}
                  setSpeechPitch={(p) => {
                    setSpeechPitch(p)
                    localStorage.setItem('apple-speech-pitch', p)
                  }}
                  speechVolume={speechVolume}
                  setSpeechVolume={(v) => {
                    setSpeechVolume(v)
                    localStorage.setItem('apple-speech-volume', v)
                  }}
                  status={status}
                  memories={memories}
                  automation={automation}
                  setAutomation={setAutomation}
                  autoTutor={autoTutor}
                  setAutoTutor={setAutoTutor}
                  model={model}
                  setModel={setModel}
                  refresh={refresh}
                  setNotice={setNotice}
                  voice={voice}
                  toggleVoice={toggleVoice}
                  speechRate={speechRate}
                  setSpeechRate={setSpeechRate}
                  speechLanguage={speechLanguage}
                  setSpeechLanguage={(language) => {
                    setSpeechLanguage(language)
                    localStorage.setItem('apple-speech-language', language)
                  }}
                  speak={speak}
                  working={working}
                  doWork={doWork}
                />
              )}
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            hidden
            onChange={(e) => upload(e.target.files[0])}
          />
        </main>
        <FloatingAssistant
          window={floating.floatingWindow}
          listening={listening}
          speaking={speaking}
          busy={busy || speechPending || ['preparing', 'grading'].includes(tutor.lesson?.stage)}
          enabled={voiceSession.enabled}
          connected={connected}
          approval={approvalPending}
          transcript={voiceSession.transcript}
          reply={
            error ||
            [...messages]
              .reverse()
              .find((message) => message.role === 'assistant' && !message.welcome)?.text
          }
          audioLevel={audio.level}
          onToggle={toggleSession}
          onStop={stop}
          onReturn={() => {
            navigate('assistant')
            floating.close(true)
          }}
          onSend={send}
        />
      </div>
    </MotionConfig>
  )
}
