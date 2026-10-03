import { useEffect, useRef, useState } from 'react'
import { VoiceSession } from '../utils/voice-session'

export function useVoiceSession({
  suspended,
  onCommand,
  onError,
  onSpeech,
  acceptTranscript,
  acquireInput,
  language,
}) {
  const callbacks = useRef({
    onCommand,
    onError,
    onSpeech,
    acceptTranscript,
    acquireInput,
    language,
  })
  callbacks.current = { onCommand, onError, onSpeech, acceptTranscript, acquireInput, language }
  const session = useRef(null)
  const [state, setState] = useState({ enabled: false, listening: false })
  const [transcript, setTranscript] = useState('')
  useEffect(() => {
    const instance = new VoiceSession({
      Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
      onState: (patch) => setState((previous) => ({ ...previous, ...patch })),
      onTranscript: setTranscript,
      onCommand: (text) => callbacks.current.onCommand(text),
      onError: (message) => callbacks.current.onError(message),
      onSpeech: (text) => callbacks.current.onSpeech?.(text),
      acceptTranscript: (text) => callbacks.current.acceptTranscript?.(text) ?? true,
      acquireInput: (signal) => callbacks.current.acquireInput(signal),
      getLanguage: () => callbacks.current.language,
    })
    session.current = instance
    return () => {
      instance.disable()
      session.current = null
    }
  }, [])
  useEffect(() => {
    session.current?.pause(suspended)
  }, [suspended])
  return {
    ...state,
    transcript,
    start: () => session.current?.enable(),
    stop: () => session.current?.disable(),
    pause: () => session.current?.pause(true),
  }
}
