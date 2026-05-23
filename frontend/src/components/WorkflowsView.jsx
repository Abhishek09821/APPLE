import React from 'react'

const WORKFLOWS = [
  { name: 'Coding Mode', desc: 'VS Code + LeetCode + Spotify + Focus', color: 'var(--accent)', cmd: 'Start coding mode', icon: 'ti-code' },
  { name: 'DSA Practice', desc: 'LeetCode + NeetCode + Mute notifs', color: 'var(--accent2)', cmd: 'Start DSA practice mode', icon: 'ti-cpu' },
  { name: 'Work Mode', desc: 'Slack + Notion + Gmail + DND', color: 'var(--success)', cmd: 'Start work mode', icon: 'ti-briefcase' },
  { name: 'Morning Routine', desc: 'HN + GitHub + Spotify', color: 'var(--warn)', cmd: 'Start morning mode', icon: 'ti-sun' },
]

export default function WorkflowsView({ onSend }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Workflows</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Multi-step automation sequences. Click any to run.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {WORKFLOWS.map(w => (
          <div key={w.name}
            onClick={() => onSend(w.cmd)}
            style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${w.color}`,
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface3)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <i className={`ti ${w.icon}`} style={{ fontSize: 20, color: w.color, marginBottom: 8, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{w.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', lineHeight: 1.5 }}>{w.desc}</div>
            <div style={{
              position: 'absolute', top: 10, right: 10,
              fontSize: 9, padding: '2px 6px', borderRadius: 10,
              background: 'rgba(0,229,176,0.1)', color: 'var(--success)',
              border: '1px solid rgba(0,229,176,0.2)', fontFamily: 'monospace',
            }}>AUTO</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Custom workflow</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          Type a command like <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>"every morning open trading dashboard"</span> to create a scheduled workflow, or <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>"start [name] mode"</span> to trigger a multi-step sequence.
        </div>
      </div>
    </div>
  )
}
