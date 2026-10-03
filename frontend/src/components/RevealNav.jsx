import React, { useEffect, useId, useRef, useState } from 'react'
import { Menu, X, Sun, Moon, PictureInPicture2 } from 'lucide-react'
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

export default function RevealNav({ view, onNavigate, navigation, theme, onTheme, onFloat }) {
  const [open, setOpen] = useState(false)
  const region = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()
  const items = [...navigation, { id: 'settings', label: 'Settings & connections' }]
  const close = (restore = false) => {
    setOpen(false)
    if (restore) trigger.current?.focus()
  }
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
  }, [open])
  useEffect(() => setOpen(false), [view])
  return (
    <nav
      ref={region}
      className={`global-nav${open ? ' menu-open' : ''}`}
      aria-label="Main navigation"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <div className="global-nav-inner">
        <a
          href="#home"
          className="global-brand"
          aria-label="APPLE home"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('home')
            close()
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
        <div id={panelId} className="global-nav-links">
          {items.map(({ id, label }) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                onNavigate(id)
                close()
              }}
            >
              {labels[id] || label}
            </button>
          ))}
        </div>
        <div className="global-nav-tools">
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title="Change theme"
            onClick={onTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button aria-label="Float assistant" title="Float assistant" onClick={onFloat}>
            <PictureInPicture2 size={17} />
          </button>
          <button
            ref={trigger}
            className="global-nav-toggle"
            aria-label={open ? 'Close navigation' : 'Show navigation'}
            aria-controls={panelId}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                requestAnimationFrame(() =>
                  region.current?.querySelector('.global-nav-links button')?.focus(),
                )
              }
            }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
