import React from 'react'

const NAV = [
  { id: 'chat', icon: 'ti-message-circle', label: 'Command Hub', dot: true },
  { id: 'workflows', icon: 'ti-layout-grid', label: 'Workflows', dot: false },
  { id: 'schedule', icon: 'ti-calendar', label: 'Schedule', dot: false },
  { id: 'history', icon: 'ti-history', label: 'History', dot: false },
]

const QUICK = [
  { icon: 'ti-browser', label: 'Browser', cmd: 'Open Chrome' },
  { icon: 'ti-brand-whatsapp', label: 'WhatsApp', cmd: 'Open WhatsApp and send a message' },
  { icon: 'ti-device-laptop', label: 'System', cmd: 'Show system automation options' },
]

export default function Sidebar({ activeView, setActiveView, onQuickNav, taskCount }) {
  return (
    <div style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #4f8eff, #7c5cfc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: 'white', letterSpacing: -1,
            boxShadow: '0 0 20px rgba(79,142,255,0.4)', flexShrink: 0,
          }}>A</div>
          <div>
            <div className="glow-text" style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>APPLE</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', letterSpacing: 1 }}>v1.0 — ACTIVE</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 8px', flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', letterSpacing: 2, padding: '6px 8px 4px' }}>CORE</div>
        {NAV.map(n => (
          <div key={n.id}
            onClick={() => setActiveView(n.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              marginBottom: 2,
              background: activeView === n.id ? 'rgba(79,142,255,0.1)' : 'transparent',
              color: activeView === n.id ? 'var(--accent)' : 'var(--text2)',
              border: activeView === n.id ? '1px solid rgba(79,142,255,0.2)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <i className={`ti ${n.icon}`} style={{ fontSize: 15 }} />
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />}
          </div>
        ))}

        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', letterSpacing: 2, padding: '12px 8px 4px' }}>AUTOMATION</div>
        {QUICK.map(q => (
          <div key={q.label}
            onClick={() => onQuickNav(q.cmd)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--text2)',
              marginBottom: 2, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
          >
            <i className={`ti ${q.icon}`} style={{ fontSize: 15 }} />
            {q.label}
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>AI LOAD</span>
          <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'monospace' }}>72%</span>
        </div>
        <div style={{ height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent3))', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>TASKS RUN</span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace' }}>{taskCount}</span>
        </div>
      </div>
    </div>
  )
}
