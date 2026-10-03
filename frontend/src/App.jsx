import SettingsView from './components/SettingsView'
import ActivityView from './components/ActivityView'
import RoutinesView from './components/RoutinesView'
import LibraryView from './components/LibraryView'
import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  HelpCircle as CircleHelp,
  Command,
  FileText,
  Globe,
  History,
  Layers,
  Loader2,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { api, stream } from './utils/api'
import { Orb, IconButton } from './components/ui'

const navigation = [
  { id: 'assistant', label: 'Assistant', icon: Command },
  { id: 'library', label: 'Knowledge library', icon: BookOpen },
  { id: 'routines', label: 'My routines', icon: Layers },
  { id: 'activity', label: 'Activity', icon: History },
]
const suggestions = [
  {
    icon: Globe,
    title: 'Explore something',
    description: 'Search the web, follow your curiosity',
    prompt: 'Search for the latest space discoveries',
    color: 'blue',
  },
  {
    icon: BookOpen,
    title: 'Study with me',
    description: 'Turn your notes into understanding',
    view: 'library',
    color: 'purple',
  },
  {
    icon: Zap,
    title: 'Make things happen',
    description: 'Your apps. One simple instruction.',
    prompt: 'Open Notes',
    color: 'amber',
  },
]
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
  })[a] || a

