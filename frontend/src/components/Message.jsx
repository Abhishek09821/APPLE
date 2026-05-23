import React from 'react'

function ExecLog({ steps, done }) {
  return (
    <div style={{
      background: '#070810', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 12px', marginTop: 10,
      fontFamily: 'monospace', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text3)', marginBottom: 6, letterSpacing: 1 }}>// EXECUTION LOG</div>
      {steps.map((s, i) => {
        const isDone = done ? true : i < steps.length - 1
        const isRunning = !done && i === steps.length - 1
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
            color: isDone ? 'var(--success)' : isRunning ? 'var(--accent)' : 'var(--text3)',
            fontSize: 11,
          }}>
            <span>{isDone ? '✓' : isRunning ? '▶' : '○'}</span>
            <span>{s}</span>
          </div>
        )
      })}
      <div style={{ height: 2, background: 'var(--surface3)', borderRadius: 1, marginTop: 6 }}>
        <div style={{
          height: '100%', borderRadius: 1,
          background: 'linear-gradient(90deg, var(--accent), var(--accent3))',
          width: done ? '100%' : `${((steps.length - 1) / steps.length) * 100}%`,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent)', opacity: 0.7,
          animation: `typingBounce 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

export default function Message({ msg }) {
  const isUser = msg.role === 'user'

  return (
    <div style={{
      display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row',
      animation: 'msgIn 0.3s ease forwards',
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        background: isUser ? 'var(--surface3)' : 'linear-gradient(135deg, #4f8eff, #7c5cfc)',
        border: isUser ? '1px solid var(--border2)' : 'none',
        boxShadow: isUser ? 'none' : '0 0 16px rgba(79,142,255,0.3)',
      }}>
        <i className={`ti ${isUser ? 'ti-user' : 'ti-robot'}`} />
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.65,
          background: isUser
            ? 'linear-gradient(135deg, rgba(79,142,255,0.2), rgba(124,92,252,0.2))'
            : 'var(--surface2)',
          border: isUser ? '1px solid rgba(79,142,255,0.3)' : '1px solid var(--border)',
          borderTopRightRadius: isUser ? 2 : 12,
          borderTopLeftRadius: isUser ? 12 : 2,
          color: 'var(--text)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 5 }}>
            {isUser ? 'You' : 'APPLE'} · {msg.time}
          </div>

          {msg.typing ? (
            <TypingIndicator />
          ) : (
            <>
              <div>{msg.content}</div>

              {msg.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                  {msg.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(79,142,255,0.15)', color: 'var(--accent)',
                      border: '1px solid rgba(79,142,255,0.25)', fontFamily: 'monospace',
                    }}>{t}</span>
                  ))}
                </div>
              )}

              {msg.steps?.length > 0 && (
                <ExecLog steps={msg.steps} done={msg.done} />
              )}

              {msg.error && (
                <div style={{
                  marginTop: 8, padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(255,79,106,0.1)', border: '1px solid rgba(255,79,106,0.25)',
                  color: 'var(--danger)', fontSize: 11, fontFamily: 'monospace',
                }}>
                  ✗ {msg.error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
