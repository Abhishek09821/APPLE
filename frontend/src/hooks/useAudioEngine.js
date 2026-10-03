import { useCallback, useEffect, useRef, useState } from 'react'
import { useMotionValue } from 'motion/react'
import { api } from '../utils/api'

export function useAudioEngine() {
  const level = useMotionValue(0)
  const context = useRef(null)
  const active = useRef(null)
  const generation = useRef(0)
  const meters = useRef({})
  const levels = useRef({ input: 0, output: 0 })
  const [speaking, setSpeaking] = useState(false)

  const prepare = useCallback(async () => {
    if (!context.current || context.current.state === 'closed') {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) throw new Error('Audio playback is not supported in this browser.')
      context.current = new Audio()
    }
    if (context.current.state === 'suspended') await context.current.resume()
    return context.current
  }, [])

  const measure = useCallback(
    (analyser, channel = 'output') => {
      const token = {}
      if (meters.current[channel]) cancelAnimationFrame(meters.current[channel].frame)
      meters.current[channel] = token
      const samples = new Float32Array(analyser.fftSize)
      const sample = () => {
        if (meters.current[channel] !== token) return
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const value of samples) sum += value * value
        // Noise floor + RMS. No fabricated volume when the source is silent.
        const rms = Math.sqrt(sum / samples.length)
        const target = Math.min(1, Math.max(0, rms - 0.006) * 7)
        levels.current[channel] = levels.current[channel] * 0.3 + target * 0.7
        level.set(active.current?.source ? levels.current.output : levels.current.input)
        token.frame = requestAnimationFrame(sample)
      }
      sample()
      return () => {
        cancelAnimationFrame(token.frame)
        if (meters.current[channel] === token) {
          delete meters.current[channel]
          levels.current[channel] = 0
          level.set(active.current?.source ? levels.current.output : levels.current.input)
        }
      }
    },
    [level],
  )

  const stop = useCallback(() => {
    generation.current += 1
    const current = active.current
    active.current = null
    if (current) {
      current.controller.abort()
      current.source?.stop()
      current.release?.()
    }
    setSpeaking(false)
  }, [])

  const play = useCallback(
    async (text) => {
      const epoch = generation.current
      const ctx = await prepare()
      if (epoch !== generation.current) return
      const job = { controller: new AbortController() }
      active.current = job
      try {
        const response = await api('/speech/audio', {
          method: 'POST',
          body: JSON.stringify({ text: text.slice(0, 12000) }),
          stream: true,
          signal: job.controller.signal,
        })
        if (response.status === 204 || job.controller.signal.aborted) return
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
        if (job.controller.signal.aborted) return
        const source = ctx.createBufferSource()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.buffer = buffer
        source.connect(analyser)
        analyser.connect(ctx.destination)
        job.source = source
        job.release = measure(analyser)
        setSpeaking(true)
        await new Promise((resolve) => {
          source.onended = resolve
          source.start()
        })
        source.disconnect()
        analyser.disconnect()
      } finally {
        job.release?.()
        if (active.current === job) {
          active.current = null
          setSpeaking(false)
        }
      }
    },
    [measure, prepare],
  )

  const monitorMicrophone = useCallback(
    async (signal) => {
      if (signal?.aborted) return () => {}
      const ctx = await prepare()
      if (signal?.aborted) return () => {}
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      let source, analyser, release
      let closed = false
      const cleanup = () => {
        if (closed) return
        closed = true
        signal?.removeEventListener('abort', cleanup)
        release?.()
        source?.disconnect()
        analyser?.disconnect()
        stream.getTracks().forEach((track) => track.stop())
      }
      // A late permission grant must never replace the active playback analyser
      // or keep the physical microphone open after a session ends.
      if (signal?.aborted || ctx.state === 'closed') {
        cleanup()
        return cleanup
      }
      try {
        source = ctx.createMediaStreamSource(stream)
        analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser) // Deliberately no connection to speakers.
        release = measure(analyser, 'input')
        signal?.addEventListener('abort', cleanup, { once: true })
        return cleanup
      } catch (error) {
        cleanup()
        throw error
      }
    },
    [measure, prepare],
  )

  useEffect(
    () => () => {
      stop()
      Object.values(meters.current).forEach((item) => cancelAnimationFrame(item.frame))
      context.current?.close()
    },
    [stop],
  )

  return { level, speaking, prepare, play, stop, monitorMicrophone }
}
