// Reject fragments of our own spoken reply without treating all microphone
// activity as the user. This supplements browser acoustic echo cancellation.
const words = (text) =>
  text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
export function isPlaybackEcho(transcript, spoken) {
  const heard = words(transcript),
    output = words(spoken)
  if (!heard.length || !output.length) return false
  if (['stop', 'wait', 'pause', 'listen', 'apple', 'jarvis'].includes(heard[0])) return false
  const phrase = heard.join(' ')
  if (output.join(' ').includes(phrase)) return true
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
