// A single utterance is committed only after recognition ends. Every recognizer
// has an identity so late events from a cancelled microphone cannot run commands.
export class VoiceSession {
  constructor({
    Recognition,
    onState,
    onTranscript,
    onCommand,
    onError,
    acceptTranscript = () => true,
    onSpeech = () => {},
    acquireInput,
    getLanguage = () => 'en-IN',
    schedule = (fn, delay) => setTimeout(fn, delay),
    cancel = (id) => clearTimeout(id),
  }) {
    Object.assign(this, {
      Recognition,
      onState,
      onTranscript,
      onCommand,
      onError,
      acceptTranscript,
      onSpeech,
      acquireInput,
      getLanguage,
      schedule,
      cancel,
    })
    this.enabled = false
    this.suspended = false
    this.pending = false
    this.rec = null
    this.timer = null
  }
  enable() {
    if (this.enabled) return
    if (!this.Recognition) {
      this.onError(
        'Voice conversations need Chrome’s speech recognition. Open APPLE in Chrome and allow the microphone.',
      )
      return
    }
    this.enabled = true
    this.onState({ enabled: true, listening: false })
    if (!this.acquireInput) return this.start()
    const capture = new AbortController()
    this.capture = capture
    Promise.resolve(this.acquireInput(capture.signal))
      .then((input) => {
        if (capture.signal.aborted || this.capture !== capture) {
          input?.release?.()
          return
        }
        this.input = input
        this.start()
      })
      .catch((error) => {
        if (capture.signal.aborted) return
        this.disable()
        this.onError(
          error.name === 'NotAllowedError'
            ? 'Microphone permission was denied. Allow the microphone in Chrome’s site settings, then start voice again.'
            : error.message,
        )
      })
  }
  disable() {
    this.enabled = false
    this.cancel(this.timer)
    this.detach()
    this.capture?.abort()
    this.capture = null
    this.input?.release?.()
    this.input = null
    this.onTranscript('')
    this.onState({ enabled: false, listening: false })
  }
  detach() {
    const rec = this.rec
    this.rec = null
    if (rec) {
      rec.onstart = rec.onresult = rec.onend = rec.onerror = null
      rec.abort()
    }
    this.onState({ listening: false })
  }
  pause(value) {
    this.suspended = value
    if (value) {
      this.cancel(this.timer)
      this.detach()
    } else this.restart()
  }
  restart() {
    this.cancel(this.timer)
    if (this.enabled && !this.suspended && !this.pending && !this.rec)
      this.timer = this.schedule(() => this.start(), 180)
  }
  start() {
    if (
      !this.enabled ||
      this.suspended ||
      this.pending ||
      this.rec ||
      (this.acquireInput && !this.input)
    )
      return
    const rec = new this.Recognition()
    this.rec = rec
    let finalText = ''
    let heardSpeech = false
    rec.lang = this.getLanguage()
    rec.interimResults = true
    rec.continuous = false
    rec.onstart = () => {
      if (this.rec === rec) this.onState({ listening: true })
    }
    rec.onresult = (event) => {
      if (this.rec !== rec) return
      const results = Array.from(event.results)
      const transcript = results
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (!transcript || !this.acceptTranscript(transcript)) {
        finalText = ''
        this.onTranscript('')
        return
      }
      if (!heardSpeech) {
        heardSpeech = true
        this.onSpeech(transcript)
      }
      this.onTranscript(transcript)
      const finals = results.filter((r) => r.isFinal)
      // Zero is also used by engines that don't report confidence at all.
      // Never execute a positively reported low-confidence command.
      if (finals.some((r) => r[0].confidence > 0 && r[0].confidence < 0.55)) {
        finalText = ''
        this.onError(
          'I didn’t catch that clearly. Please say it again, or choose your spoken language in Settings.',
        )
        return
      }
      finalText = finals
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
    }
    rec.onerror = (event) => {
      if (this.rec !== rec) return
      finalText = ''
      if (event.error === 'no-speech') return
      this.disable()
      const messages = {
        'not-allowed':
          'Microphone permission was denied. Allow the microphone in Chrome’s site settings, then start voice again.',
        'audio-capture':
          'No microphone is available. Connect a microphone, then start voice again.',
        network:
          'Speech recognition lost its connection. Check your internet connection, then start voice again.',
      }
      this.onError(
        messages[event.error] || `Voice stopped (${event.error}). Start voice to try again.`,
      )
    }
    rec.onend = () => {
      if (this.rec !== rec) return
      this.rec = null
      this.onState({ listening: false })
      if (!this.enabled || this.suspended) return
      if (!finalText) return this.restart()
      this.pending = true
      Promise.resolve()
        .then(() => {
          if (this.enabled && !this.suspended && this.acceptTranscript(finalText))
            return this.onCommand(finalText)
        })
        .catch((error) => this.onError(error.message))
        .finally(() => {
          this.pending = false
          this.onTranscript('')
          this.restart()
        })
    }
    try {
      if (this.input?.track) rec.start(this.input.track)
      else rec.start()
    } catch (error) {
      this.disable()
      this.onError(error.message)
    }
  }
}
