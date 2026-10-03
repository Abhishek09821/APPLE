import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  ChevronDown,
  Sun,
  Moon,
  PictureInPicture2,
  Volume2,
  VolumeX,
  Square,
  X,
} from 'lucide-react'
import './reveal-nav.css'

const labels = {
  home: 'Overview',
  assistant: 'Assistant',
  library: 'Library',
  routines: 'Routines',
  activity: 'Activity',
  contact: 'Support',
  faq: 'FAQs',
  privacy: 'Privacy',
  settings: 'Settings',
}

export default function RevealNav({
  view,
  onNavigate,
  navigation,
  theme,
  onTheme,
  onFloat,
  connected,
  aiReady,
  voice,
  onVoice,
  onStop,
}) {
  const [open, setOpen] = useState(false)
  const region = useRef(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  const hideTimer = useRef(null)
  const panelId = useId()
  const items = [...navigation, { id: 'settings', label: 'Settings & connections' }]
  const cancelHide = useCallback(() => clearTimeout(hideTimer.current), [])
  const close = useCallback((restore = false) => {
    clearTimeout(hideTimer.current)
    if (restore) trigger.current?.focus({ preventScroll: true })
    setOpen(false)
  }, [])
  const reveal = () => {
    cancelHide()
    setOpen(true)
  }
  const select = (id) => {
    onNavigate(id)
    close(true)
  }
  const status = connected ? (aiReady ? 'AI connected' : 'Basic tools ready') : 'Backend offline'

  useEffect(() => {
    close()
  }, [view, close])
  useEffect(() => () => clearTimeout(hideTimer.current), [])
  useEffect(() => {
    if (!open) return
    const escape = (event) => {
      if (event.key === 'Escape') close(true)
    }
    const outside = (event) => {
      if (!region.current?.contains(event.target)) close()
    }
    window.addEventListener('keydown', escape)
    window.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('keydown', escape)
      window.removeEventListener('pointerdown', outside)
    }
  }, [open, close])

  return (
    <nav
      ref={region}
      className={`global-nav${open ? ' nav-open' : ''}`}
      aria-label="Main navigation"
      onPointerEnter={cancelHide}
      onPointerLeave={() => {
        cancelHide()
        hideTimer.current = setTimeout(() => {
          if (!panel.current?.contains(document.activeElement)) close()
        }, 380)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <div
        className="global-nav-edge"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') reveal()
        }}
      >
        <button
          ref={trigger}
          className="global-nav-toggle"
          aria-label="Show navigation"
          title="Navigation · move to the top edge or press Enter"
          aria-controls={panelId}
          aria-expanded={open}
          onClick={reveal}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              reveal()
              requestAnimationFrame(() =>
                panel.current?.querySelector('.global-nav-links button')?.focus(),
              )
            }
          }}
        >
          <span />
          <ChevronDown size={10} />
        </button>
      </div>
      <div
        ref={panel}
        id={panelId}
        className="global-nav-panel"
        inert={open ? undefined : ''}
        aria-hidden={!open}
      >
        <div className="global-nav-inner">
          <a
            href="#home"
            className="global-brand"
            aria-label="APPLE home"
            onClick={(event) => {
              event.preventDefault()
              select('home')
            }}
          >
            <svg viewBox="0 0 180 180" fill="currentColor" aria-hidden="true">
              <path d="M91 46C62 34 37 50 32 78C26 109 46 139 72 143C91 146 103 134 110 117C85 127 66 114 64 95C61 72 74 57 91 46Z" />
              <path
                d="M91 46C114 39 139 52 145 79C153 112 133 141 108 143C90 144 76 132 71 116C96 128 115 115 117 96C120 76 109 57 91 46Z"
                opacity=".65"
              />
              <path d="M94 34C95 19 106 12 120 14C119 28 109 37 94 34Z" />
            </svg>
            <span>APPLE</span>
          </a>
          <div className="global-nav-links">
            {items.map(({ id, label }) => (
              <button
                key={id}
                aria-label={label}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => select(id)}
              >
                {labels[id] || label}
              </button>
            ))}
          </div>
          <div className="global-nav-tools">
            <span
              className={`nav-connection ${connected ? 'connected' : ''}`}
              role="status"
              aria-label={status}
              title={status}
            >
              <i />
            </span>
            <button
              aria-label={voice ? 'Turn spoken replies off' : 'Turn spoken replies on'}
              title="Spoken replies"
              aria-pressed={voice}
              onClick={onVoice}
            >
              {voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              aria-label="Stop all actions and speech"
              title="Stop all actions and speech"
              onClick={onStop}
            >
              <Square size={13} />
            </button>
            <button
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title="Change theme"
              onClick={onTheme}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              aria-label="Float assistant"
              title="Float assistant"
              onClick={() => {
                onFloat()
                close(true)
              }}
            >
              <PictureInPicture2 size={17} />
            </button>
            <button
              className="nav-dismiss"
              aria-label="Hide navigation"
              onClick={() => close(true)}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
