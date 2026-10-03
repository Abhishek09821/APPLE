import React, { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  ChevronDown,
  Settings2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  PictureInPicture2,
} from 'lucide-react'
import './reveal-nav.css'

const compactLabels = {
  home: 'About',
  contact: 'Contact',
  faq: 'FAQs',
  privacy: 'Privacy',
  assistant: 'Assistant',
  library: 'Library',
  routines: 'Routines',
  activity: 'Activity',
  settings: 'Settings',
}

export default function RevealNav({
  view,
  onNavigate,
  navigation,
  persistent = false,
  theme,
  onTheme,
  sounds,
  onSounds,
  onFloat,
}) {
  const [open, setOpen] = useState(false)
  const expanded = open || persistent
  const reduced = useReducedMotion()
  const region = useRef(null)
  const trigger = useRef(null)
  const hideTimer = useRef(null)
  const suppressFocus = useRef(false)
  const panelId = useId()
  const items = navigation.some((item) => item.id === 'settings')
    ? navigation
    : [...navigation, { id: 'settings', label: 'Settings & connections', icon: Settings2 }]

  const cancelHide = () => clearTimeout(hideTimer.current)
  const reveal = () => {
    cancelHide()
    setOpen(true)
  }
  const close = (restoreFocus = false) => {
    cancelHide()
    if (restoreFocus) {
      suppressFocus.current = true
      trigger.current?.focus({ preventScroll: true })
      queueMicrotask(() => {
        suppressFocus.current = false
      })
    }
    setOpen(false)
  }
  const leave = () => {
    cancelHide()
    hideTimer.current = setTimeout(() => {
      if (!region.current?.contains(document.activeElement)) setOpen(false)
    }, 240)
  }
  const navigate = (id) => {
    onNavigate(id)
    close(true)
  }

  useEffect(() => {
    if (!open) return
    const outside = (event) => {
      if (!region.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(region.current?.contains(document.activeElement))
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  return (
    <div
      ref={region}
      className={`reveal-nav-region${expanded ? ' is-open' : ''}${persistent ? ' public-nav' : ''}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') reveal()
      }}
      onPointerLeave={leave}
      onFocusCapture={(event) => {
        if (suppressFocus.current) return
        if (event.target !== trigger.current || event.target.matches(':focus-visible')) reveal()
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close(true)
        }
      }}
    >
      <div className="reveal-nav-edge" aria-hidden="true" />
      {!persistent && (
        <button
          ref={trigger}
          className="reveal-nav-trigger"
          type="button"
          aria-label={open ? 'Hide navigation' : 'Show navigation'}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => (open ? close() : reveal())}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              reveal()
              requestAnimationFrame(() =>
                region.current?.querySelector('.reveal-nav-item')?.focus(),
              )
            }
          }}
          title="Navigation · move to the top edge or press Tab"
        >
          <span className="reveal-nav-handle" />
          <ChevronDown size={10} aria-hidden="true" />
        </button>
      )}
      <motion.nav
        id={panelId}
        className="reveal-nav-panel"
        aria-label="Main navigation"
        aria-hidden={!expanded}
        inert={expanded ? undefined : ''}
        initial={false}
        animate={{
          opacity: expanded ? 1 : 0,
          y: expanded ? 0 : reduced ? 0 : -24,
          scale: expanded ? 1 : 0.985,
        }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 390, damping: 32 }}
        style={{ pointerEvents: expanded ? 'auto' : 'none' }}
      >
        <button
          className="reveal-nav-brand"
          aria-label="APPLE home"
          title="APPLE home"
          tabIndex={expanded ? 0 : -1}
          onClick={() => navigate('home')}
        >
          <svg viewBox="0 0 180 180" fill="currentColor" aria-hidden="true">
            <path d="M91 46C62 34 37 50 32 78C26 109 46 139 72 143C91 146 103 134 110 117C85 127 66 114 64 95C61 72 74 57 91 46Z" />
            <path
              d="M91 46C114 39 139 52 145 79C153 112 133 141 108 143C90 144 76 132 71 116C96 128 115 115 117 96C120 76 109 57 91 46Z"
              opacity=".65"
            />
            <path d="M94 34C95 19 106 12 120 14C119 28 109 37 94 34Z" />
          </svg>
        </button>
        <span className="reveal-nav-divider" aria-hidden="true" />
        <div className="reveal-nav-items">
          {items.map(({ id, label, icon: Icon }) => (
            <motion.button
              key={id}
              type="button"
              className={`reveal-nav-item${view === id ? ' is-selected' : ''}`}
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              title={label}
              tabIndex={expanded ? 0 : -1}
              onClick={() => navigate(id)}
              whileHover={reduced ? undefined : { y: -1 }}
              whileTap={reduced ? undefined : { scale: 0.96 }}
            >
              <Icon size={16} strokeWidth={1.65} aria-hidden="true" />
              <span>{compactLabels[id] || label}</span>
              {view === id && <span className="reveal-nav-active-dot" aria-hidden="true" />}
            </motion.button>
          ))}
        </div>
        {persistent && (
          <div className="reveal-nav-tools">
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={onTheme}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="icon-button"
              aria-label={sounds ? 'Mute interface sounds' : 'Enable interface sounds'}
              onClick={onSounds}
            >
              {sounds ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button className="icon-button" aria-label="Float assistant" onClick={onFloat}>
              <PictureInPicture2 size={16} />
            </button>
          </div>
        )}
      </motion.nav>
    </div>
  )
}