export default function App() {
  const [view, setView] = useState('assistant')
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([initialMessage])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [voice, setVoice] = useState(() => localStorage.getItem('apple-voice') !== 'false')
  const [listening, setListening] = useState(false)
  const [documents, setDocuments] = useState([])
  const [routines, setRoutines] = useState([])
  const [history, setHistory] = useState([])
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
  const controller = useRef(null)
  const recognition = useRef(null)
  const inputRef = useRef(null)
  const bottom = useRef(null)
  const fileInput = useRef(null)
  const session = useRef(crypto.randomUUID())
  const busyRef = useRef(false)

  async function refresh() {
    try {
      const s = await api('/status')
      setStatus(s)
      setConnected(true)
      const results = await Promise.allSettled([
        api('/documents'),
        api('/routines'),
        api('/history'),
      ])
      if (results[0].status === 'fulfilled') setDocuments(results[0].value)
      if (results[1].status === 'fulfilled') setRoutines(results[1].value)
      if (results[2].status === 'fulfilled') setHistory(results[2].value)
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
      }
    })
    const timer = setInterval(refresh, 15000)
    return () => {
      live = false
      clearInterval(timer)
      recognition.current?.abort()
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
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
  async function speak(text) {
    try {
      await api('/speech', {
        method: 'POST',
        body: JSON.stringify({ text: text.slice(0, 12000) }),
      })
    } catch (e) {
      setError(e.message)
    }
  }
  function eventHandler(id) {
    return (event) => {
      if (event.type === 'status') setPhase(event.message)
      if (event.type === 'plan') {
        patchMessage(id, { text: event.reply, actions: event.actions })
        setPhase(event.actions.length ? 'Working on your request…' : 'Preparing a response…')
      }
      if (event.type === 'step')
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== id) return m
            const steps = [...(m.steps || [])]
            steps[event.index] = event
            return { ...m, steps }
          }),
        )
      if (event.type === 'approval')
        patchMessage(id, {
          text: event.reply,
          approval: event.approval_id,
          actions: event.actions,
          pending: false,
        })
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
        if (voice) speak(event.reply)
        refresh()
      }
      if (event.type === 'error')
        patchMessage(id, {
          text: event.message,
          pending: false,
          success: false,
          approval: null,
        })
    }
  }
  async function send(text = input) {
    if (!text.trim() || busyRef.current) return
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
    recognition.current?.abort()
    setListening(false)
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
    if (voice) api('/speech/stop', { method: 'POST' }).catch(() => {})
  }
  function listen() {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setError(
        'Dictation isn’t supported in this window. Open APPLE in Chrome to use the microphone. Spoken replies still work in the desktop app.',
      )
      return
    }
    const rec = new Recognition()
    recognition.current = rec
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (event) => {
      setListening(false)
      setError(`Microphone: ${event.error}. Check microphone permission and try again.`)
    }
    rec.onresult = (event) => {
      setInput(
        Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(' '),
      )
    }
    try {
      rec.start()
    } catch (e) {
      setListening(false)
      setError(e.message)
    }
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
    await doWork(async () => {
      const form = new FormData()
      form.append('file', file)
      await api('/documents', { method: 'POST', body: form })
      await refresh()
      setNotice('Document added to your local library.')
    })
    if (fileInput.current) fileInput.current.value = ''
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
  const date = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date())
  const activeTitle =
    view === 'settings' ? 'Settings' : navigation.find((n) => n.id === view)?.label

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setView('assistant')
          }}
        >
          <span className="brand-symbol">
            <AudioLines size={21} />
          </span>{' '}
          apple<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            Personal workspace<small>LOCAL DESKTOP ASSISTANT</small>
          </div>
          <MoreHorizontal size={16} />
        </div>
        <div className="nav-label">YOUR SPACE</div>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={`nav-item ${view === id ? 'selected' : ''}`}
              onClick={() => {
                setView(id)
                setError('')
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'assistant' ? (
                <kbd>⌘ K</kbd>
              ) : id === 'library' && documents.length > 0 ? (
                <span className="nav-count">{documents.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-routines">
          <div className="nav-label">
            PINNED ROUTINES
            <button
              aria-label="Create a routine"
              onClick={() => {
                setView('routines')
                setRoutineForm(true)
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          {routines.length ? (
            routines.slice(0, 4).map((r) => (
              <button
                key={r.id}
                className="pinned"
                disabled={busy}
                onClick={() => {
                  setSelectedDoc(null)
                  setInput(`Run ${r.name}`)
                  setView('assistant')
                }}
              >
                <span className="tiny-dot" />
                {r.name}
                <ArrowUpRight size={13} />
              </button>
            ))
          ) : (
            <p className="sidebar-hint">
              Good habits, on autopilot.
              <br />
              Teach your first routine.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={18} />
            <strong>Yours. Locally.</strong>
            <p>
              Conversations and knowledge
              <br />
              stay on your computer.
            </p>
            <span>
              <i /> LOCAL AI ENGINE
            </span>
          </div>
          <button
            className={`nav-item ${view === 'settings' ? 'selected' : ''}`}
            onClick={() => setView('settings')}
          >
            <Settings2 size={18} />
            <span>Settings & connections</span>
          </button>
          <div className="profile">
            <span className="profile-avatar">Y</span>
            <div>
              Your personal assistant<small>Made for your everyday</small>
            </div>
            <span className={`status-dot ${connected ? 'online' : ''}`} />
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{activeTitle}</strong>
          </div>
          <div className="top-actions">
            <span className={`connection ${connected ? 'online' : ''}`}>
              <i />
              {connected ? 'System connected' : 'Backend offline'}
            </span>
            <span className="top-divider" />
            <IconButton
              label={voice ? 'Turn spoken replies off' : 'Turn spoken replies on'}
              onClick={toggleVoice}
            >
              {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </IconButton>
            <IconButton label="Stop all actions and speech" onClick={stop}>
              <Square size={14} />
            </IconButton>
          </div>
        </header>
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
            {view === 'assistant' && (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">A LITTLE HELP. A LOT MORE POSSIBILITY.</span>
                    <h1>
                      Your everyday, upgraded<span>.</span>
                    </h1>
                  </div>
                  <button
                    className="subtle-button"
                    disabled={busy || messages.some((m) => m.approval)}
                    onClick={() => {
                      setMessages([initialMessage])
                      session.current = crypto.randomUUID()
                      setSelectedDoc(null)
                    }}
                  >
                    <Plus size={15} /> New session
                  </button>
                </div>
                <div className="chat-scroll">
                  {welcome ? (
                    <div className="welcome">
                      <div className="orb-stage">
                        <span className="orbit orbit-a" />
                        <span className="orbit orbit-b" />
                        <Orb active={listening || busy} />
                        <span className="orb-spark spark-a" />
                        <span className="orb-spark spark-b" />
                      </div>
                      <div className="ready-label">
                        <span className="tiny-dot" />
                        {listening ? 'LISTENING TO YOU' : 'HERE WHEN YOU NEED ME'}
                      </div>
                      <h2>
                        A little less doing.
                        <br />
                        <span>A little more living.</span>
                      </h2>
                      <p>
                        Think of me as an extra pair of hands, and a curious mind.
                        <br />
                        What would you like to make happen today?
                      </p>
                      <div className="suggestion-grid">
                        {suggestions.map(
                          ({ icon: Icon, title, description, prompt, view: next, color }) => (
                            <button
                              key={title}
                              className="suggestion"
                              onClick={() => (next ? setView(next) : setInput(prompt))}
                            >
                              <span className={`suggestion-icon ${color}`}>
                                <Icon size={18} />
                              </span>
                              <ArrowUpRight className="suggestion-arrow" size={15} />
                              <strong>{title}</strong>
                              <span>{description}</span>
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="messages">
                      {messages
                        .filter((m) => !m.welcome)
                        .map((m) => (
                          <div className={`message ${m.role}`} key={m.id}>
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
                                  <p>Check the destination and content before these actions run.</p>
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
                          </div>
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
                          ? 'Listening…'
                          : selectedDoc
                            ? 'Ask a question about this document…'
                            : 'Ask anything, or ask me to do something…'
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      rows={2}
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
                        <span className="composer-divider" />
                        <span className="model-label">
                          <span className="tiny-dot" />
                          {status?.ai?.ready ? status.ai.model : 'Local assistant'}
                          <ChevronRight size={12} />
                        </span>
                      </div>
                      <div>
                        <IconButton
                          label={listening ? 'Stop listening' : 'Dictate a command'}
                          onClick={listen}
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
                            disabled={!input.trim()}
                          >
                            <ArrowUp size={19} />
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                  <div className="composer-caption">
                    <span>
                      <ShieldCheck size={12} /> Local reasoning. Real actions. You’re in control.
                    </span>
                    <span>
                      ↵ to send <b>·</b> shift ↵ for a new line
                    </span>
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

            {view === 'activity' && <ActivityView history={history} />}

            {view === 'settings' && (
              <SettingsView
                status={status}
                model={model}
                setModel={setModel}
                refresh={refresh}
                setNotice={setNotice}
                voice={voice}
                toggleVoice={toggleVoice}
                speechRate={speechRate}
                setSpeechRate={setSpeechRate}
                speak={speak}
                working={working}
                doWork={doWork}
              />
            )}
          </div>

          <aside className="context-panel">
            <div className="context-header">
              <span>AT A GLANCE</span>
              <span>{date}</span>
            </div>
            <div className="assistant-status">
              <Orb small active={busy || listening} />
              <h3>{busy ? 'On it.' : listening ? 'All ears.' : 'Ready when you are.'}</h3>
              <p>
                {busy
                  ? phase || 'Taking it one step at a time.'
                  : 'A calmer way to get things done.'}
              </p>
              <span className={`status-pill ${connected ? '' : 'offline'}`}>
                <i />
                {connected
                  ? status?.ai?.ready
                    ? 'LOCAL AI CONNECTED'
                    : 'BASIC TOOLS READY'
                  : 'CONNECT YOUR BACKEND'}
              </span>
            </div>
            <div className="context-section">
              <div className="context-section-title">
                YOUR TOOLKIT
                <Sparkles size={14} />
              </div>
              <button
                className="tool-row"
                onClick={() => {
                  setView('assistant')
                  setInput('Open Chrome')
                }}
              >
                <span className="tool-icon blue">
                  <Command size={16} />
                </span>
                <div>
                  Computer control<small>Apps, files, and the web</small>
                </div>
                <span className={`status-dot ${connected ? 'online' : ''}`} />
              </button>
              <button className="tool-row" onClick={() => setView('library')}>
                <span className="tool-icon purple">
                  <BookOpen size={16} />
                </span>
                <div>
                  Knowledge & learning
                  <small>
                    {documents.length
                      ? `${documents.length} documents in your library`
                      : 'Your own personal study partner'}
                  </small>
                </div>
                <ChevronRight size={14} />
              </button>
              <button className="tool-row" onClick={() => setView('routines')}>
                <span className="tool-icon amber">
                  <Zap size={16} />
                </span>
                <div>
                  Personal routines<small>Teach once, use whenever</small>
                </div>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="context-section">
              <div className="context-section-title">
                RECENT ACTIVITY
                <button onClick={() => setView('activity')}>
                  View all
                  <ArrowUpRight size={12} />
                </button>
              </div>
              {history.length ? (
                history.slice(0, 3).map((h) => (
                  <div className="recent-item" key={h.id}>
                    <span className={`recent-dot ${h.success ? '' : 'failed'}`} />
                    <div>
                      <p>{h.command}</p>
                      <small>
                        {new Date(h.created).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {h.success ? 'Completed' : 'Needs attention'}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="quiet-text">
                  A clear desk. A fresh start.
                  <br />
                  Your activity will appear here.
                </p>
              )}
            </div>
            <div className="daily-tip">
              <span>
                <Sparkles size={13} /> A LITTLE INSPIRATION
              </span>
              <p>
                “Learn these notes.
                <br />
                Then put me to the test.”
              </p>
              <button onClick={() => setView('library')}>
                Try a study session
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="panel-footer">
              <span className="tiny-dot" />
              DESIGNED AROUND YOU
            </div>
          </aside>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.txt,.md"
          hidden
          onChange={(e) => upload(e.target.files[0])}
        />
      </main>
    </div>
  )
}
