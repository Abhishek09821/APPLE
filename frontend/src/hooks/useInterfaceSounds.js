import { useEffect, useRef } from 'react'

// Optional short button feedback. Scrolling and pointer movement are always silent.
export function useInterfaceSounds({ enabled, volume, muted, extraDocument }) {
  const options = useRef({ enabled, volume, muted })
  options.current = { enabled, volume, muted }
  useEffect(() => {
    let context
    const play = (kind) => {
      const current = options.current
      if (!current.enabled || current.muted || !current.volume) return
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) return
      context ||= new Audio()
      if (context.state === 'suspended') void context.resume().catch(() => {})
      if (context.state !== 'running') return
      const now = context.currentTime,
        oscillator = context.createOscillator(),
        gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(kind === 'change' ? 420 : 540, now)
      oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.025)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(Math.min(0.018, current.volume * 0.08), now + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.038)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    }
    const click = (event) => {
      if (
        event.isTrusted &&
        event.target.closest(
          'button:not(:disabled), a, summary, input[type=checkbox], input[type=radio]',
        )
      )
        play('click')
    }
    const change = (event) => {
      if (event.isTrusted && event.target.matches('select, input[type=range]')) play('change')
    }
    const documents = [document, extraDocument].filter(Boolean)
    for (const target of documents) {
      target.addEventListener('click', click, true)
      target.addEventListener('change', change, true)
    }
    return () => {
      for (const target of documents) {
        target.removeEventListener('click', click, true)
        target.removeEventListener('change', change, true)
      }
      void context?.close()
    }
  }, [extraDocument])
}
