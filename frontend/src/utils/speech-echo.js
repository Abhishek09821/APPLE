// Reject fragments of our own spoken reply without treating all microphone
// activity as the user. This supplements browser acoustic echo cancellation.
const words = (text) =>
  text
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
export function isPlaybackEcho(transcript, spoken) {
  const heard = words(transcript),
    output = words(spoken)
  if (!heard.length || !output.length) return false
  const phrase = heard.join(' ')
  if (` ${output.join(' ')} `.includes(` ${phrase} `)) return true
  if (heard.length < 3) return false
  // Ordered overlap tolerates small dictation differences, not arbitrary shared words.
  let index = 0,
    matches = 0
  for (const word of heard) {
    const found = output.indexOf(word, index)
    if (found !== -1) {
      matches++
      index = found + 1
    }
  }
  return matches / heard.length >= 0.85
}

// Keep multiple replies: recognition results can arrive after playback ends or
// another reply starts. Short lesson answers are only protected during the
// acoustic tail; delayed sentence-length echoes remain protected for 8 seconds.
export class PlaybackEchoGuard {
  constructor(now = () => Date.now()) {
    this.now = now
    this.replies = []
  }
  begin(text) {
    const reply = { text, ended: Infinity }
    this.replies = [...this.replies.filter((r) => this.now() - r.ended < 8000), reply].slice(-5)
    return () => {
      reply.ended = this.now()
    }
  }
  accepts(text) {
    const duration = words(text).length >= 3 ? 8000 : 700
    return !this.replies.some(
      (r) => this.now() - r.ended < duration && isPlaybackEcho(text, r.text),
    )
  }
}
