import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'motion/react'
import { ArrowUp, ArrowUpRight, Mic, MicOff, Square } from 'lucide-react'
import { IntelligenceCore } from './VoiceStage'

export default function FloatingAssistant({
  window: popup,
  listening,
  speaking,
  busy,
  enabled,
  connected,
  approval,
  transcript,
  reply,
  audioLevel,
  onToggle,
  onStop,
  onReturn,
  onSend,
}) {
  const [input, setInput] = useState('')
  const reduced = useReducedMotion()
  if (!popup) return null
  const state = !connected
    ? 'offline'
    : approval
      ? 'review'
      : speaking
        ? 'speaking'
        : busy
          ? 'thinking'
          : listening
            ? 'listening'
            : 'idle'
  return createPortal(
    <main className={`floating-assistant expression-${state}`}>
      <header>
        <span className="mini-wordmark">APPLE</span>
        <button aria-label="Return to APPLE" title="Return to APPLE" onClick={onReturn}>
          <ArrowUpRight size={16} />
        </button>
      </header>
      <IntelligenceCore audioLevel={audioLevel} active={listening || speaking} reduced={reduced} />
      <strong className="floating-status">
        {
          {
            review: 'Review in APPLE.',
            idle: 'Right here with you.',
            listening: 'I’m listening.',
            thinking: 'Let me take a look.',
            speaking: 'Speaking.',
            offline: 'Reconnecting.',
          }[state]
        }
      </strong>
      <p className="floating-transcript" aria-live="polite">
        {(approval
          ? 'Return to APPLE to review the recipient and message.'
          : transcript || reply) || 'Drag this window anywhere. Keep the APPLE tab open.'}
      </p>
      <div className="floating-controls">
        <button
          onClick={onToggle}
          disabled={!connected}
          aria-label={enabled ? 'End voice session' : 'Start voice session'}
        >
          {enabled ? <MicOff size={16} /> : <Mic size={16} />} {enabled ? 'End session' : 'Listen'}
        </button>
        <button onClick={onStop} aria-label="Stop assistant">
          <Square size={13} />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (input.trim() && !approval && !busy && connected) {
            onSend(input)
            setInput('')
          }
        }}
      >
        <input
          aria-label="Message floating assistant"
          placeholder="Or type a request…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          aria-label="Send floating request"
          disabled={approval || busy || !connected || !input.trim()}
        >
          <ArrowUp size={16} />
        </button>
      </form>
    </main>,
    popup.document.body,
  )
}
