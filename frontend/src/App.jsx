import React, { useState, useRef, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Message from './components/Message'
import RightPanel from './components/RightPanel'
import WorkflowsView from './components/WorkflowsView'
import HistoryView from './components/HistoryView'
import { sendCommandStream, getHistory, getStatus } from './utils/api'

const QUICK_ACTIONS = [
  { icon: 'ti-browser', label: 'Open Browser', cmd: 'Open Chrome' },
  { icon: 'ti-search', label: 'Search Web', cmd: 'Search Google for React tutorial' },
  { icon: 'ti-folder-plus', label: 'New Folder', cmd: 'Create a new folder named Projects' },
  { icon: 'ti-bell-off', label: 'Mute Notifs', cmd: 'Mute system notifications' },
]

const HINTS = [
  'open vs code', 'whatsapp team', 'dsa mode', 'new folder', 'youtube lofi', 'start work mode'
]

const INIT_MESSAGES = [{
  id: 1, role: 'ai', time: 'Just now',
  content: "Hello. I'm APPLE — your personal AI action engine. I don't just respond, I execute. Type any command below.",
  tags: ['ready', 'macos'],
  steps: [],
  done: true,
}]

const DEFAULT_SCHEDULED = [
  { time: '09:00', name: 'Trading dashboard', active: true },
  { time: '11:30', name: 'Team standup msg', active: true },
  { time: '18:00', name: 'DSA practice mode', active: false },
  { time: '21:00', name: 'Daily digest', active: false },
]

const DEFAULT_ACTIVITY = [
  { text: 'System connected', type: 'done', time: '2m' },
  { text: 'Backend online', type: 'done', time: '2m' },
  { text: 'Waiting for command', type: 'run', time: 'now' },
]

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [messages, setMessages] = useState(INIT_MESSAGES)
  const [input, setInput] = useState('')
  const [activeView, setActiveView] = useState('chat')
  const [activity, setActivity] = useState(DEFAULT_ACTIVITY)
  const [cmdCount, setCmdCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [voiceActive, setVoiceActive] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [history, setHistory] = useState([])
  const [scheduled] = useState(DEFAULT_SCHEDULED)
  const [mode, setMode] = useState('ai')
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  // Check backend status
  useEffect(() => {
    getStatus().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
  }, [])

  // Load history when switching to history view
  useEffect(() => {
    if (activeView === 'history') {
      getHistory().then(d => setHistory(d.history || [])).catch(() => {})
    }
  }, [activeView])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const addActivity = useCallback((text, type = 'done') => {
    setActivity(prev => [{ text, type, time: 'now' }, ...prev.slice(0, 4)])
  }, [])

  const handleSend = useCallback(async (cmdOverride) => {
    const cmd = (cmdOverride || input).trim()
    if (!cmd) return
    setInput('')
    inputRef.current?.focus()

    const userMsg = { id: Date.now(), role: 'user', time: now(), content: cmd, steps: [] }
    setMessages(prev => [...prev, userMsg])
    setCmdCount(c => c + 1)
    addActivity('Command received', 'run')

    // Typing indicator
    const typingId = Date.now() + 1
    setMessages(prev => [...prev, { id: typingId, role: 'ai', time: now(), typing: true }])

    if (!backendOnline) {
      // Demo mode — simulate response without backend
      await new Promise(r => setTimeout(r, 900))
      setMessages(prev => prev.filter(m => m.id !== typingId))

      const demoSteps = getDemoSteps(cmd)
      const aiMsg = {
        id: Date.now() + 2, role: 'ai', time: now(),
        content: getDemoResponse(cmd),
        tags: getDemoTags(cmd),
        steps: demoSteps,
        done: false,
      }
      setMessages(prev => [...prev, aiMsg])
      setTaskCount(t => t + demoSteps.length)
      addActivity(demoSteps[demoSteps.length - 1], 'done')

      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, done: true } : m))
      }, 1500)
      return
    }

    // Real backend
    try {
      let intent = null
      let steps = []
      let finalResult = null
      let aiMsgId = Date.now() + 2

      const onStep = (data) => {
        if (data.step === 'intent') intent = data.intent
        if (data.step === 'executing') {
          setMessages(prev => prev.filter(m => m.id !== typingId))
          const aiMsg = {
            id: aiMsgId, role: 'ai', time: now(),
            content: 'Executing action pipeline...',
            tags: intent ? [intent.action, intent.target] : [],
            steps: ['Parsing command', 'Intent detected', 'Executing...'],
            done: false,
          }
          setMessages(prev => [...prev, aiMsg])
        }
        if (data.step === 'done') {
          finalResult = data.result
          const resultSteps = data.result?.steps || ['Completed']
          setMessages(prev => prev.map(m => m.id === aiMsgId ? {
            ...m,
            content: data.message,
            steps: resultSteps,
            done: true,
            tags: intent ? [intent.action] : [],
            error: data.result?.success === false ? data.result?.message : null,
          } : m))
          setTaskCount(t => t + resultSteps.length)
          addActivity(resultSteps[resultSteps.length - 1], 'done')
        }
        if (data.step === 'error') {
          setMessages(prev => prev.filter(m => m.id !== typingId))
          setMessages(prev => [...prev, {
            id: aiMsgId, role: 'ai', time: now(),
            content: 'An error occurred while executing your command.',
            error: data.message, steps: [], done: true, tags: ['error'],
          }])
        }
      }

      await sendCommandStream(cmd, onStep)
      setMessages(prev => prev.filter(m => m.id !== typingId))

    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== typingId))
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'ai', time: now(),
        content: 'Could not connect to APPLE backend. Make sure the Python server is running on port 8000.',
        error: err.message, steps: [], done: true, tags: ['error'],
      }])
    }
  }, [input, backendOnline, addActivity])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const viewTitles = { chat: 'Command Interface', workflows: 'Workflow Manager', schedule: 'Task Scheduler', history: 'Command History' }

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(79,142,255,0.06)', filter: 'blur(80px)', top: -80, right: 200, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          onQuickNav={handleSend}
          taskCount={taskCount}
        />

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Topbar */}
          <div className="glass" style={{
            height: 52, borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0,
          }}>
            <i className="ti ti-terminal" style={{ color: 'var(--accent)', fontSize: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{viewTitles[activeView]}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {['AI', 'VOICE', 'AUTO'].map(m => (
                <div key={m}
                  onClick={() => setMode(m.toLowerCase())}
                  style={{
                    fontSize: 10, fontFamily: 'monospace', padding: '3px 10px', borderRadius: 20,
                    cursor: 'pointer', letterSpacing: 0.5, transition: 'all 0.15s',
                    background: mode === m.toLowerCase() ? 'rgba(79,142,255,0.2)' : 'transparent',
                    color: mode === m.toLowerCase() ? 'var(--accent)' : 'var(--text2)',
                    border: `1px solid ${mode === m.toLowerCase() ? 'var(--accent)' : 'var(--border2)'}`,
                  }}
                >{m}</div>
              ))}
              <div style={{
                fontSize: 10, fontFamily: 'monospace', padding: '3px 10px', borderRadius: 20,
                background: backendOnline ? 'rgba(0,229,176,0.1)' : 'rgba(255,79,106,0.1)',
                color: backendOnline ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${backendOnline ? 'rgba(0,229,176,0.25)' : 'rgba(255,79,106,0.25)'}`,
              }}>{backendOnline ? '● LIVE' : '○ DEMO'}</div>
            </div>
          </div>

          {/* Content */}
          {activeView === 'chat' && (
            <>
              <div ref={chatRef} style={{
                flex: 1, overflowY: 'auto', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {messages.map(m => <Message key={m.id} msg={m} />)}

                {/* Quick actions on first load */}
                {messages.length <= 2 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8 }}>QUICK ACTIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {QUICK_ACTIONS.map(q => (
                        <div key={q.cmd}
                          onClick={() => handleSend(q.cmd)}
                          style={{
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '10px 8px', cursor: 'pointer',
                            textAlign: 'center', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          <i className={`ti ${q.icon}`} style={{ fontSize: 18, display: 'block', marginBottom: 5, color: 'var(--accent)' }} />
                          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.3 }}>{q.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface)', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg)', border: '1px solid var(--border2)',
                  borderRadius: 10, padding: '8px 12px', transition: 'all 0.2s',
                }}
                  onFocus={() => {}} // handled via CSS would be ideal, but React inline is fine
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 15, color: 'var(--accent)', flexShrink: 0 }}>›</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tell APPLE what to do..."
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--text)',
                      caretColor: 'var(--accent)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => { setVoiceActive(v => !v); addActivity('Voice toggled', 'run') }}
                      style={{
                        width: 30, height: 30, background: voiceActive ? 'rgba(255,79,106,0.1)' : 'var(--surface2)',
                        border: `1px solid ${voiceActive ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: voiceActive ? 'var(--danger)' : 'var(--text2)', fontSize: 14,
                        transition: 'all 0.15s',
                      }}
                    ><i className="ti ti-microphone" /></button>
                    <button
                      onClick={() => handleSend()}
                      style={{
                        width: 32, height: 32,
                        background: 'linear-gradient(135deg, #4f8eff, #7c5cfc)',
                        border: 'none', borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'white', fontSize: 14,
                        boxShadow: '0 0 16px rgba(79,142,255,0.3)',
                        transition: 'all 0.15s',
                      }}
                    ><i className="ti ti-send" /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {HINTS.map(h => (
                    <span key={h}
                      onClick={() => setInput(h)}
                      style={{
                        fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)',
                        padding: '3px 8px', background: 'var(--surface2)',
                        border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >{h}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeView === 'workflows' && <WorkflowsView onSend={(cmd) => { setActiveView('chat'); handleSend(cmd) }} />}
          {activeView === 'history' && <HistoryView history={history} />}
          {activeView === 'schedule' && (
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Task Scheduler</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>To schedule a task, type something like:<br />
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>"Every morning open my trading dashboard"</span>
              </div>
              {scheduled.map((s, i) => (
                <div key={i} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <i className="ti ti-clock" style={{ color: 'var(--accent)', fontSize: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{s.time} daily</div>
                  </div>
                  <div style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: s.active ? 'rgba(0,229,176,0.1)' : 'rgba(61,74,107,0.3)',
                    color: s.active ? 'var(--success)' : 'var(--text3)',
                    border: `1px solid ${s.active ? 'rgba(0,229,176,0.2)' : 'transparent'}`,
                    fontFamily: 'monospace',
                  }}>{s.active ? 'ACTIVE' : 'PAUSED'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <RightPanel
          activity={activity}
          cmdCount={cmdCount}
          taskCount={taskCount}
          scheduled={scheduled}
          onVoice={() => setVoiceActive(v => !v)}
          voiceActive={voiceActive}
        />
      </div>
    </div>
  )
}

// Demo mode helpers (used when backend is offline)
function getDemoResponse(cmd) {
  const c = cmd.toLowerCase()
  if (c.includes('whatsapp') || c.includes('send')) return `Opening WhatsApp Web and sending your message via Playwright automation.`
  if (c.includes('open')) return `Launching application via AppleScript: tell application "${cmd.replace(/open/i,'').trim()}" to activate`
  if (c.includes('search')) return `Chrome opened. Navigating to Google with your search query.`
  if (c.includes('folder') || c.includes('create')) return `File system action executed. Folder created and opened in Finder.`
  if (c.includes('mute') || c.includes('notif')) return `Do Not Disturb enabled via system defaults. Notifications are muted.`
  if (c.includes('dsa') || c.includes('coding') || c.includes('mode')) return `Workflow activated. Running all steps in sequence...`
  if (c.includes('youtube') || c.includes('music')) return `YouTube opened in Chrome with your search query loaded.`
  return `Command parsed and action pipeline executed. ✅`
}

function getDemoSteps(cmd) {
  const c = cmd.toLowerCase()
  if (c.includes('whatsapp') || c.includes('send')) return ['Browser launched', 'WhatsApp Web opened', 'Contact searched', 'Message typed', 'Message sent ✓']
  if (c.includes('open')) return ['Resolving app name', 'AppleScript executed', 'App window activated']
  if (c.includes('search')) return ['Chrome launched', 'Google.com loaded', 'Query entered', 'Results displayed']
  if (c.includes('folder')) return ['Path validated', 'Directory created', 'Opened in Finder']
  if (c.includes('mute')) return ['Reading system prefs', 'DND policy applied', 'NotificationCenter restarted']
  if (c.includes('mode') || c.includes('dsa') || c.includes('coding')) return ['VS Code opened', 'LeetCode loaded', 'Spotify started', 'Focus mode enabled']
  return ['Intent parsed', 'Action planned', 'Execution complete']
}

function getDemoTags(cmd) {
  const c = cmd.toLowerCase()
  if (c.includes('whatsapp')) return ['browser', 'playwright', 'whatsapp']
  if (c.includes('open')) return ['system', 'applescript']
  if (c.includes('search')) return ['browser', 'google']
  if (c.includes('folder')) return ['system', 'filesystem']
  if (c.includes('mute')) return ['system', 'macos']
  if (c.includes('mode')) return ['workflow', 'multi-step']
  return ['ai', 'executed']
}
