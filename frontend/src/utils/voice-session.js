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
    if (!this.Recognition) {
      this.onError(
        'Voice conversations need Chrome’s speech recognition. Open APPLE in Chrome and allow the microphone.',
      )
      return
    }
    this.enabled = true
    this.onState({ enabled: true, listening: false })
    this.start()
  }
  disable() {
    this.enabled = false
    this.cancel(this.timer)
    this.detach()
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
    if (!this.enabled || this.suspended || this.pending || this.rec) return
    const rec = new this.Recognition()
    this.rec = rec
    let finalText = ''
    let heardSpeech = false
    rec.lang = navigator.language || 'en-US'
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
        return
      }
      if (!heardSpeech) {
        heardSpeech = true
        this.onSpeech(transcript)
      }
      this.onTranscript(transcript)
      finalText = results
        .filter((r) => r.isFinal)
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
          if (this.enabled && !this.suspended) return this.onCommand(finalText)
        })
        .catch((error) => this.onError(error.message))
        .finally(() => {
          this.pending = false
          this.onTranscript('')
          this.restart()
        })
    }
    try {
      rec.start()
    } catch (error) {
      this.disable()
      this.onError(error.message)
    }
  }
}
