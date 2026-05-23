import React from 'react'

export default function RightPanel({ activity, cmdCount, taskCount, scheduled, onVoice, voiceActive }) {
  return (
    <div style={{
      width: 240, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Activity */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 10, textTransform: 'uppercase' }}>
          Live Activity
        </div>
        {activity.slice(0, 5).map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, fontSize: 11 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', marginTop: 3, flexShrink: 0,
              background: a.type === 'done' ? 'var(--success)' : a.type === 'run' ? 'var(--accent)' : 'var(--text3)',
              animation: a.type === 'run' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <div style={{ flex: 1, color: 'var(--text2)', lineHeight: 1.4 }}>{a.text}</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--text3)', fontSize: 10, flexShrink: 0 }}>{a.time}</div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 10, textTransform: 'uppercase' }}>
          Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { num: cmdCount, lbl: 'commands' },
            { num: taskCount, lbl: 'tasks run' },
            { num: '98%', lbl: 'accuracy' },
            { num: '1.2s', lbl: 'avg latency' },
          ].map(s => (
            <div key={s.lbl} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px',
            }}>
              <div className="glow-text" style={{ fontSize: 20, fontWeight: 700 }}>{s.num}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 2 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div style={{ padding: '14px 14px 10px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 10, textTransform: 'uppercase' }}>
          Scheduled
        </div>
        {scheduled.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 0', borderBottom: i < scheduled.length - 1 ? '1px solid var(--border)' : 'none',
            fontSize: 11,
          }}>
            <div style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 10, minWidth: 40 }}>{s.time}</div>
            <div style={{ flex: 1, color: 'var(--text2)' }}>{s.name}</div>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.active ? 'var(--success)' : 'var(--text3)', flexShrink: 0 }} />
          </div>
        ))}

        {/* Voice btn */}
        <button
          onClick={onVoice}
          style={{
            width: '100%', padding: '10px', marginTop: 14,
            background: voiceActive ? 'rgba(255,79,106,0.1)' : 'var(--surface2)',
            border: `1px solid ${voiceActive ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 8, cursor: 'pointer',
            color: voiceActive ? 'var(--danger)' : 'var(--text2)',
            fontFamily: 'Syne, sans-serif', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            border: `2px solid ${voiceActive ? 'var(--danger)' : 'var(--text2)'}`,
            animation: voiceActive ? 'pulse 0.8s infinite' : 'none',
          }} />
          {voiceActive ? 'Listening...' : 'Activate Voice'}
        </button>
      </div>
    </div>
  )
}
