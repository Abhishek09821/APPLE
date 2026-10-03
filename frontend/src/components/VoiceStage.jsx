import React, { useId } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Mic, MicOff, Square } from 'lucide-react'
import './voice-console.css'

const SIGNAL_BARS = Array.from({ length: 35 }, (_, index) => index)

function SignalBar({ index, level, reduced }) {
  const offset = Math.abs(index - 17) / 17
  const envelope = Math.pow(1 - offset, 0.7)
  // Every movement comes from the current audio level. The fixed envelope gives
  // this mono level meter its shape; it does not invent frequency information.
  const height = useTransform(level, (value) =>
    reduced ? 3 : 2 + value * envelope * (19 + 8 * Math.cos(index * 1.9)),
  )
  const opacity = useTransform(level, (value) => 0.16 + (0.28 + value * 0.56) * envelope)
  return <motion.span className="vc-signal-bar" style={{ height, opacity }} />
}

export function IntelligenceCore({ audioLevel, active, reduced }) {
  const fallbackLevel = useMotionValue(0)
  const level = audioLevel || fallbackLevel
  const cleanLevel = useTransform(level, (value) =>
    active ? Math.min(1, Math.max(0, Number(value) || 0)) : 0,
  )
  const energy = useSpring(cleanLevel, { stiffness: 420, damping: 29, mass: 0.25 })
  const scale = useTransform(energy, [0, 1], reduced ? [1, 1] : [1, 1.11])
  const haloScale = useTransform(energy, [0, 1], reduced ? [1, 1] : [0.9, 1.25])
  const haloOpacity = useTransform(energy, [0, 1], [0.12, 0.6])
  const rimOpacity = useTransform(energy, [0, 1], [0.23, 0.86])
  const id = useId().replace(/:/g, '')

  return (
    <motion.div className="vc-instrument" style={{ '--audio-level': energy }} aria-hidden="true">
      <motion.div className="vc-halo" style={{ scale: haloScale, opacity: haloOpacity }} />
      <svg className="vc-orbit" viewBox="0 0 256 256" fill="none">
        <circle cx="128" cy="128" r="117" stroke="currentColor" strokeWidth="0.5" />
        <circle
          cx="128"
          cy="128"
          r="106"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="0.5 8.75"
        />
        <path d="M128 7v8m0 226v8M7 128h8m226 0h8" stroke="currentColor" />
        <motion.circle
          cx="128"
          cy="128"
          r="117"
          stroke={`url(#${id}-rim)`}
          strokeWidth="1.2"
          style={{ opacity: rimOpacity }}
        />
        <defs>
          <linearGradient
            id={`${id}-rim`}
            gradientUnits="userSpaceOnUse"
            x1="18"
            y1="22"
            x2="236"
            y2="226"
          >
            <stop stopColor="#90c9ff" />
            <stop offset="0.34" stopColor="#c1a9ff" />
            <stop offset="0.68" stopColor="#f3bad3" />
            <stop offset="1" stopColor="#8bd9e6" />
          </linearGradient>
        </defs>
      </svg>
      <motion.svg className="vc-core" viewBox="0 0 180 180" fill="none" style={{ scale }}>
        <defs>
          <linearGradient
            id={`${id}-silver`}
            gradientUnits="userSpaceOnUse"
            x1="39"
            y1="40"
            x2="132"
            y2="152"
          >
            <stop stopColor="#fff" />
            <stop offset="0.25" stopColor="#e1e4eb" />
            <stop offset="0.57" stopColor="#969ba9" />
            <stop offset="0.8" stopColor="#eef0f7" />
            <stop offset="1" stopColor="#656b7a" />
          </linearGradient>
          <linearGradient
            id={`${id}-inner`}
            gradientUnits="userSpaceOnUse"
            x1="119"
            y1="48"
            x2="64"
            y2="139"
          >
            <stop stopColor="#f4f7fc" />
            <stop offset="0.3" stopColor="#b4bbce" />
            <stop offset="0.75" stopColor="#505767" />
            <stop offset="1" stopColor="#d9dfea" />
          </linearGradient>
          <linearGradient
            id={`${id}-edge`}
            gradientUnits="userSpaceOnUse"
            x1="38"
            y1="63"
            x2="131"
            y2="129"
          >
            <stop stopColor="#b0d6ff" />
            <stop offset="0.5" stopColor="#d0bfff" />
            <stop offset="1" stopColor="#efbccd" />
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="0.3" cy="0.2" r="0.8">
            <stop stopColor="white" stopOpacity="0.42" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* A custom paired-seed mark, drawn for APPLE. */}
        <path
          d="M91 46C62 34 37 50 32 78C26 109 46 139 72 143C91 146 103 134 110 117C85 127 66 114 64 95C61 72 74 57 91 46Z"
          fill={`url(#${id}-silver)`}
        />
        <path
          d="M91 46C114 39 139 52 145 79C153 112 133 141 108 143C90 144 76 132 71 116C96 128 115 115 117 96C120 76 109 57 91 46Z"
          fill={`url(#${id}-inner)`}
        />
        <path
          d="M91 46C105 49 114 63 117 78C113 65 102 58 90 59C77 60 68 72 65 84C67 66 76 53 91 46Z"
          fill={`url(#${id}-shine)`}
        />
        <path d="M94 34C95 19 106 12 120 14C119 28 109 37 94 34Z" fill={`url(#${id}-silver)`} />
        <motion.path
          d="M34 80C28 111 47 137 72 141M144 80C151 108 134 138 109 141"
          stroke={`url(#${id}-edge)`}
          strokeWidth="1.2"
          strokeLinecap="round"
          style={{ opacity: rimOpacity }}
        />
      </motion.svg>
      <div className="vc-signal">
        {SIGNAL_BARS.map((index) => (
          <SignalBar key={index} index={index} level={energy} reduced={reduced} />
        ))}
      </div>
    </motion.div>
  )
}

