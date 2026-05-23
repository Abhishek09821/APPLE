import React from 'react'

export default function HistoryView({ history }) {
  if (!history.length) return (
    <div style={{ padding: 24, color: 'var(--text2)', fontSize: 13 }}>
      No commands yet. Run something from the Command Hub.
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Command History</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Last {history.length} commands</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.map((h, i) => (
          <div key={i} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: h.success ? 'var(--success)' : 'var(--danger)',
              }} />
              <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{h.command}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>
                {new Date(h.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {h.intent?.action && (
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent)', paddingLeft: 17 }}>
                {h.intent.action} → {h.intent.target}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
