import { useEffect, useRef } from 'react'

// Short generated earcons; no media downloads, speech or continuous scroll noise.
export function useInterfaceSounds({ enabled, volume, muted, extraDocument }) {
  const options = useRef({ enabled, volume, muted })
  options.current = { enabled, volume, muted }
  useEffect(() => {
    let context,
      lastScroll = 0
    const play = (kind) => {
      const current = options.current
      if (!current.enabled || current.muted || !current.volume) return
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio || (!context && kind === 'scroll')) return
      context ||= new Audio()
      if (context.state === 'suspended') void context.resume().catch(() => {})
      if (context.state !== 'running') return
      const now = context.currentTime,
        oscillator = context.createOscillator(),
        gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(
        kind === 'scroll' ? 340 : kind === 'change' ? 680 : 900,
        now,
      )
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'scroll' ? 270 : 540, now + 0.045)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(
        Math.min(0.035, current.volume * (kind === 'scroll' ? 0.04 : 0.15)),
        now + 0.006,
      )
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.065)
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
    const scroll = (event) => {
      if (event.isTrusted && performance.now() - lastScroll > 240) {
        lastScroll = performance.now()
        play('scroll')
      }
    }
    const documents = [document, extraDocument].filter(Boolean)
    for (const target of documents) {
      target.addEventListener('click', click, true)
      target.addEventListener('change', change, true)
      target.addEventListener('scroll', scroll, { passive: true, capture: true })
    }
    return () => {
      for (const target of documents) {
        target.removeEventListener('click', click, true)
        target.removeEventListener('change', change, true)
        target.removeEventListener('scroll', scroll, true)
      }
      void context?.close()
    }
  }, [extraDocument])
}