export default function VoiceStage({
  enabled,
  compact,
  listening,
  speaking,
  canInterrupt,
  busy,
  phase,
  transcript,
  ready,
  connected,
  approval,
  audioLevel,
  onToggle,
  onStop,
  onInterrupt,
}) {
  const reduced = useReducedMotion()
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
            : enabled
              ? 'connecting'
              : 'idle'
  const titles = {
    idle: 'At your service.',
    connecting: 'Getting ready.',
    listening: 'Listening.',
    thinking: 'On it.',
    speaking: 'Speaking.',
    review: 'Ready for your approval.',
    offline: 'Reconnecting.',
  }
  const captions = {
    idle: ready ? 'Ask a question or give me a task.' : 'Basic computer commands are available.',
    connecting: 'Allow microphone access to begin.',
    listening: 'Go ahead. I’m here.',
    thinking: phase || 'Working on your request.',
    speaking: enabled
      ? canInterrupt
        ? 'You can interrupt me. I’m listening.'
        : 'I’ll listen after this reply. Tap Interrupt to speak now.'
      : 'Start a voice session to talk with me.',
    review: 'Review the action below.',
    offline: 'Waiting for the local server.',
  }
  const signalActive = listening || speaking

  return (
    <section
      className={`voice-console vc-${state}${compact ? ' vc-compact' : ''}`}
      aria-label="Voice assistant"
      data-voice-state={state}
    >
      <div className="vc-session-state">
        <span className="vc-status-light" />
        {state === 'offline'
          ? 'OFFLINE'
          : state === 'review'
            ? 'AWAITING APPROVAL'
            : state === 'thinking'
              ? 'PROCESSING'
              : state === 'speaking'
                ? 'VOICE OUTPUT'
                : state === 'listening'
                  ? 'VOICE INPUT'
                  : enabled
                    ? 'CONNECTING'
                    : 'READY WHEN YOU ARE'}
      </div>
      <IntelligenceCore audioLevel={audioLevel} active={signalActive} reduced={reduced} />
      <div className="vc-copy" role="status" aria-live="polite" aria-atomic="true">
        <motion.h1
          key={state}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {titles[state]}
        </motion.h1>
        <p>{captions[state]}</p>
      </div>
      <div className="vc-transcript" aria-live="polite">
        {transcript ? <span>“{transcript}”</span> : <span aria-hidden="true">&nbsp;</span>}
      </div>
      <div className="vc-controls">
        <motion.button
          className={`vc-microphone${enabled ? ' vc-microphone-on' : ''}`}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          onClick={onToggle}
          disabled={!connected}
          aria-pressed={enabled}
          title={enabled ? 'End voice session' : 'Start a hands-free voice session'}
        >
          {enabled ? <MicOff size={16} /> : <Mic size={16} />}
          {enabled ? 'End session' : 'Start listening'}
        </motion.button>
        {(busy || speaking) && (
          <button
            className="vc-stop"
            onClick={enabled && speaking && !canInterrupt ? onInterrupt : onStop}
            title={
              enabled && speaking && !canInterrupt
                ? 'Interrupt this reply and listen'
                : 'Stop speaking and working'
            }
          >
            <Square size={12} fill="currentColor" />
            {enabled && speaking && !canInterrupt ? 'Interrupt' : 'Stop'}
          </button>
        )}
      </div>
      <p className="vc-permission">
        {enabled
          ? 'Hands-free session · Say “stop listening” to end'
          : 'Microphone access required · Browser dictation may use online processing'}
      </p>
    </section>
  )
}
